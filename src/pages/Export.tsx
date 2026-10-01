import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { getTransactionsByUser } from "../services/transactionService";
import { convertTransactions } from "../services/currencyService";
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
} from "lucide-react";

export default function Export() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors, darkMode } = useTheme();
  const { defaultCurrency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [convertedTransactions, setConvertedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "week" | "month">("all");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "All">("All");

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setTransactions(await getTransactionsByUser(user.id));
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    if (transactions.length === 0) {
      setConvertedTransactions([]);
      return;
    }
    let cancelled = false;
    convertTransactions(transactions, defaultCurrency).then((converted) => {
      if (!cancelled) setConvertedTransactions(converted);
    });
    return () => {
      cancelled = true;
    };
  }, [transactions, defaultCurrency]);

  const getFilteredTransactions = () => {
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
  };

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(format);
    try {
      const filtered = getFilteredTransactions();
      if (filtered.length === 0) {
        alert("No transactions to export");
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
      alert("Failed to export. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const filteredTransactions = getFilteredTransactions();
  const convertedAmounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of convertedTransactions) {
      map.set(t.id, t.amount);
    }
    return map;
  }, [convertedTransactions]);

  const getAmount = (t: Transaction) => convertedAmounts.get(t.id) ?? t.amount;

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + getAmount(t), 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + getAmount(t), 0);

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: darkMode ? "#020617" : colors.primary + "08" }}
    >
      <header
        className={`border-b ${darkMode ? "border-slate-800" : "border-gray-200"}`}
        style={{ backgroundColor: darkMode ? "#0f172a" : colors.primary + "12" }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
            className={`rounded-lg p-2 transition ${
              darkMode ? "text-gray-300 hover:bg-slate-800" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Export Data
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div
              className={`mb-6 rounded-xl border p-6 shadow-sm transition-colors duration-200 ${
                darkMode ? "border-slate-700" : "border-transparent"
              }`}
              style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
            >
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                      Income
                    </p>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {defaultCurrency}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">
                    <span className="mr-1 text-base font-semibold opacity-70">
                      {getCurrencySymbol(defaultCurrency)}
                    </span>
                    {totalIncome.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                      Expenses
                    </p>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {defaultCurrency}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    <span className="mr-1 text-base font-semibold opacity-70">
                      {getCurrencySymbol(defaultCurrency)}
                    </span>
                    {totalExpenses.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Net</p>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {defaultCurrency}
                    </span>
                  </div>
                  <p
                    className="text-xl font-bold"
                    style={{ color: totalIncome - totalExpenses >= 0 ? colors.primary : "#dc2626" }}
                  >
                    <span className="mr-1 text-base font-semibold opacity-70">
                      {getCurrencySymbol(defaultCurrency)}
                    </span>
                    {(totalIncome - totalExpenses).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
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
    </div>
  );
}
