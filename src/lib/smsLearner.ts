import { CURRENCIES } from "../types/expense";
import {
  normaliseBody,
  parseMessage,
  type ParsedCandidate,
  type SmsDirection,
  type SmsMessage,
  type SmsRule,
} from "./smsParser";

/**
 * Turns real messages from one sender into rules.
 *
 * The alternative is asking someone to write a regular expression, which is a
 * poor first experience and the reason connecting a new bank used to dead-end:
 * messages were captured, nothing read them, and the screen could only report
 * the failure.
 *
 * Two strategies are tried and the better one wins, because each covers the
 * other's blind spot.
 *
 * **A template, keyed on the words the sender uses.** "sent ... to" becomes an
 * alternation of every known synonym with a flexible amount and an optional
 * merchant. This reads tomorrow's message as well as today's, which is the
 * whole point.
 *
 * **A transcription, for wording nobody anticipated.** The amount, the date,
 * the merchant, and every other number such as a running balance or
 * transaction id become flexible groups; only fixed wording stays literal.
 * This reliably re-reads the exact messages it was built from, and it will
 * not read anything else — which is why it is the fallback and not the
 * default.
 *
 * Crucially, neither strategy is trusted on inspection. Both are run against
 * every message the sender actually sent, and the proposal the user sees
 * reports how many of them each one read.
 *
 * Direction is inferred, because "sent" and "received" genuinely decide the
 * answer. Transfer is not inferred freely: "sent Tk 500" is a top-up when it
 * paid the user's own wallet and a purchase when it paid a shop, and the words
 * are identical. So transfer is only claimed for messages that say so
 * unambiguously — cash in/out, top up, self transfer, or an explicit mention of
 * the user's own account or wallet.
 */

export interface ProposalCheck {
  messageId: string;
  body: string;
  matched: boolean;
  /** Set when the message matched but produced something unusable. */
  problem: string | null;
  amount: number | null;
  type: SmsDirection | null;
  merchant: string;
}

export interface RuleProposal {
  rules: SmsRule[];
  checks: ProposalCheck[];
  /** Messages that produced a usable candidate. */
  matched: number;
  /** Messages considered. */
  total: number;
  /** Reasons to look before trusting this. */
  notes: string[];
  /** True when every message from the sender produced a usable candidate. */
  complete: boolean;
  /** Which strategy won, for the explanation shown to the user. */
  strategy: "template" | "transcription" | "none";
}

interface Span {
  start: number;
  end: number;
}

/**
 * Currency words. Deliberately not `/g`: a global regex carries `lastIndex`
 * between calls, so the second message examined would resume the search after
 * the first one's match and pick up a later "Tk" from a balance line.
 */
const CURRENCY_WORDS = /(?:bdt|tk|taka|pkr|usd|inr|rs)|৳/i;

const CURRENCY_ISO: Record<string, string> = {
  tk: "BDT",
  taka: "BDT",
  bdt: "BDT",
  "৳": "BDT",
  pkr: "PKR",
  usd: "USD",
  inr: "INR",
  rs: "INR",
};

const CURRENCY_ALTERNATION = "bdt|tk|taka|pkr|usd|inr|rs|৳";

/** The date shapes `parseDate` accepts, so a captured date is always readable. */
const DATE_SOURCE =
  /\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}/;

const DATE_GROUP =
  "(?<date>\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}|\\d{1,2}[-\\s][A-Za-z]{3,9}[-\\s]\\d{2,4})";

const AMOUNT_GROUP = "(?<amount>[\\d,.]*\\d)";
const CURRENCY_GROUP = `(?<currency>${CURRENCY_ALTERNATION})`;
const MERCHANT_GROUP = "(?<merchant>(?!(?:your|my|own)\\b)[A-Za-z][A-Za-z &'.-]{0,60})";

/**
 * Numbers that are neither the amount nor part of a date. A bank SMS trails a
 * running balance and often a transaction id; left as literal digits they
 * would pin the rule to one exact message.
 */
const ANY_NUMBER = "\\d[\\d,.]*\\d";

/** Money leaving the user. */
const OUT_WORDS =
  /\b(?:sent|send|sending|paid|pay|payment|purchased|purchase|charged|charge|pos|debited|debit|dr|withdrawn|withdrawal|ordered|delivered)\b/i;

