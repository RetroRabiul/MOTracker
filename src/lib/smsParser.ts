/**
 * Rule-driven SMS transaction parser.
 *
 * bKash and every bank format their own wording, and they change it without
 * notice, so the extraction patterns live in user-editable rules rather than in
 * this file. A rule is one regular expression with named capture groups; this
 * module only knows how to run one safely and how to score the result.
 *
 * Nothing here writes to the database. It produces candidates for a human to
 * approve, because a parser that guesses wrong on money is worse than one that
 * asks.
 */

export type SmsDirection = "expense" | "income";

export interface SmsRule {
  id: string;
  /** Human name shown in the rules list. */
  label: string;
  /** Whether this rule produces expenses or income. */
  direction: SmsDirection;
  /**
   * Substring of the sender address this rule applies to. Empty means the rule
   * is a manual/paste rule and is not used for inbox scanning.
   */
  sender: string;
  /**
   * The extraction pattern. Named groups that are honoured:
   * `amount` (required), `currency`, `merchant`, `date`.
   *
   * `date` is matched by the caller against several accepted formats, so a
   * pattern only has to capture the raw text.
   */
  pattern: string;
  /** ISO currency used when the message has no explicit currency. */
  defaultCurrency: string;
  /** Category assigned to accepted transactions. */
  category: string;
  /** Optional note prefix copied into the transaction description. */
  enabled: boolean;
}

export interface SmsMessage {
  /** Provider row id, used to avoid importing the same message twice. */
  id: string;
  address: string;
  body: string;
  /** Epoch millis the SMS was received. */
  date: number;
  read: boolean;
}

export interface ParsedCandidate {
  messageId: string;
  ruleId: string;
  ruleLabel: string;
  address: string;
  rawBody: string;
  receivedAt: number;
  type: SmsDirection;
  amount: number;
  currency: string;
  /** ISO `YYYY-MM-DD`, from the message text or the SMS timestamp. */
  date: string;
  category: string;
  merchant: string;
  /** 0-1. Anything below 0.6 should be read before approving. */
  confidence: number;
  /** Populated when the rule matched but the result is unusable. */
  problem: string | null;
}

/** Longer messages are refused so a careless pattern cannot stall the UI. */
const MAX_BODY = 4000;

/**
 * Bengali digits appear in real bKash messages. Normalising them first means
 * user patterns only ever have to deal with ASCII.
 */
