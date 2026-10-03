import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { getTransactionsByUser } from "../services/transactionService";
import { useConvertedTransactions } from "../hooks/useConvertedTransactions";
import CurrencyWarning from "../components/CurrencyWarning";
import Toast, { type ToastTone } from "../components/Toast";
import { exportToCSV, exportToExcel, exportToPDF } from "../services/exportService";
import type { Transaction, TransactionType } from "../types/expense";
import { getCurrencySymbol } from "../types/expense";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  File,
  Loader2,
  Calendar,
  Filter,
  RefreshCw,
} from "lucide-react";

export default function Export() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors, darkMode } = useTheme();
  const { defaultCurrency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "week" | "month">("all");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "All">("All");
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      setTransactions(await getTransactionsByUser(user.id));
    } catch (error) {
      console.error("Error loading transactions:", error);
      setLoadError(error instanceof Error ? error.message : "Could not load your transactions.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const conversion = useConvertedTransactions(transactions, defaultCurrency);

  const getFilteredTransactions = useCallback(() => {
    let filtered = transactions;

    if (typeFilter !== "All") {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }

    if (dateRange !== "all") {
      const now = new Date();
      const cutoff = new Date();
      if (dateRange === "week") {
        cutoff.setDate(now.getDate() - 7);
      } else if (dateRange === "month") {
        cutoff.setMonth(now.getMonth() - 1);
      }
      filtered = filtered.filter((t) => new Date(t.date) >= cutoff);
    }

    return filtered;
  }, [transactions, typeFilter, dateRange]);

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(format);
    try {
      const filtered = getFilteredTransactions();
      if (filtered.length === 0) {
        setToast({ tone: "info", message: "No transactions match the selected filters." });
        return;
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `transactions_${timestamp}`;

      switch (format) {
        case "csv":
          exportToCSV(filtered, filename);
          break;
        case "excel":
          exportToExcel(filtered, filename);
          break;
        case "pdf":
          await exportToPDF(filtered, filename, defaultCurrency);
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      setToast({ tone: "error", message: "Export failed. Please try again." });
    } finally {
      setExporting(null);
    }
  };

  const filteredTransactions = getFilteredTransactions();

  // Preview totals only sum rows that were actually converted, matching what
  // the PDF will report. CSV and Excel carry each row's own currency instead.
  const convertedById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const t of conversion.converted) {
      map.set(t.id, t);
    }
    return map;
  }, [conversion.converted]);

  const totalIncome = filteredTransactions
    .map((t) => convertedById.get(t.id))
    .filter((t): t is Transaction => t?.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions
    .map((t) => convertedById.get(t.id))
    .filter((t): t is Transaction => t?.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: darkMode ? "#020617" : colors.primary + "08" }}
    >
      <header
        className={`pt-safe sticky top-0 z-10 border-b backdrop-blur transition-colors duration-200 ${
          darkMode ? "border-slate-800" : "border-gray-200"
        }`}
        style={{ backgroundColor: darkMode ? "#0f172aE6" : colors.primary + "18" }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
              darkMode ? "text-gray-300 hover:bg-slate-800" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className={`text-lg font-bold sm:text-xl ${darkMode ? "text-white" : "text-gray-900"}`}>
            Export Data
          </h1>
        </div>
      </header>

      <main className="pb-tabbar mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
        {loadError ? (
          <div
            role="alert"
            className={`rounded-xl border p-6 text-center shadow-sm ${
              darkMode ? "border-red-800 bg-red-950/30" : "border-red-200 bg-red-50"
            }`}
          >
            <p className={`text-sm font-semibold ${darkMode ? "text-red-200" : "text-red-900"}`}>
              We could not load your transactions
            </p>
            <p className={`mt-1 text-sm ${darkMode ? "text-red-300/80" : "text-red-700"}`}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadTransactions()}
              className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                darkMode
                  ? "border-red-700 text-red-200 hover:bg-red-900/40"
                  : "border-red-300 text-red-800 hover:bg-red-100"
              }`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <CurrencyWarning
              unconvertedCurrencies={conversion.unconvertedCurrencies}
              targetCurrency={defaultCurrency}
              count={conversion.unconverted.length}
              stale={conversion.stale}
              pending={conversion.pending}
              provider={conversion.provider}
              asOf={conversion.asOf}
              onRetry={conversion.retry}
              darkMode={darkMode}
            />
            <div
              className={`mb-6 rounded-xl border p-4 shadow-sm transition-colors duration-200 sm:p-6 ${
                darkMode ? "border-slate-700" : "border-transparent"
              }`}
              style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
            >
              {/*
                Three stacked label/value rows on phones: a 3-column grid
                leaves ~100px per cell, which clips any amount over 999.99.
              */}
              <div className="mb-4 flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-4">
                {[
                  { label: "Income", value: totalIncome, color: "text-emerald-600" },
                  { label: "Expenses", value: totalExpenses, color: "text-red-600" },
                  {
                    label: "Net",
                    value: totalIncome - totalExpenses,
                    color: totalIncome - totalExpenses >= 0 ? colors.primary : "#dc2626",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2 sm:block"
                  >
                    <div className="flex items-center gap-2">
                      <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {label}
                      </p>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {defaultCurrency}
                      </span>
                    </div>
                    <p
                      className={`text-lg font-bold tabular-nums sm:mt-1 sm:text-xl ${color}`}
                    >
                      <span className="mr-1 text-base font-semibold opacity-70">
                        {getCurrencySymbol(defaultCurrency)}
                      </span>
                      {value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    className={`mb-1.5 block text-sm font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <Calendar className="mr-1 inline h-4 w-4" />
                    Date Range
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                    className={`w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      darkMode
                        ? "border-slate-700 bg-slate-800 text-slate-100 focus:bg-slate-900"
                        : "border-gray-300 bg-gray-50 text-gray-900 focus:bg-white"
                    }`}
                  >
                    <option value="all">All Time</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>
                </div>

                <div>
                  <label
                    className={`mb-1.5 block text-sm font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <Filter className="mr-1 inline h-4 w-4" />
                    Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TransactionType | "All")}
                    className={`w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      darkMode
                        ? "border-slate-700 bg-slate-800 text-slate-100 focus:bg-slate-900"
                        : "border-gray-300 bg-gray-50 text-gray-900 focus:bg-white"
                    }`}
                  >
                    <option value="All">All Types</option>
                    <option value="income">Income Only</option>
                    <option value="expense">Expenses Only</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div
                className={`rounded-xl border p-12 text-center shadow-sm transition-colors duration-200 ${
                  darkMode ? "border-slate-700" : "border-transparent"
                }`}
                style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
              >
                <FileText
                  className={`mx-auto h-16 w-16 ${darkMode ? "text-slate-600" : "text-gray-300"}`}
                />
                <h3 className={`mt-4 text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  No transactions to export
                </h3>
                <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Add transactions first or adjust your filters
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <button
                  onClick={() => void handleExport("excel")}
                  disabled={exporting !== null}
                  className={`rounded-xl border p-6 text-left shadow-sm transition hover:shadow-md disabled:opacity-60 ${
                    darkMode ? "border-slate-700 hover:shadow-slate-900/40" : "border-transparent"
                  }`}
                  style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
                >
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: colors.primary + "15" }}
                  >
                    <FileSpreadsheet className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    Export to Excel
                  </h3>
                  <p className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Download as .xlsx for spreadsheet analysis
                  </p>
                  <div
                    className="mt-4 flex items-center gap-2 text-sm font-medium"
                    style={{ color: colors.primary }}
                  >
                    {exporting === "excel" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exporting === "excel" ? "Exporting..." : "Download"}
                  </div>
                </button>

                <button
                  onClick={() => void handleExport("csv")}
                  disabled={exporting !== null}
                  className={`rounded-xl border p-6 text-left shadow-sm transition hover:shadow-md disabled:opacity-60 ${
                    darkMode ? "border-slate-700 hover:shadow-slate-900/40" : "border-transparent"
                  }`}
                  style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
                >
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: colors.primary + "15" }}
                  >
                    <File className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    Export to CSV
                  </h3>
                  <p className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Universal format for any spreadsheet app
                  </p>
                  <div
                    className="mt-4 flex items-center gap-2 text-sm font-medium"
                    style={{ color: colors.primary }}
                  >
                    {exporting === "csv" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exporting === "csv" ? "Exporting..." : "Download"}
                  </div>
                </button>

                <button
                  onClick={() => void handleExport("pdf")}
                  disabled={exporting !== null}
                  className={`rounded-xl border p-6 text-left shadow-sm transition hover:shadow-md disabled:opacity-60 ${
                    darkMode ? "border-slate-700 hover:shadow-slate-900/40" : "border-transparent"
                  }`}
                  style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
                >
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: colors.primary + "15" }}
                  >
                    <FileText className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    Export to PDF
                  </h3>
                  <p className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Professional reports for investors
                  </p>
                  <div
                    className="mt-4 flex items-center gap-2 text-sm font-medium"
                    style={{ color: colors.primary }}
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exporting === "pdf" ? "Exporting..." : "Download"}
                  </div>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {toast && (
        <Toast
          tone={toast.tone}
          message={toast.message}
          darkMode={darkMode}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