/** Money arriving. */
const IN_WORDS =
  /\b(?:received|receive|receiving|credited|credit|cr|refund|refunded|salary|cashback|deposited|added)\b/i;

/**
 * The user's own money, named as a container. Shared by the transfer marker and
 * the transfer templates so the two can never drift apart and start
 * disagreeing about what counts as a transfer. The optional second word covers
 * the two-word forms real senders use: "bKash wallet", "bank account".
 */
const OWN_ACCOUNT = "(?:account|wallet|bank|bkash|nagad|rocket)(?:\\s+(?:account|wallet))?";

/**
 * Transfer markers, kept narrow on purpose. Each names a financial container
 * the user owns, so the message is about moving their own money. "to your
 * mother" must not match: giving someone money is spending, and a loose marker
 * would quietly reclassify real payments as transfers.
 */
const TRANSFER_WORDS: { re: RegExp; label: string }[] = [
  { re: /\bcash[\s-]?out\b/i, label: "cash out" },
  { re: /\bcash[\s-]?in\b/i, label: "cash in" },
  { re: /\btop[\s-]?up(?:ped)?\b/i, label: "top up" },
  { re: /\bself[\s-]?transfer\b/i, label: "self transfer" },
  {
    re: new RegExp(`\\b(?:to|from)\\s+your\\s+(?:own\\s+)?${OWN_ACCOUNT}\\b`, "i"),
    label: "to/from your own account",
  },
  { re: /\byour\s+own\s+(?:account|wallet)\b/i, label: "your own account" },
];

/** Optional currency word, as a pattern fragment. */
const CURRENCY_OPTIONAL = `\\s*(?<currency>${CURRENCY_ALTERNATION})?`;

/**
 * Templates per direction. More than one for transfer, because the two real
 * word orders cannot share a pattern: JavaScript allows a named group only
 * once per pattern, and "Cash Out from Agent Point: Tk 1,000" puts the amount
 * after the marker while "sent Tk 450 to your bKash wallet" puts it before.
 */
const CANONICAL: Record<SmsDirection, string[]> = {
  expense: [
    "(?:you\\s+have\\s+)?(?:sent|send|sending|paid|pay|paid\\s+to|payment\\s+to|purchased|purchase|charged|charge|pos|debited|debit|dr\\.?|withdrawn|withdrawal|ordered|delivered)\\b[^0-9]{0,30}" +
      AMOUNT_GROUP +
      CURRENCY_OPTIONAL +
      "(?:[^.]{0,40}?\\b(?:to|at)\\b\\s+" +
      MERCHANT_GROUP +
      ")?",
  ],
  income: [
    "(?:you\\s+have\\s+)?(?:received|receive|receiving|credited|credit|cr\\.?|refunded|refund|salary|cashback|deposited|added)\\b[^0-9]{0,30}" +
      AMOUNT_GROUP +
      CURRENCY_OPTIONAL +
      "(?:[^.]{0,40}?\\bfrom\\b\\s+" +
      MERCHANT_GROUP +
      ")?",
  ],
  transfer: [
    // Marker first, amount after: "Cash Out from Agent Point: Tk 1,000".
    "(?:cash\\s*out|cash\\s*in|top\\s*up(?:ped)?|self[\\s-]?transfer)[^.]{0,40}?" +
      AMOUNT_GROUP +
      CURRENCY_OPTIONAL,
    // Amount first, own-account connector after: "sent Tk 450 to your bKash
    // wallet". The connector is required here, not optional, or the pattern
    // would match any "sent X to ..." and quietly reclassify paying a person.
    "(?:you\\s+have\\s+)?(?:sent|send|sending|received|receive|receiving|transferred?|paid)\\b[^0-9]{0,30}" +
      AMOUNT_GROUP +
      CURRENCY_OPTIONAL +
      "[^.]{0,40}?\\b(?:to|from)\\s+(?=(?:your|my|own)\\s+" +
      OWN_ACCOUNT +
      ")",
  ],
};

const DIRECTION_LABEL: Record<SmsDirection, string> = {
  expense: "money out",
  income: "money in",
  transfer: "own money moved",
};