const DIGIT_MAP: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** Replaces non-ASCII digits and collapses the whitespace SMS inserts. */
export function normaliseBody(body: string): string {
  let out = "";
  for (const ch of body) out += DIGIT_MAP[ch] ?? ch;
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Rejects patterns with a quantified group that can match a variable-length
 * chunk, e.g. `(a+)+` or `(a|a)+`. Those are the shapes that backtrack
 * catastrophically, and a pattern that hangs the WebView freezes the whole app
 * with no way to recover.
 *
 * A *bounded* outer quantifier is fine, because it caps the work: the common
 * `(?:\d{1,2}[-/]){1,2}` and the starter rules' `(?:tk|\u09f3|taka)?` are safe
 * and stay allowed.
 */
export function findRiskyQuantifier(pattern: string): number {
  const frames: Array<{ quant: boolean; alt: boolean }> = [];
  let i = 0;
  const n = pattern.length;

  while (i < n) {
    const ch = pattern[i];

    if (ch === "\\") {
      i += 2; // skip the escaped character, including \d \b \{ etc
      continue;
    }

    if (ch === "[") {
      // Inside a character class nothing is a quantifier, so skip to the close.
      i++;
      while (i < n && pattern[i] !== "]") {
        i += pattern[i] === "\\" ? 2 : 1;
      }
      i++;
      continue;
    }

    if (ch === "(") {
      frames.push({ quant: false, alt: false });
      // (?: (?= (?! (?<= (?<!
      if (pattern[i + 1] === "?") {
        const k = pattern[i + 2];
        if (k === ":") {
          i += 3;
          continue;
        }
        if (k === "=" || k === "!") {
          i += 3;
          continue;
        }
        if ((k === "<" && (pattern[i + 3] === "=" || pattern[i + 3] === "!"))) {
          i += 4;
          continue;
        }
        if (k === "<") {
          // Named group (?<name>...) - skip the name.
          const close = pattern.indexOf(">", i + 2);
          i = close === -1 ? n : close + 1;
          continue;
        }
      }
      i++;
      continue;
    }

    if (ch === ")") {
      const frame = frames.pop();
      // Read whatever quantifier applies to the group that just closed.
      let j = i + 1;
      let unbounded = false;
      if (pattern[j] === "*" || pattern[j] === "+") {
        unbounded = true;
        j++;
      } else if (pattern[j] === "?") {
        // Optional group: at most one repetition, so it cannot blow up.
        j++;
      } else if (pattern[j] === "{") {
        const close = pattern.indexOf("}", j);
        if (close !== -1) {
          const body = pattern.slice(j + 1, close);
          const comma = body.indexOf(",");
          const upper = comma === -1 ? body : comma === 0 ? "" : body.slice(comma + 1);
          // `{n}` and `{n,m}` cap the work; `{n,}` and a huge m do not.
          unbounded = upper === "" || Number(upper) > 64;
          j = close + 1;
        }
      }
      if (pattern[j] === "?") j++; // lazy modifier

      if (unbounded && frame && (frame.quant || frame.alt)) {
        return i;
      }
      // The group is consumed; do not treat its own quantifier as content of an
      // enclosing group, but a quantifier here is still content in the sense
      // that the *parent* frame just saw a repeat.
      if (frames.length > 0 && pattern.slice(i + 1, j).length > 0) {
        frames[frames.length - 1].quant = true;
      }
      i = j;
      continue;
    }

    if (ch === "|") {
      const top = frames[frames.length - 1];
      if (top) top.alt = true;
      i++;
      continue;
    }

    if (ch === "*" || ch === "+" || ch === "{") {
      const top = frames[frames.length - 1];
      if (top) top.quant = true;
      // Skip the quantifier body so `,` inside `{1,2}` is not read as anything.
      if (ch === "{") {
        const close = pattern.indexOf("}", i);
        i = close === -1 ? i + 1 : close + 1;
      } else if (pattern[i + 1] === "?") {
        i += 2;
        continue;
      } else {
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "?") {
      // `??`, `+?` handled above; a bare `?` is still a quantifier token.
      if (pattern[i + 1] !== "?" && pattern[i + 1] !== ":" && pattern[i + 1] !== "=" && pattern[i + 1] !== "!") {
        const top = frames[frames.length - 1];
        if (top) top.quant = true;
      }
      i++;
      continue;
    }

    i++;
  }
  return -1;
}

/**
 * Compiles a rule pattern, rejecting anything malformed rather than throwing
 * later from deep inside a list render.
 */
export function compileRule(rule: SmsRule): { regex: RegExp } | { regex: null; problem: string } {
  if (!rule.pattern || !rule.pattern.trim()) return { regex: null, problem: "Pattern is empty" };
  // Python's `(?P<name>...)` is a common thing to reach for, and JavaScript's
  // RegExp cannot compile it. Say so plainly instead of failing as a syntax
  // error further down.
  if (rule.pattern.includes("(?P<")) {
    return { regex: null, problem: "Use JavaScript syntax: (?<amount>...), not (?P<amount>...)" };
  }
  if (!rule.pattern.includes("(?<amount>")) {
    return { regex: null, problem: 'Pattern must contain a named "amount" group: (?<amount>...)' };
  }
  if (rule.pattern.length > 600) {
    return { regex: null, problem: "Pattern is too long" };
  }
  const risky = findRiskyQuantifier(rule.pattern);
  if (risky >= 0) {
    return {
      regex: null,
      problem:
        `Pattern repeats a group that can match variable text (near position ${risky}). ` +
        "That can freeze the app. Add a limit such as {1,20} or simplify the group.",
    };
  }
  try {
    // Flags are fixed: patterns come from the user, so global/sticky flags and
    // the `g` lastIndex hazard are not exposed.
    return { regex: new RegExp(rule.pattern, "i") };
  } catch (error) {
    return { regex: null, problem: error instanceof Error ? error.message : "Invalid pattern" };
  }
}

/**
 * Parses the digits out of a captured amount.
 *
 * Grouping separators are ambiguous across locales, so the last separator wins
 * as the decimal point and the other is treated as grouping:
 *   `1,234.50` -> 1234.5   (en-US)
 *   `1.234,50` -> 1234.5   (de-BD)
 *   `99.50`    -> 99.5     (trailing group is not 3 digits)
 *   `1,234`    -> 1234     (single group of exactly 3 is grouping, not decimal)
 *   `৳1,200`   -> 1200     (symbols and whitespace already stripped)
 *
 * A single separator followed by exactly three digits is genuinely ambiguous
 * and is read as thousands, because mistaking `1,234` for 1.234 would
 * over-report an expense by a factor of a thousand.
 */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = normaliseBody(raw).replace(/[^\d.,-]/g, "");
  const negative = cleaned.startsWith("-");
  const digitsOnly = cleaned.replace(/-/g, "");
  if (!/\d/.test(digitsOnly)) return null;

  const lastDot = digitsOnly.lastIndexOf(".");
  const lastComma = digitsOnly.lastIndexOf(",");
  let normalised: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the rightmost one is the decimal separator.
    const decimalAt = Math.max(lastDot, lastComma);
    normalised =
      digitsOnly.slice(0, decimalAt).replace(/[.,]/g, "") +
      "." +
      digitsOnly.slice(decimalAt + 1).replace(/[.,]/g, "");
  } else {
    const separator = lastDot >= 0 ? "." : lastComma >= 0 ? "," : "";
    if (!separator) {
      normalised = digitsOnly;
    } else {
      const parts = digitsOnly.split(separator);
      const occurrences = parts.length - 1;
      const tail = parts[parts.length - 1];
      if (occurrences > 1 || tail.length === 3) {
        // Repeated, or a clean thousands group: all grouping.
        normalised = parts.join("");
      } else {
        normalised = parts.join(".");
      }
    }
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Accepts the date shapes banks actually emit. Returns ISO `YYYY-MM-DD`, or
 * null so the caller can fall back to the SMS timestamp.
 *
 * `02/03/2026` is deliberately NOT guessed. Reading it as March 2nd when the
 * bank meant February 3rd would file the transaction in the wrong month, and the
 * SMS timestamp is already a reliable answer, so ambiguity falls through to it
 * rather than being resolved by a coin flip.
 */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = normaliseBody(raw);

  let m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = text.match(/(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month) {
      const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return iso(year, month, +m[1]);
    }
  }

  m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const first = +m[1];
    const second = +m[2];
    if (first > 12 && second <= 12) return iso(+m[3], second, first); // dd/mm
    if (second > 12 && first <= 12) return iso(+m[3], first, second); // mm/dd
    return null; // genuinely ambiguous
  }
  return null;
}

