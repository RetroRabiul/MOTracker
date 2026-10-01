import type { Transaction } from "../types/expense";

// Bumped to v3: the v1/v2 caches were written by a provider chain whose primary
// source 404s, so they can hold a 29-currency ECB table while the app expects
// full coverage. A stale entry must not survive a provider change.
const CACHE_KEY = "expense_rates_v3";
const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const BASE = "USD";

/**
 * A provider payload is only trusted once it carries at least this many
 * non-USD rates. A 404 that returns `{}` would otherwise look like a
 * successful fetch and poison the cache for an hour.
 */
const MIN_TRUSTED_RATES = 5;

/**
 * Cross-rate sanity bounds for anchor currencies, as `units per 1 USD`.
 * These are deliberately loose - they exist to reject structurally wrong
 * payloads (percent-as-fraction, inverted quotes, decimal shifts), not to
 * second-guess real market moves.
 */
const ANCHOR_BOUNDS: ReadonlyArray<readonly [string, number, number]> = [
  ["EUR", 0.5, 2],
  ["GBP", 0.4, 2],
  ["JPY", 50, 400],
  ["INR", 20, 300],
];

const PROVIDERS: ReadonlyArray<{
  name: string;
  url: string;
  /** Coarse coverage tier, used to rank equally-valid responses. */
  tier: "broad" | "narrow";
  pick: (payload: unknown) => { rates: unknown; asOf: string | null };
}> = [
  {
    // 160+ currencies, CORS `*`, no key. Reports HTTP 200 with
    // `result: "error"` on quota exhaustion, so the result flag is checked.
    name: "er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    tier: "broad",
    pick: (payload) => {
      const body = payload as { result?: unknown; rates?: unknown; time_last_update_utc?: unknown };
      if (body?.result !== "success") throw new Error("provider reported failure");
      return {
        rates: body.rates,
        asOf: typeof body.time_last_update_utc === "string" ? body.time_last_update_utc : null,
      };
    },
  },
  {
    // Same upstream data on a separate host, so an outage at one still leaves
    // the other. `base`/`date` carry the quote date.
    name: "exchangerate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    tier: "broad",
    pick: (payload) => {
      const body = payload as { rates?: unknown; base?: unknown; date?: unknown };
      if (typeof body?.base === "string" && body.base.toUpperCase() !== BASE) {
        throw new Error(`unexpected base ${body.base}`);
      }
      return {
        rates: body?.rates,
        asOf: typeof body?.date === "string" ? body.date : null,
      };
    },
  },
  {
    // ECB reference rates: only ~30 currencies, but they are the reference
    // benchmark. Kept last as a correctness backstop, not as coverage.
    name: "frankfurter",
    url: "https://api.frankfurter.app/latest?from=USD",
    tier: "narrow",
    pick: (payload) => {
      const body = payload as { rates?: unknown; base?: unknown; date?: unknown };
      if (typeof body?.base === "string" && body.base.toUpperCase() !== BASE) {
        throw new Error(`unexpected base ${body.base}`);
      }
      return {
        rates: body?.rates,
        asOf: typeof body?.date === "string" ? body.date : null,
      };
    },
  },
];

export interface RateCache {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
  /** Provider that produced the table, for diagnostics. */
  provider: string;
  /** Quote date reported by the provider, when it exposes one. */
  asOf: string | null;
}

export interface RateResult {
  rates: Record<string, number>;
  /** Rates came from an expired cache because no provider could be reached. */
  stale: boolean;
  /** Human-readable reason no live rates were available, or null. */
  error: string | null;
  /** Provider that supplied the accepted table, or null when none did. */
  provider: string | null;
  /** Quote date reported by the provider, or the cache write time. */
  asOf: string | null;
}

export interface ConversionResult {
  /** Transactions converted into `targetCurrency`. */
  converted: Transaction[];
  /** Transactions left untouched because no rate was available. */
  unconverted: Transaction[];
  /** Every transaction, for list rendering - nothing is ever hidden. */
  all: Transaction[];
  unconvertedIds: Set<string>;
  /** Distinct currency codes that could not be converted, sorted. */
  unconvertedCurrencies: string[];
  /** true when rates came from an expired cache. */
  stale: boolean;
  /** Human-readable reason live rates were unavailable, or null. */
  error: string | null;
  /** Provider that supplied the rates actually used. */
  provider: string | null;
  /** Quote date of the rates actually used, or null. */
  asOf: string | null;
}

function isUsableRateMap(value: unknown): value is Record<string, number> {
  if (typeof value !== "object" || value === null) return false;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([code]) => code.toUpperCase() !== BASE,
  );
  if (entries.length < MIN_TRUSTED_RATES) return false;
  return entries.every(
    ([, rate]) => typeof rate === "number" && Number.isFinite(rate) && rate > 0,
  );
}