function escapeLiteral(text: string): string {
  // Whitespace becomes `\s+` so a line-wrapped SMS still matches.
  return text
    .split(/(\s+)/)
    .map((part) =>
      /^\s+$/.test(part) ? "\\s+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
}

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Decides in, out, or own-money-moved, from the words the sender actually used. */
export function detectDirection(
  body: string,
): { direction: SmsDirection; label: string } | null {
  const text = normaliseBody(body);

  for (const { re, label } of TRANSFER_WORDS) {
    if (re.test(text)) return { direction: "transfer", label };
  }
  if (OUT_WORDS.test(text)) return { direction: "expense", label: "money out" };
  if (IN_WORDS.test(text)) return { direction: "income", label: "money in" };
  return null;
}

/**
 * Finds the amount, preferring a number next to a currency word and otherwise
 * the first number that is neither a date nor long enough to be an account or
 * transaction id, because those are what usually come first in a bank SMS.
 */
function findAmountSpan(text: string, dateSpan: Span | null, currencySpan: Span | null): Span | null {
  const runs: Span[] = [];
  const re = /\d[\d,.]*\d/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    runs.push({ start: m.index, end: m.index + m[0].length });
  }
  if (runs.length === 0) return null;

  const usable = runs.filter((r) => !dateSpan || !overlaps(r, dateSpan));
  if (usable.length === 0) return null;

  if (currencySpan) {
    const adjacent = usable.find((r) => {
      const before = text.slice(Math.max(0, r.start - 4), r.start);
      const after = text.slice(r.end, r.end + 4);
      return /bdt|tk|taka|pkr|usd|inr|rs|৳/i.test(before + after);
    });
    if (adjacent) return adjacent;
  }

  const notAnId = usable.find((r) => r.end - r.start <= 10);
  return notAnId ?? usable[0];
}

/**
 * The merchant is the tail after a connector, bounded at the first sentence
 * break so "Rahim Store. Avail bal..." does not swallow the balance.
 */
function findMerchantSpan(text: string): Span | null {
  const m = /\b(?:to|from|at)\b\s+(.{2,60}?)(?=[.!?]|\s+(?:avail|available|balance|bal)\b|$)/i.exec(text);
  if (!m || !m[1]) return null;
  // "from your bank account" names the user's own account, not a merchant.
  if (/^(?:your|my|own)\b/i.test(m[1])) return null;
  const start = m.index + m[0].indexOf(m[1], m[0].length - m[1].length);
  return { start, end: start + m[1].length };
}

/** Every numeric run, used to keep stray digits from going literal. */
function findNumberSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /\d[\d,.]*\d/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

function defaultCategory(direction: SmsDirection, text: string): string {
  if (direction === "transfer") {
    return /\b(?:wallet|bkash|nagad|rocket)\b|\bcash[\s-]?(?:in|out)\b|\btop[\s-]?up\b/i.test(text)
      ? "Wallet Transfer"
      : "Bank Transfer";
  }
  // Deliberately "Other": guessing Food from the word "store" would be wrong
  // often enough to be worse than not guessing, and category learning can do
  // this properly later from the merchant the user actually keeps.
  return "Other";
}

interface Shaped {
  pattern: string;
  direction: SmsDirection;
  label: string;
  currency: string;
  category: string;
}

/**
 * Builds one pattern by transcribing a single message with its variable parts
 * replaced by groups, or null when it cannot honestly be shaped.
 */
