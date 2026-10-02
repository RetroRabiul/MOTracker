import { normaliseBody, type SmsRule } from "./smsParser";

const RULES_KEY = "sms_import_rules_v1";
const SEEN_KEY = "sms_import_seen_v1";
const AUTO_CAPTURE_KEY = "sms_import_auto_capture_v1";

/**
 * Whether the native receiver should watch for new messages from configured
 * senders while the app is closed.
 *
 * Defaults to on: the user asked for messages to be picked up automatically,
 * and it only ever applies to senders they listed. It has no effect without the
 * SMS permission, and capture still only queues messages for review.
 */
export function loadAutoCapture(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_CAPTURE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function saveAutoCapture(enabled: boolean): boolean {
  try {
    localStorage.setItem(AUTO_CAPTURE_KEY, enabled ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

/**
 * Starter rules.
 *
 * These are a starting point, not verified truth: bKash and bank wording varies
 * by product, language and operator version, and the whole point of the rules
 * screen is that the user can correct them. They are deliberately written to
 * fail closed - if the wording drifts, the pattern stops matching and the
 * message is left for review rather than imported with a wrong amount.
 */
export const STARTER_RULES: SmsRule[] = [
  {
    id: "bkash-sent",
    label: "bKash - money sent",
    direction: "expense",
    sender: "bKash",
    pattern:
      "(?:you have sent|you sent|sent)[\\s\u09f3]*(?:tk|taka)?[\\s\u09f3]*(?<amount>[\\d,.]+)\\s*(?:tk|taka|\u09f3)?[^.]{0,40}?\\bto\\b\\s*(?<merchant>[A-Za-z][A-Za-z &'.-]{0,60})",
    defaultCurrency: "BDT",
    category: "Transfer",
    enabled: true,
  },
  {
    id: "bkash-received",
    label: "bKash - money received",
    direction: "income",
    sender: "bKash",
    pattern:
      "(?:you have received|you received|received)[\\s\u09f3]*(?:tk|taka)?[\\s\u09f3]*(?<amount>[\\d,.]+)\\s*(?:tk|taka|\u09f3)?[^.]{0,40}?\\bfrom\\b\\s*(?<merchant>[A-Za-z][A-Za-z &'.-]{0,60})",
    defaultCurrency: "BDT",
    category: "Transfer",
    enabled: true,
  },
  {
    id: "bkash-cashout",
    label: "bKash - cash out",
    direction: "expense",
    sender: "bKash",
    pattern:
      "cash\\s*out[^.]{0,60}?(?<amount>[\\d,.]+)[^.]{0,40}?(?:from\\s+)?(?:agent|point)\\s*[:\\-]?\\s*(?<merchant>[A-Za-z][A-Za-z &'.-]{0,60})",
    defaultCurrency: "BDT",
    category: "Cash",
    enabled: true,
  },
  {
    id: "bank-debit",
    label: "Bank - account debit",
    direction: "expense",
    sender: "",
    pattern:
      "(?:debit|dr|withdrawn|withdrawal|paid|purchase|pos)\\b[^0-9]{0,40}(?<amount>[\\d,.]+)\\s*(?:pkr|bdt|usd|inr|rs|tk|\u09f3)?[^.]{0,30}?(?:to\\s+)?(?<merchant>[A-Za-z][A-Za-z &'.-]{0,60})",
    defaultCurrency: "USD",
    category: "Transfer",
    enabled: true,
  },
  {
    id: "bank-credit",
    label: "Bank - account credit",
    direction: "income",
    sender: "",
    pattern:
      "(?:credit|cr|received|salary|refund)\\b[^0-9]{0,40}(?<amount>[\\d,.]+)\\s*(?:pkr|bdt|usd|inr|rs|tk|\u09f3)?[^.]{0,30}?(?:from\\s+)?(?<merchant>[A-Za-z][A-Za-z &'.-]{0,60})",
    defaultCurrency: "USD",
    category: "Transfer",
    enabled: true,
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Rules are device-local on purpose: they describe this handset's SMS inbox, so
 * there is nothing meaningful to sync to another device or another user.
 */
export function loadRules(): SmsRule[] {
  const stored = readJson<SmsRule[]>(RULES_KEY, []);
  if (!Array.isArray(stored) || stored.length === 0) {
    return STARTER_RULES.map((r) => ({ ...r }));
  }
  // Drop anything that is not a usable rule rather than failing the whole list.
  return stored.filter(
    (r) => r && typeof r.id === "string" && typeof r.pattern === "string" && typeof r.sender === "string",
  );
}

export function saveRules(rules: SmsRule[]): boolean {
  return writeJson(RULES_KEY, rules);
}

export function resetRules(): SmsRule[] {
  const fresh = STARTER_RULES.map((r) => ({ ...r }));
  saveRules(fresh);
  return fresh;
}

export function newRuleId(): string {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * A minimal skeleton for the rules editor. The amount group is the only thing
 * that matters: everything else the user fills in or corrects.
 */
export function createBlankRule(): SmsRule {
  return {
    id: newRuleId(),
    label: "New rule",
    direction: "expense",
    sender: "",
    pattern: "(?<amount>[\\d,.]+)",
    defaultCurrency: "USD",
    category: "Other",
    enabled: true,
  };
}

/**
 * Senders the inbox scan should ask the native layer for. Blank senders are
 * excluded, and duplicates are collapsed after normalisation so `+8801...` and
 * `0180...` are not both requested.
 */
export function activeSenders(rules: SmsRule[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const sender = normaliseBody(rule.sender);
    if (!sender) continue;
    const key = sender.replace(/[^\dA-Za-z]/g, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sender);
  }
  return out;
}

/** Message ids already imported or dismissed, so a rescan cannot duplicate. */
export function loadSeenIds(): Set<string> {
  return new Set(readJson<string[]>(SEEN_KEY, []));
}

export function rememberSeenIds(ids: Iterable<string>): boolean {
  const existing = readJson<string[]>(SEEN_KEY, []);
  const merged = new Set([...existing, ...ids]);
  // Bounded: a user who scans for years should not grow this forever.
  const trimmed = [...merged].slice(-2000);
  return writeJson(SEEN_KEY, trimmed);
}

export function clearSeenIds(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // Nothing to clear.
  }
}