/**
 * Rejects structurally wrong tables before they can reach the cache. A payload
 * that passes `isUsableRateMap` can still be quoted against the wrong base or
 * scaled by 100, and either mistake silently corrupts every total.
 */
function hasPlausibleAnchors(rates: Record<string, number>): boolean {
  return ANCHOR_BOUNDS.every(([code, min, max]) => {
    const rate = rates[code];
    if (typeof rate !== "number") return true; // narrow tables may omit anchors
    return rate >= min && rate <= max;
  });
}

function normalizeRates(raw: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(raw)) {
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      rates[code.toUpperCase()] = rate;
    }
  }
  rates[BASE] = 1;
  return rates;
}

function readCache(): { fresh: RateCache | null; stale: RateCache | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { fresh: null, stale: null };
    const parsed = JSON.parse(raw) as Partial<RateCache>;
    if (!isUsableRateMap(parsed?.rates)) return { fresh: null, stale: null };
    const rates = normalizeRates(parsed.rates);
    if (!hasPlausibleAnchors(rates)) return { fresh: null, stale: null };
    const cache: RateCache = {
      base: parsed.base ?? BASE,
      rates,
      timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : 0,
      provider: typeof parsed.provider === "string" ? parsed.provider : "cache",
      asOf: typeof parsed.asOf === "string" ? parsed.asOf : null,
    };
    return Date.now() - cache.timestamp > CACHE_TTL_MS
      ? { fresh: null, stale: cache }
      : { fresh: cache, stale: null };
  } catch {
    return { fresh: null, stale: null };
  }
}

