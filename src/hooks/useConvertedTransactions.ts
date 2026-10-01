import { useEffect, useState } from "react";
import type { Transaction } from "../types/expense";
import { convertTransactions, type ConversionResult } from "../services/currencyService";

const EMPTY: ConversionResult = {
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

export type ConversionState = ConversionResult & {
  /** True while a conversion attempt for the current input is in flight. */
  pending: boolean;
  /**
   * Totals are only trustworthy once conversion has settled. Rendering raw
   * amounts under a target-currency badge is how figures silently change.
   */
  ready: boolean;
  /** Re-runs conversion, bypassing the cached rate table. */
  retry: () => void;
};

/**
 * Converts transactions into `targetCurrency`, exposing exactly how much of
 * the data could be converted so callers can exclude it from totals.
 */
export function useConvertedTransactions(
  transactions: Transaction[],
  targetCurrency: string,
): ConversionState {
  const [result, setResult] = useState<ConversionResult>(EMPTY);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const hasData = transactions.length > 0;
  // A retry is a user asking for fresh rates, so it must skip the 1h cache.
  // Later attempts reuse cached rates, which is the normal path.
  const force = attempt > 0;

  useEffect(() => {
    if (!hasData) return;

    let cancelled = false;
    setPending(true);
    void convertTransactions(transactions, targetCurrency, { force })
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        setPending(false);
      })
      .catch(() => {
        // convertTransactions reports failures through `error`; this is only a
        // guard so a bug there cannot surface as an unhandled rejection.
        if (cancelled) return;
        setResult(EMPTY);
        setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transactions, targetCurrency, attempt, hasData, force]);

  // With no rows there is nothing to convert, so derive the empty state during
  // render rather than writing state from inside the effect.
  const state = hasData ? result : EMPTY;

  return {
    ...state,
    pending: hasData && pending,
    ready: !hasData || (!pending && state.all.length > 0),
    retry: () => setAttempt((n) => n + 1),
  };
}
