import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Filter,
  Image,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { deleteTransaction, getTransactionsByUser } from "../services/transactionService";
import { useConvertedTransactions } from "../hooks/useConvertedTransactions";
import CurrencyWarning from "../components/CurrencyWarning";
import ConfirmDialog from "../components/ConfirmDialog";
import type { Transaction, TransactionType } from "../types/expense";
import {
  CATEGORY_COLORS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatCurrency,
  getCurrencySymbol,
} from "../types/expense";

/**
 * Rows rendered per batch. The list renders one card per transaction and the
 * API can return up to PostgREST's 1000-row page, so rendering everything at
 * once produces thousands of DOM nodes and stalls scrolling on a phone.
 */
const PAGE_SIZE = 30;

export default function ExpenseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors, darkMode } = useTheme();
  const { defaultCurrency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (typeFilter !== "All") {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }
    if (categoryFilter !== "All") {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term),
      );
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter, categoryFilter]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const remaining = filteredTransactions.length - visibleTransactions.length;

  // Changing the filters should start from the top of the new result set.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, typeFilter, categoryFilter, transactions]);

  const handleDelete = async (transactionId: string) => {
    setPendingDeleteId(transactionId);
  };

  const confirmDelete = async () => {
    const transactionId = pendingDeleteId;
    if (!transactionId) return;
    setPendingDeleteId(null);

    try {
      await deleteTransaction(transactionId);
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      setDeleteError("");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      setDeleteError("Failed to delete transaction. Please try again.");
    }
  };

  // Totals only include rows that were actually converted, so a missing rate
  // can never sneak into a total that is badged with the reporting currency.
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

  const allCategories = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

  const cardStyle = { backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" };
  const cardClass = `rounded-xl p-4 shadow-sm sm:p-5 transition-colors duration-200 ${
    darkMode ? "border border-gray-700" : ""
  }`;
  const badgeClass = `rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
    darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
  }`;

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{
        backgroundColor: darkMode ? "#0f172a" : colors.primary + "08",
        color: darkMode ? "#f1f5f9" : undefined,
      }}
    >
      <header
        className="pt-safe sticky top-0 z-10 border-b backdrop-blur transition-colors duration-200"
        style={{
          backgroundColor: darkMode ? "#1e293bE6" : colors.primary + "18",
          borderColor: darkMode ? "#334155" : undefined,
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              aria-label="Back to dashboard"
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className={`text-lg font-bold sm:text-xl ${darkMode ? "text-white" : "text-gray-900"}`}>
              Transactions
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/add-data")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: colors.primary }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Data</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pb-tabbar mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
        {deleteError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {deleteError}
            <button
              onClick={() => setDeleteError("")}
              aria-label="Dismiss"
              className="ml-2 font-bold hover:text-red-900"
            >
              &times;
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className={`text-xs sm:text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Income
              </p>
              <span className={badgeClass}>{defaultCurrency}</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 sm:text-2xl">
              <span className="mr-1 text-base font-semibold opacity-70">
                {getCurrencySymbol(defaultCurrency)}
              </span>
              {totalIncome.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className={`text-xs sm:text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Expenses
              </p>
              <span className={badgeClass}>{defaultCurrency}</span>
            </div>
            <p className="text-xl font-bold text-red-600 sm:text-2xl">
              <span className="mr-1 text-base font-semibold opacity-70">
                {getCurrencySymbol(defaultCurrency)}
              </span>
              {totalExpenses.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className={`${cardClass} col-span-2 sm:col-span-1`} style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className={`text-xs sm:text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Net
              </p>
              <span className={badgeClass}>{defaultCurrency}</span>
            </div>
            <p
              className="text-xl font-bold sm:text-2xl"
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

        <div
          className={`mb-4 rounded-xl p-4 shadow-sm sm:p-6 transition-colors duration-200 ${
            darkMode ? "border border-gray-700" : ""
          }`}
          style={cardStyle}
        >
          <div className="flex items-center justify-between">
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {filteredTransactions.length}{" "}
              {filteredTransactions.length === 1 ? "transaction" : "transactions"}
            </p>
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                darkMode
                  ? "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div
              className={`mt-4 pt-4 ${darkMode ? "border-t border-gray-700" : "border-t border-gray-200"}`}
            >
              <div className="mb-3">
                <label
                  className={`mb-1.5 block text-sm font-medium ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search transactions..."
                    className={`w-full rounded-lg border py-2 pl-10 pr-4 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      darkMode
                        ? "border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-primary-500"
                        : "border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:bg-white"
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className={`mb-1.5 block text-sm font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TransactionType | "All")}
                    className={`w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      darkMode
                        ? "border-gray-600 bg-gray-800 text-white focus:border-primary-500"
                        : "border-gray-300 bg-gray-50 text-gray-900 focus:border-primary-500 focus:bg-white"
                    }`}
                  >
                    <option value="All">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`mb-1.5 block text-sm font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={`w-full rounded-lg border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      darkMode
                        ? "border-gray-600 bg-gray-800 text-white focus:border-primary-500"
                        : "border-gray-300 bg-gray-50 text-gray-900 focus:border-primary-500 focus:bg-white"
                    }`}
                  >
                    <option value="All">All Categories</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

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

        {loadError ? (
          <div
            role="alert"
            className={`rounded-xl p-6 text-center shadow-sm ${
              darkMode ? "border border-red-800 bg-red-950/30" : "border border-red-200 bg-red-50"
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
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.primary }} />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div
            className={`rounded-xl p-12 text-center shadow-sm transition-colors duration-200 ${
              darkMode ? "border border-gray-700" : ""
            }`}
            style={cardStyle}
          >
            <Receipt className={`mx-auto h-16 w-16 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
            <h3 className={`mt-4 text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              No transactions yet
            </h3>
            <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {transactions.length === 0
                ? "Start by adding your first transaction"
                : "No transactions match your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTransactions.map((transaction) => {
              const converted = convertedById.get(transaction.id);
              return (
              <div
                key={transaction.id}
                className={`rounded-xl p-4 shadow-sm transition hover:shadow-md sm:p-5 ${
                  darkMode ? "border border-gray-700" : ""
                }`}
                style={cardStyle}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${
                          transaction.type === "income" ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <TrendingUp className="mr-1 h-3 w-3" />
                        ) : (
                          <TrendingDown className="mr-1 h-3 w-3" />
                        )}
                        {transaction.type}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: CATEGORY_COLORS[transaction.category] || "#6b7280" }}
                      >
                        {transaction.category}
                      </span>
                      <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {new Date(transaction.date).toLocaleDateString()}
                      </span>
                    </div>
                    {transaction.description && (
                      <p
                        className={`truncate text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                      >
                        {transaction.description}
                      </p>
                    )}
                    {transaction.receiptUrl && (
                      <a
                        href={transaction.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-2 inline-flex items-center gap-1 text-xs hover:underline`}
                        style={{ color: colors.primary }}
                      >
                        <Image className="h-3 w-3" />
                        View Receipt
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={`text-lg font-bold ${
                          transaction.type === "income" ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {converted
                          ? formatCurrency(converted.amount, defaultCurrency)
                          : formatCurrency(transaction.amount, transaction.currency)}
                      </span>
                      {transaction.currency !== defaultCurrency &&
                        (converted ? (
                          <span
                            className={`text-[11px] ${darkMode ? "text-gray-500" : "text-gray-400"}`}
                          >
                            was {formatCurrency(transaction.amount, transaction.currency)}
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] ${darkMode ? "text-amber-400" : "text-amber-600"}`}
                          >
                            not converted to {defaultCurrency}
                          </span>
                        ))}
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                      <button
                        onClick={() => navigate(`/edit-transaction/${transaction.id}`)}
                        aria-label="Edit transaction"
                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                          darkMode
                            ? "text-gray-400 hover:bg-blue-900/30 hover:text-blue-400"
                            : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        aria-label="Delete transaction"
                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                          darkMode
                            ? "text-gray-400 hover:bg-red-900/30 hover:text-red-400"
                            : "text-gray-400 hover:bg-red-50 hover:text-red-600"
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className={`flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                  darkMode
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Show {Math.min(remaining, PAGE_SIZE)} more
                <span className={darkMode ? "text-slate-500" : "text-gray-400"}>
                  ({remaining} remaining)
                </span>
              </button>
            )}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete transaction?"
        message="This permanently removes the entry and its receipt. This cannot be undone."
        confirmLabel="Delete"
        darkMode={darkMode}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