function writeCache(
  rates: Record<string, number>,
  provider: string,
  asOf: string | null,
): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        base: BASE,
        rates,
        timestamp: Date.now(),
        provider,
        asOf,
      } satisfies RateCache),
    );
  } catch {
    // A blocked or full localStorage must never break currency conversion.
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type ProviderAttempt =
  | { ok: true; rates: Record<string, number>; provider: string; asOf: string | null }
  | { ok: false; provider: string; reason: string };

async function tryProvider(provider: (typeof PROVIDERS)[number]): Promise<ProviderAttempt> {
  try {
    const payload = await fetchJson(provider.url);
    const { rates: raw, asOf } = provider.pick(payload);
    if (!isUsableRateMap(raw)) {
      return { ok: false, provider: provider.name, reason: "unusable response" };
    }
    const rates = normalizeRates(raw);
    if (!hasPlausibleAnchors(rates)) {
      return { ok: false, provider: provider.name, reason: "implausible rates" };
    }
    return { ok: true, rates, provider: provider.name, asOf };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    return { ok: false, provider: provider.name, reason };
  }
}

function tierOf(provider: string): "broad" | "narrow" {
  return PROVIDERS.find((p) => p.name === provider)?.tier ?? "narrow";
}

/**
 * Two-phase race. Broad-coverage providers go out concurrently and the first
 * success ends the race immediately; a narrow provider is only requested if
 * every broad one failed.
 *
 * This matters more than it looks. The narrow fallback is also the one host
 * that refuses cross-origin requests from the Capacitor `https://localhost`
 * origin, so eagerly requesting it produced a CORS failure in the console on
 * every single native launch even though the rates it was meant to back up were
 * never needed. Deferring it also means the happy path costs two requests, not
 * three.
 */
function raceProviders(): Promise<ProviderAttempt[]> {
  const settled = new Map<string, ProviderAttempt>();
  const started = new Set<string>();
  let inFlight = 0;
  let done = false;
  let guard: ReturnType<typeof setTimeout> | undefined;

  return new Promise<ProviderAttempt[]>((resolve) => {
    const finish = () => {
      if (done) return;
      done = true;
      if (guard) clearTimeout(guard);
      resolve(
        PROVIDERS.map((p) => settled.get(p.name)).filter((a): a is ProviderAttempt => !!a),
      );
    };
    // Backstop so a hung transport can never leave the UI pending forever.
    guard = setTimeout(finish, REQUEST_TIMEOUT_MS + 1500);

    const start = (list: ReadonlyArray<(typeof PROVIDERS)[number]>) => {
      for (const provider of list) {
        if (started.has(provider.name)) continue;
        started.add(provider.name);
        inFlight++;
        void tryProvider(provider).then((attempt) => {
          inFlight--;
          settled.set(provider.name, attempt);

          if (attempt.ok && tierOf(attempt.provider) === "broad") {
            finish();
            return;
          }
          if (inFlight > 0) return;

          const pendingNarrow = PROVIDERS.filter(
            (p) => p.tier === "narrow" && !started.has(p.name),
          );
          if (pendingNarrow.length > 0) start(pendingNarrow);
          else finish();
        });
      }
    };

    start(PROVIDERS.filter((p) => p.tier === "broad"));
  });
}

/**
 * Resolves a USD-based rate table.
 *
 * Providers are queried concurrently and the broadest usable response wins, so
 * a narrow-but-correct table (ECB covers ~30 currencies) can never pre-empt a
 * full-coverage one.
 */
export async function fetchRates(options?: { force?: boolean }): Promise<RateResult> {
  const { fresh, stale } = readCache();
  if (fresh && !options?.force) {
    return {
      rates: fresh.rates,
      stale: false,
      error: null,
      provider: fresh.provider,
      asOf: fresh.asOf,
    };
  }

  const attempts = await raceProviders();
  const resolved = resolveAttempts(attempts);
  if (resolved) return resolved;

  // Everything failed. A merely old table still beats no table at all, and
  // `stale` is what tells the UI to say so.
  const reason = `Live exchange rates are unavailable (${describeFailures(attempts)})`;
  if (stale) {
    return {
      rates: stale.rates,
      stale: true,
      error: reason,
      provider: stale.provider,
      asOf: stale.asOf,
    };
  }
  return { rates: { [BASE]: 1 }, stale: false, error: reason, provider: null, asOf: null };
}

/** Picks the broadest usable response, then the earliest-listed one on a tie. */
function resolveAttempts(attempts: ProviderAttempt[]): RateResult | null {
  const successes = attempts.filter((a): a is Extract<ProviderAttempt, { ok: true }> => a.ok);
  if (successes.length === 0) return null;

  const order = new Map(PROVIDERS.map((p, i) => [p.name, i] as const));
  const winner = successes.reduce((a, b) => {
    const aTier = tierOf(a.provider);
    const bTier = tierOf(b.provider);
    // Broad coverage wins; within a tier the earlier provider wins.
    if (aTier !== bTier) return aTier === "broad" ? a : b;
    return (order.get(a.provider) ?? 0) <= (order.get(b.provider) ?? 0) ? a : b;
  });

  writeCache(winner.rates, winner.provider, winner.asOf);
  return {
    rates: winner.rates,
    stale: false,
    error: null,
    provider: winner.provider,
    asOf: winner.asOf,
  };
}

function describeFailures(attempts: ProviderAttempt[]): string {
  return attempts
    .filter((a): a is Extract<ProviderAttempt, { ok: false }> => !a.ok)
    .map((a) => `${a.provider}: ${a.reason}`)
    .join("; ");
}

/**
 * Returns the converted amount, or `null` when a rate is missing.
 * Callers must handle `null` - guessing here would misreport money.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number | null {
  const from = (fromCurrency || BASE).toUpperCase();
  const to = (toCurrency || BASE).toUpperCase();
  if (from === to) return amount;

  const fromRate = rates[from];
  const toRate = rates[to];
  if (
    typeof fromRate !== "number" ||
    typeof toRate !== "number" ||
    fromRate <= 0 ||
    toRate <= 0
  ) {
    return null;
  }
  return (amount / fromRate) * toRate;
}

/**
 * Converts what it can and reports what it could not, so the UI can exclude
 * unverifiable amounts from totals and say so instead of quietly relabelling.
 */
export async function convertTransactions(
  transactions: Transaction[],
  targetCurrency: string,
  options?: { force?: boolean },
): Promise<ConversionResult> {
  const target = (targetCurrency || BASE).toUpperCase();

  if (transactions.length === 0) {
    return {
      converted: [],
      unconverted: [],
      all: [],
      unconvertedIds: new Set<string>(),
      unconvertedCurrencies: [],
      stale: false,
      error: null,
      provider: null,
      asOf: null,
    };
  }

  const { rates, stale, error, provider, asOf } = await fetchRates(options);
  const converted: Transaction[] = [];
  const unconverted: Transaction[] = [];
  const unconvertedIds = new Set<string>();
  const missingCurrencies = new Set<string>();

  for (const transaction of transactions) {
    const amount = convertAmount(transaction.amount, transaction.currency || BASE, target, rates);
    if (amount === null) {
      unconverted.push(transaction);
      unconvertedIds.add(transaction.id);
      missingCurrencies.add((transaction.currency || BASE).toUpperCase());
      continue;
    }
    converted.push({ ...transaction, amount, currency: target });
  }

  return {
    converted,
    unconverted,
    all: [...converted, ...unconverted],
    unconvertedIds,
    unconvertedCurrencies: [...missingCurrencies].sort(),
    stale,
    // Gating this on `converted.length === 0` hid the real reason whenever a
    // single USD row converted cleanly while every foreign row failed, which is
    // exactly the case a user needs explained.
    error: unconverted.length > 0 ? error : null,
    provider,
    asOf,
  };
}