export function shapeMessage(body: string): Shaped | null {
  const direction = detectDirection(body);
  if (!direction) return null;

  const text = normaliseBody(body);

  const dateMatch = DATE_SOURCE.exec(text);
  const dateSpan: Span | null = dateMatch
    ? { start: dateMatch.index, end: dateMatch.index + dateMatch[0].length }
    : null;

  const currencyMatch = CURRENCY_WORDS.exec(text);
  const currencySpan: Span | null = currencyMatch
    ? { start: currencyMatch.index, end: currencyMatch.index + currencyMatch[0].length }
    : null;

  const amountSpan = findAmountSpan(text, dateSpan, currencySpan);
  // Without an amount there is no transaction, so there is nothing to learn.
  if (!amountSpan) return null;

  const merchantSpan = findMerchantSpan(text);
  const looseNumbers = findNumberSpans(text).filter(
    (r) =>
      !overlaps(r, amountSpan) &&
      (!dateSpan || !overlaps(r, dateSpan)) &&
      (!merchantSpan || !overlaps(r, merchantSpan)),
  );

  const kindAt = (
    i: number,
  ): { kind: "amount" | "currency" | "date" | "merchant" | "number"; span: Span } | null => {
    if (amountSpan.start <= i && i < amountSpan.end) return { kind: "amount", span: amountSpan };
    if (dateSpan && dateSpan.start <= i && i < dateSpan.end) return { kind: "date", span: dateSpan };
    if (merchantSpan && merchantSpan.start <= i && i < merchantSpan.end) {
      return { kind: "merchant", span: merchantSpan };
    }
    if (currencySpan && currencySpan.start <= i && i < currencySpan.end) {
      return { kind: "currency", span: currencySpan };
    }
    const loose = looseNumbers.find((r) => r.start <= i && i < r.end);
    return loose ? { kind: "number", span: loose } : null;
  };

  let pattern = "";
  let literal = "";
  const flush = () => {
    if (literal) {
      pattern += escapeLiteral(literal);
      literal = "";
    }
  };

  for (let i = 0; i < text.length; i++) {
    const hit = kindAt(i);
    if (!hit) {
      literal += text[i];
      continue;
    }
    flush();
    pattern +=
      hit.kind === "amount"
        ? AMOUNT_GROUP
        : hit.kind === "date"
          ? DATE_GROUP
          : hit.kind === "currency"
            ? CURRENCY_GROUP
            : hit.kind === "merchant"
              ? MERCHANT_GROUP
              : ANY_NUMBER;
    i = hit.span.end - 1;
  }
  flush();

  const currency = currencySpan
    ? CURRENCY_ISO[text.slice(currencySpan.start, currencySpan.end).toLowerCase()] ?? "BDT"
    : "BDT";

  return {
    pattern,
    direction: direction.direction,
    label: direction.label,
    currency,
    category: defaultCategory(direction.direction, text),
  };
}

let proposalCounter = 0;

function makeRule(
  platform: { id: string; name: string },
  pattern: string,
  direction: SmsDirection,
  label: string,
  currency: string,
  category: string,
): SmsRule {
  proposalCounter += 1;
  return {
    id: `auto-${platform.id}-${proposalCounter}`,
    label: `${platform.name} — ${label}`,
    direction,
    platformId: platform.id,
    sender: "",
    pattern,
    defaultCurrency: currency,
    category,
    enabled: true,
  };
}

/**
 * When two rules both read a message, the better read wins on confidence. On a
 * tie the transfer claim takes it, because transfer is the specific reading:
 * it only exists when the message said something about the user's own money,
 * while "expense" is merely the default way to read "sent". Letting expense
 * win a tie would file every wallet top-up as a purchase, which is the whole
 * bug transfers were added to stop.
 */
function betterRead(a: ParsedCandidate, b: ParsedCandidate): boolean {
  if (a.confidence !== b.confidence) return a.confidence > b.confidence;
  return a.type === "transfer" && b.type !== "transfer";
}

/** Runs a candidate rule set over every message and reports what it read. */
function evaluate(rules: SmsRule[], messages: SmsMessage[]): ProposalCheck[] {
  const checks = messages.map((message) => {
    let best: ParsedCandidate | null = null;
    for (const rule of rules) {
      const candidate = parseMessage(message, rule);
      if (candidate && !candidate.problem && (best === null || betterRead(candidate, best))) {
        best = candidate;
      }
    }
    if (best) {
      return {
        messageId: message.id,
        body: message.body,
        matched: true,
        problem: null,
        amount: best.amount,
        type: best.type,
        merchant: best.merchant,
      };
    }
    return {
      messageId: message.id,
      body: message.body,
      matched: false,
      problem: "no proposed rule read this message",
      amount: null,
      type: null,
      merchant: "",
    };
  });

  return checks;
}

