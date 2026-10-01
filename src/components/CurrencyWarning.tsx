import { AlertTriangle, RefreshCw } from "lucide-react";

interface CurrencyWarningProps {
  unconvertedCurrencies: string[];
  targetCurrency: string;
  count: number;
  stale: boolean;
  pending: boolean;
  /** Provider that supplied the rates in use, e.g. `er-api`. */
  provider: string | null;
  /** Quote date reported by the provider, e.g. `2026-10-01`. */
  asOf: string | null;
  onRetry: () => void;
  darkMode: boolean;
}

/** Renders a provider date as a short, locale-independent day. */
function formatAsOf(asOf: string | null): string | null {
  if (!asOf) return null;
  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) return asOf;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Shown when some or all transactions could not be converted. Without this the
 * alternative is either hiding data or relabelling it, which is worse.
 */
export default function CurrencyWarning({
  unconvertedCurrencies,
  targetCurrency,
  count,
  stale,
  pending,
  provider,
  asOf,
  onRetry,
  darkMode,
}: CurrencyWarningProps) {
  if (count === 0) return null;

  const currencies = unconvertedCurrencies.join(", ") || targetCurrency;
  const rateDate = formatAsOf(asOf);
  const source = [provider, rateDate ? `rates dated ${rateDate}` : null]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        darkMode ? "border-amber-700 bg-amber-950/40" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`mt-0.5 h-5 w-5 shrink-0 ${darkMode ? "text-amber-400" : "text-amber-600"}`}
          aria-hidden="true"
        />
        <div>
          <p className={`text-sm font-semibold ${darkMode ? "text-amber-200" : "text-amber-900"}`}>
            {count === 1 ? "1 transaction is" : `${count} transactions are`} not converted
          </p>
          <p className={`mt-0.5 text-sm ${darkMode ? "text-amber-300/80" : "text-amber-800"}`}>
            {stale
              ? "Showing the last saved exchange rates. "
              : "Live exchange rates could not be loaded. "}
            Totals exclude {currencies}. Those rows still show their original amount.
          </p>
          {source && (
            <p className={`mt-1 text-xs ${darkMode ? "text-amber-300/60" : "text-amber-800/70"}`}>
              Source: {source}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={pending}
        aria-busy={pending}
        className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
          darkMode
            ? "border-amber-700 text-amber-200 hover:bg-amber-900/40"
            : "border-amber-400 text-amber-900 hover:bg-amber-100"
        }`}
      >
        <RefreshCw
          className={`h-4 w-4 ${pending ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {pending ? "Retrying" : "Retry"}
      </button>
    </div>
  );
}
