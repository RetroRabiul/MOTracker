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
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { deleteTransaction, getTransactionsByUser } from "../services/transactionService";
import { convertTransactions } from "../services/currencyService";
import type { Transaction, TransactionType } from "../types/expense";
import {
  CATEGORY_COLORS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatCurrency,
  getCurrencySymbol,
} from "../types/expense";

export default function ExpenseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors, darkMode } = useTheme();
  const { defaultCurrency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [convertedTransactions, setConvertedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const handleDelete = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      await deleteTransaction(transactionId);
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      setDeleteError("");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      setDeleteError("Failed to delete transaction. Please try again.");
    }
  };

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

  const allCategories = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

  const cardStyle = { backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" };
  const cardClass = `rounded-xl p-4 shadow-sm sm:p-5 transition-colors duration-200 ${
    darkMode ? "border border-gray-700" : ""
  }`;
  const badgeClass = `rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
        className="sticky top-0 z-10 border-b transition-colors duration-200"
        style={{
          backgroundColor: darkMode ? "#1e293b" : colors.primary + "12",
          borderColor: darkMode ? "#334155" : undefined,
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              aria-label="Back to dashboard"
              className={`rounded-lg p-2 transition ${
                darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
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

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
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

        {loading ? (
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
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className={`rounded-xl p-4 shadow-sm transition hover:shadow-md sm:p-5 ${
                  darkMode ? "border border-gray-700" : ""
                }`}
                style={cardStyle}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-lg font-bold ${
                        transaction.type === "income" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                    <button
                      onClick={() => navigate(`/edit-transaction/${transaction.id}`)}
                      aria-label="Edit transaction"
                      className={`rounded-lg p-2 transition ${
                        darkMode
                          ? "text-gray-400 hover:bg-blue-900/30 hover:text-blue-400"
                          : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleDelete(transaction.id)}
                      aria-label="Delete transaction"
                      className={`rounded-lg p-2 transition ${
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