export function proposeRules(
  messages: SmsMessage[],
  platform: { id: string; name: string },
): RuleProposal {
  const notes: string[] = [];
  const known = new Set(CURRENCIES.map((c) => c.code));

  // Strategy A: one template per direction the sender actually used.
  const directions = new Map<SmsDirection, { currency: string; category: string; count: number }>();
  for (const message of messages) {
    const detected = detectDirection(message.body);
    if (!detected) continue;
    const shaped = shapeMessage(message.body);
    const currency = shaped?.currency ?? "BDT";
    const category = defaultCategory(detected.direction, normaliseBody(message.body));
    const entry = directions.get(detected.direction);
    if (entry) {
      entry.count += 1;
    } else {
      directions.set(detected.direction, { currency, category, count: 1 });
    }
  }

  const templateRules = [...directions.entries()].flatMap(([direction, info]) =>
    CANONICAL[direction].map((pattern, index) =>
      makeRule(
        platform,
        pattern,
        direction,
        // The two transfer templates cover different word orders, so they need
        // names a user can tell apart when a rule stops matching.
        CANONICAL[direction].length > 1
          ? `${DIRECTION_LABEL[direction]} (${index === 0 ? "cash" : "account"} wording)`
          : DIRECTION_LABEL[direction],
        info.currency,
        info.category,
      ),
    ),
  );

  // Strategy B: one rule per distinct message shape.
  const byPattern = new Map<string, { shaped: Shaped; count: number }>();
  let unshaped = 0;
  // Kept so the reason a message was skipped can be specific. "Nothing read
  // it" and "it never had an amount or a direction word" are different
  // problems, and only one of them is worth the user's attention.
  const unshapedIds = new Set<string>();
  for (const message of messages) {
    const shaped = shapeMessage(message.body);
    if (!shaped) {
      unshaped += 1;
      unshapedIds.add(message.id);
      continue;
    }
    const entry = byPattern.get(shaped.pattern);
    if (entry) entry.count += 1;
    else byPattern.set(shaped.pattern, { shaped, count: 1 });
  }

  const transcriptionRules = [...byPattern.entries()].map(([pattern, { shaped }]) =>
    makeRule(platform, pattern, shaped.direction, shaped.label, shaped.currency, shaped.category),
  );

const templateChecks = evaluate(templateRules, messages);
const templateMatched = templateChecks.filter((c) => c.matched).length;

const transcriptionChecks = evaluate(transcriptionRules, messages);
const transcriptionMatched = transcriptionChecks.filter((c) => c.matched).length;

// Templates generalise, so they win ties. Transcription only takes over when it
// genuinely reads more, which is the sign of wording nobody anticipated.
const useTemplate = templateMatched >= transcriptionMatched;
const matched = useTemplate ? templateMatched : transcriptionMatched;
  // Every template for a direction the sender actually uses is kept, including
  // ones the captured messages did not happen to exercise. A sender that has
  // sent "Cash Out ... Tk 1,000" may well next say "sent Tk 450 to your bKash
  // wallet", and without that second template the top-up would be filed as a
  // purchase. One unused row in the sources list is a far smaller cost than a
  // transfer counted as spending, which is the bug this whole feature is for.
  const rules = useTemplate ? templateRules : [...transcriptionRules];
const checks = useTemplate ? templateChecks : transcriptionChecks;

  for (const check of checks) {
    if (!check.matched && unshapedIds.has(check.messageId)) {
      check.problem = "no amount and no direction words found";
    }
  }

  if (!useTemplate && transcriptionMatched > 0) {
    notes.push(
      "This sender's wording does not look like the usual bank or wallet messages, so the rules were built from your messages verbatim. They will only read messages shaped like these.",
    );
  }
  if (templateRules.length === 0 && transcriptionRules.length === 0) {
    notes.push("None of these messages had an amount with words saying whether money went out or came in, so there is nothing to learn from them.");
  }
  if (unshaped > 0) {
    notes.push(
`${unshaped} of ${messages.length} message${unshaped === 1 ? "" : "s"} could not be read at all: no amount and no direction words.`,
    );
  }
  if (!useTemplate && unshaped === 0 && matched < messages.length) {
    // Both strategies tried and both fell short; say so rather than implying
    // the remaining messages were simply not important.
    notes.push(`${messages.length - matched} message${messages.length - matched === 1 ? "" : "s"} still cannot be read; check them and add the wording as a new rule if it matters.`);
  }

  for (const rule of rules) {
    if (!known.has(rule.defaultCurrency)) {
      notes.push(`No currency word was found, so these will be recorded as ${rule.defaultCurrency}.`);
      break;
    }
  }

  return {
    rules,
    checks,
    matched,
    total: messages.length,
    notes,
    complete: rules.length > 0 && matched === messages.length,
    strategy: rules.length === 0 ? "none" : useTemplate ? "template" : "transcription",
  };
}