/** Rejects impossible dates such as 31 February rather than rolling them over. */
function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toIsoDate(epochMillis: number): string {
  const d = new Date(epochMillis);
  if (Number.isNaN(d.getTime())) return toIsoDate(Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Trims punctuation and honourifics bKash prefixes with names, and drops the
 * trailing clause operators like "... from bKash" that a greedy `merchant` group
 * inevitably swallows.
 */
function cleanMerchant(raw: string | undefined): string {
  if (!raw) return "";
  let out = normaliseBody(raw)
    .replace(/^(?:mr|mrs|ms|dr|sir|madam)\.?\s+/i, "")
    .replace(/[.,;:]+$/, "")
    .trim();

  // A merchant group matches across sentence punctuation, so
  // "Rahim Store. Avail bal Tk 12,300.50." arrives as one string. Cut at the
  // first sentence break that is followed by real content, otherwise the
  // following clause is saved as part of the merchant name.
  //
  // Two guards keep abbreviations intact. A sentence needs at least four
  // characters before the break, which preserves "St." and "Dr.", and the
  // next sentence must start capitalised, so "St. Martins Mall" and
  // "Rahim & Co. Ltd" survive. Decimal points need no special case: they are
  // followed by a digit, not whitespace.
  const sentenceEnd = /^(.{4,}?)[.?!]\s+[A-Z]/.exec(out);
  if (sentenceEnd) out = sentenceEnd[1].trim();

  // "Rahim Store from bKash" -> "Rahim Store". Only cuts when something
  // recognisable follows, so a merchant that is itself one word is untouched.
  const connector = /\s(?:from|to|at|on|via|using|with|for|by)\s+(.{2,40})$/i.exec(out);
  if (connector) out = out.slice(0, connector.index).trim();

  return out.replace(/[.,;:]+$/, "").slice(0, 80);
}

/**
 * Runs one rule against one message. A rule that does not match yields null;
 * a rule that matches but cannot produce a usable amount yields a candidate
 * carrying a `problem` so the user can see the message and fix the rule.
 */
export function parseMessage(
  message: SmsMessage,
  rule: SmsRule,
): ParsedCandidate | null {
  const base = {
    messageId: message.id,
    ruleId: rule.id,
    ruleLabel: rule.label,
    address: message.address,
    rawBody: message.body,
    receivedAt: message.date,
    type: rule.direction,
    category: rule.category,
  };

  if (message.body.length > MAX_BODY) {
    return {
      ...base,
      amount: 0,
      currency: rule.defaultCurrency,
      date: toIsoDate(message.date),
      merchant: "",
      confidence: 0,
      problem: "Message is too long to parse",
    };
  }

  const compiled = compileRule(rule);
  if (compiled.regex === null) {
    return {
      ...base,
      amount: 0,
      currency: rule.defaultCurrency,
      date: toIsoDate(message.date),
      merchant: "",
      confidence: 0,
      problem: compiled.problem,
    };
  }

  const normalised = normaliseBody(message.body);
  const match = compiled.regex.exec(normalised);
  if (!match?.groups) return null;

  const groups = match.groups as Record<string, string | undefined>;
  const amount = parseAmount(groups.amount);
  const currency = (groups.currency || rule.defaultCurrency).toUpperCase();
  const merchant = cleanMerchant(groups.merchant);
  const textDate = parseDate(groups.date);

  if (amount === null || amount <= 0) {
    return {
      ...base,
      amount: 0,
      currency,
      date: textDate ?? toIsoDate(message.date),
      merchant,
      confidence: 0,
      problem: groups.amount ? "Could not read the amount" : "Pattern captured no amount",
    };
  }

  // Confidence reflects what the user still has to check by eye.
  let confidence = 0.5;
  if (groups.amount) confidence += 0.25;
  if (groups.currency) confidence += 0.1;
  if (merchant) confidence += 0.15;
  if (textDate) confidence += 0.1;
  if (amount > 100_000_000) confidence -= 0.25;

  return {
    ...base,
    amount,
    currency,
    date: textDate ?? toIsoDate(message.date),
    merchant,
    confidence: Math.max(0, Math.min(1, confidence)),
    problem: null,
  };
}

/** Every enabled rule is tried; the first match wins so ordering is the user's dial. */
export function applyRules(messages: SmsMessage[], rules: SmsRule[]): ParsedCandidate[] {
  const active = rules.filter((r) => r.enabled && r.sender.trim());
  const out: ParsedCandidate[] = [];
  for (const message of messages) {
    for (const rule of active) {
      if (!senderMatches(message.address, rule.sender)) continue;
      const candidate = parseMessage(message, rule);
      if (candidate) {
        out.push(candidate);
        break;
      }
    }
  }
  return out;
}

/**
 * Identity of the underlying SMS, independent of which path delivered it.
 *
 * A broadcast carries no provider row id, so captured messages are tagged with
 * a synthetic one while the same message read from the inbox query keeps the
 * provider id. The two ids never agree, so anything that has to recognise "the
 * same SMS twice" keys off this instead. Whitespace is collapsed and case
 * folded because a broadcast and an inbox row should differ only in id.
 */
export function messageFingerprint(input: { address: string; body: string; date: number }): string {
  const address = input.address.replace(/[^\dA-Za-z]/g, "").toLowerCase();
  const body = input.body.replace(/\s+/g, " ").trim().toLowerCase();
  return `${address}|${input.date}|${body}`;
}

/** Fingerprint of a parsed candidate, for comparing against other candidates. */
export function candidateFingerprint(candidate: ParsedCandidate): string {
  return messageFingerprint({
    address: candidate.address,
    body: candidate.rawBody,
    date: candidate.receivedAt,
  });
}

/**
 * Folds new candidates into an existing list, keeping one row per real SMS.
 *
 * The list is shared between the receiver queue and the inbox scan, so the same
 * message can be offered twice under two different ids. Ids that lose are
 * returned so the caller can mark them handled, which is what stops the losing
 * copy from being imported a second time.
 */
export function mergeCandidates(
  existing: ParsedCandidate[],
  incoming: ParsedCandidate[],
): { merged: ParsedCandidate[]; foldedIds: string[] } {
  const merged = [...existing];
  const knownIds = new Set(existing.map((c) => c.messageId));
  const knownPrints = new Set(existing.map(candidateFingerprint));
  const foldedIds: string[] = [];

  for (const candidate of incoming) {
    if (knownIds.has(candidate.messageId) || knownPrints.has(candidateFingerprint(candidate))) {
      foldedIds.push(candidate.messageId);
      continue;
    }
    merged.push(candidate);
    knownIds.add(candidate.messageId);
    knownPrints.add(candidateFingerprint(candidate));
  }

  return { merged, foldedIds };
}

export function senderMatches(address: string, sender: string): boolean {
  const needle = normaliseBody(sender).replace(/[^\dA-Za-z]/g, "").toLowerCase();
  if (!needle) return false;
  const hay = normaliseBody(address).replace(/[^\dA-Za-z]/g, "").toLowerCase();
  if (hay.includes(needle)) return true;
  // Fall back to the trailing significant digits so +8801... matches 01...
  const digits = (s: string) => s.replace(/\D/g, "");
  const nd = digits(needle);
  const hd = digits(hay);
  return nd.length >= 6 && hd.length >= 6 && hd.endsWith(nd.slice(-10));
}

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}
