/**
 * Platforms: the senders the user has connected.
 *
 * A platform is a name plus the sender addresses or numbers it answers from,
 * e.g. `bKash` with `["bKash", "bKash-DM"]`. Rules attach to a platform rather
 * than repeating its numbers, so connecting a service means typing its number
 * once and every rule for that service follows.
 *
 * Like the rules themselves, platforms are device-local: they describe this
 * handset's inbox, so there is nothing meaningful to sync elsewhere.
 */

/**
 * Light folding only. Platform numbers are typed by the user, so the Bengali
 * numeral mapping that message bodies need is irrelevant here. Importing it
 * anyway would make this module and smsParser depend on each other at runtime,
 * and the cycle would be load-bearing for no good reason.
 */
function tidy(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const PLATFORMS_KEY = "sms_import_platforms_v1";
const TIMES_KEY = "sms_import_platform_times_v1";

export interface SmsPlatform {
  id: string;
  /** Human name, e.g. "bKash". Shown in the rules list and scan summary. */
  name: string;
  /**
   * Sender addresses or numbers this platform answers from. A number is
   * reconciled across `+8801...`, `8801...` and `01...` forms, and an
   * alphanumeric sender such as "bKash" matches case-insensitively.
   */
  numbers: string[];
  enabled: boolean;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
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

/** Same comparison the inbox and broadcast matching uses, so ids line up. */
function numberKey(value: string): string {
  return tidy(value).replace(/[^\dA-Za-z]/g, "").toLowerCase();
}

export function newPlatformId(): string {
  return `platform-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankPlatform(): SmsPlatform {
  return { id: newPlatformId(), name: "", numbers: [""], enabled: true };
}

/** Drops blanks and collapses case/format duplicates, preserving order. */
export function cleanNumbers(numbers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of numbers) {
    const value = tidy(raw);
    const key = numberKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function isPlatform(value: unknown): value is SmsPlatform {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<SmsPlatform>;
  return typeof p.id === "string" && Array.isArray(p.numbers);
}

export function loadPlatforms(): SmsPlatform[] {
  const stored = readJson<SmsPlatform[]>(PLATFORMS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isPlatform).map((p) => ({
    id: p.id,
    name: typeof p.name === "string" ? p.name : "",
    numbers: cleanNumbers(p.numbers.map(String)),
    enabled: p.enabled !== false,
  }));
}

export function savePlatforms(platforms: SmsPlatform[]): boolean {
  const cleaned = platforms.map((p) => ({ ...p, numbers: cleanNumbers(p.numbers) }));
  return writeJson(PLATFORMS_KEY, cleaned);
}

export function findPlatform(platforms: SmsPlatform[], id: string): SmsPlatform | undefined {
  return platforms.find((p) => p.id === id);
}

/** Every address a platform listens to, as configured. */
export function platformNumbers(platforms: SmsPlatform[], id: string): string[] {
  const platform = findPlatform(platforms, id);
  if (!platform || !platform.enabled) return [];
  return platform.numbers;
}

/**
 * Builds platforms out of the senders stored on rules.
 *
 * Rules used to hold their own `sender` string, so anyone who set the feature
 * up before platforms existed has a working sender with nothing to attach it
 * to. Rather than lose that configuration, each distinct legacy sender becomes
 * a platform named after it and the rule points at the new one. Manual rules,
 * which had a blank sender and never scanned the inbox, are left unattached.
 */
export function platformsFromLegacySenders(
  rules: Array<{ platformId?: string; sender?: string }>,
  existing: SmsPlatform[],
): { platforms: SmsPlatform[]; migrated: number } {
  const platforms = [...existing];
  const byNumber = new Map<string, string>();
  for (const platform of platforms) {
    for (const number of platform.numbers) byNumber.set(numberKey(number), platform.id);
  }

  let migrated = 0;
  for (const rule of rules) {
    if (rule.platformId) continue;
    const sender = (rule.sender ?? "").trim();
    if (!sender) continue;

    const key = numberKey(sender);
    let id = byNumber.get(key);
    if (!id) {
      id = newPlatformId();
      const name = tidy(sender);
      platforms.push({ id, name, numbers: [name], enabled: true });
      byNumber.set(key, id);
    }
    rule.platformId = id;
    migrated++;
  }
  return { platforms, migrated };
}

/**
 * When each platform last had a transaction imported.
 *
 * This drives the "up to date" wording after a scan. It is deliberately not used
 * to decide what to skip: the per-message seen list does that, so a failed
 * import can never make a message unreachable. Treating a timestamp as a
 * cutoff is what would risk losing money.
 */
export function loadImportTimes(): Record<string, number> {
  const stored = readJson<Record<string, number>>(TIMES_KEY, {});
  if (!stored || typeof stored !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(stored)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) out[id] = value;
  }
  return out;
}

export function saveImportTimes(times: Record<string, number>): boolean {
  return writeJson(TIMES_KEY, times);
}

/** Records the newest point in time a platform has reached, never moving back. */
export function rememberImport(platformId: string, at: number): boolean {
  if (!platformId || !Number.isFinite(at) || at <= 0) return false;
  const times = loadImportTimes();
  if (times[platformId] !== undefined && times[platformId] >= at) return true;
  times[platformId] = at;
  return saveImportTimes(times);
}

/** Clears every platform's import time, e.g. when the user forgets history. */
export function clearImportTimes(): void {
  try {
    localStorage.removeItem(TIMES_KEY);
  } catch {
    // Nothing to clear.
  }
}