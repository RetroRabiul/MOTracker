import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  List,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Receipt,
  Settings,
  Sun,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { getDisplayName, useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { getTransactionsByUser } from "../services/transactionService";
import { convertTransactions } from "../services/currencyService";
import type { Transaction } from "../types/expense";
import { formatCurrency, getCurrencySymbol } from "../types/expense";

type TimeRange = "week" | "month" | "all";

interface ChartPoint {
  date: string;
  income: number;
  expense: number;
}

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

const INCOME_COLOR = "#10b981";
const EXPENSE_COLOR = "#ef4444";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { colors, darkMode, toggleDarkMode } = useTheme();
  const { defaultCurrency } = useSettings();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [convertedTransactions, setConvertedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

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

  const {
    totalIncome,
    totalExpenses,
    netBalance,
    incomeCount,
    expenseCount,
    activeCategories,
    chartData,
  } = useMemo(() => {
    const now = new Date();

    let startDate: Date;
    let endDate: Date;
    if (timeRange === "week") {
      startDate = startOfWeek(now);
      endDate = endOfWeek(now);
    } else if (timeRange === "month") {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else {
      startDate = startOfYear(now);
      endDate = endOfYear(now);
    }

    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");

    const source = convertedTransactions.length > 0 ? convertedTransactions : transactions;
    const filtered = source.filter((t) => t.date >= startStr && t.date <= endStr);

    const incomeEntries = filtered.filter((t) => t.type === "income");
    const expenseEntries = filtered.filter((t) => t.type === "expense");

    const inc = incomeEntries.reduce((s, t) => s + t.amount, 0);
    const exp = expenseEntries.reduce((s, t) => s + t.amount, 0);
    const cats = new Set(filtered.map((t) => t.category)).size;

    let chart: ChartPoint[] = [];

    if (timeRange === "week") {
      chart = eachDayOfInterval({ start: startDate, end: endDate }).map((date) => {
        const dayT = filtered.filter((t) => t.date === format(date, "yyyy-MM-dd"));
        return {
          date: format(date, "EEE"),
          income: dayT.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expense: dayT.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        };
      });
    } else if (timeRange === "month") {
      chart = eachWeekOfInterval({ start: startDate, end: endDate }).map((weekStart) => {
        const ws = format(weekStart, "yyyy-MM-dd");
        const we = format(endOfWeek(weekStart), "yyyy-MM-dd");
        const weekT = filtered.filter((t) => t.date >= ws && t.date <= we);
        return {
          date: `W${format(weekStart, "w")}`,
          income: weekT.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expense: weekT.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        };
      });
    } else {
      chart = eachMonthOfInterval({ start: startDate, end: endDate }).map((monthStart) => {
        const ms = format(monthStart, "yyyy-MM-dd");
        const me = format(endOfMonth(monthStart), "yyyy-MM-dd");
        const monthT = filtered.filter((t) => t.date >= ms && t.date <= me);
        return {
          date: format(monthStart, "MMM"),
          income: monthT.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expense: monthT.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        };
      });
    }

    return {
      totalIncome: inc,
      totalExpenses: exp,
      netBalance: inc - exp,
      incomeCount: incomeEntries.length,
      expenseCount: expenseEntries.length,
      activeCategories: cats,
      chartData: chart,
    };
  }, [transactions, convertedTransactions, timeRange]);

  const cardStyle = { backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" };
  const badgeClass = `ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
    darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
  }`;

  const amount = (value: number) => (
    <>
      <span className="mr-1 text-lg font-semibold opacity-70">
        {getCurrencySymbol(defaultCurrency)}
      </span>
      {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </>
  );

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.primary }}
            >
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
              ExpenseTracker
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className={`hidden text-sm sm:block ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              {user?.email}
            </span>
            <button
              onClick={toggleDarkMode}
              className={`rounded-lg p-2 transition ${
                darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
              }`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => void logout()}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                darkMode
                  ? "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Welcome back, {getDisplayName(user)}!
          </h2>
          <p className={`mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Manage your business expenses
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.primary }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  Overview
                </h3>
                <div
                  className={`flex rounded-lg border p-0.5 ${
                    darkMode ? "border-gray-600 bg-gray-800" : "border-gray-300 bg-white"
                  }`}
                >
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setTimeRange(r.key)}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                        timeRange === r.key
                          ? "text-white"
                          : darkMode
                            ? "text-gray-400 hover:text-white"
                            : "text-gray-600 hover:text-gray-900"
                      }`}
                      style={timeRange === r.key ? { backgroundColor: colors.primary } : {}}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${
                  darkMode ? "border-gray-700" : "border-gray-200"
                }`}
                style={cardStyle}
              >
                <h4 className={`mb-4 text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  Cashflow Trend
                </h4>
                {chartData.length === 0 ||
                chartData.every((d) => d.income === 0 && d.expense === 0) ? (
                  <div className="flex h-56 items-center justify-center">
                    <p className="text-sm text-gray-500">No transaction data available for charts</p>
                  </div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={darkMode ? "#334155" : "#f0f0f0"}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          stroke={darkMode ? "#64748b" : "#9ca3af"}
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke={darkMode ? "#64748b" : "#9ca3af"}
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: darkMode ? "#1e293b" : "white",
                            border: `1px solid ${darkMode ? "#334155" : "#e5e7eb"}`,
                            borderRadius: "0.5rem",
                            color: darkMode ? "#f1f5f9" : "#1f2937",
                            fontSize: "12px",
                          }}
                          formatter={(value: unknown) => formatCurrency(Number(value), defaultCurrency)}
                        />
                        <Line
                          type="monotone"
                          dataKey="income"
                          stroke={INCOME_COLOR}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: "#fff", stroke: INCOME_COLOR, strokeWidth: 2.5 }}
                          activeDot={{ r: 7, fill: INCOME_COLOR, stroke: "#fff", strokeWidth: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="expense"
                          stroke={EXPENSE_COLOR}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: "#fff", stroke: EXPENSE_COLOR, strokeWidth: 2.5 }}
                          activeDot={{ r: 7, fill: EXPENSE_COLOR, stroke: "#fff", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  className={`rounded-xl p-5 shadow-sm transition-colors duration-200 ${
                    darkMode ? "border border-gray-700" : ""
                  }`}
                  style={cardStyle}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span
                      className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}
                    >
                      Total Income
                    </span>
                    <span className={badgeClass}>{defaultCurrency}</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{amount(totalIncome)}</p>
                  <p className={`mt-1 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    {incomeCount} income entries
                  </p>
                </div>

                <div
                  className={`rounded-xl p-5 shadow-sm transition-colors duration-200 ${
                    darkMode ? "border border-gray-700" : ""
                  }`}
                  style={cardStyle}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span
                      className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}
                    >
                      Total Expenses
                    </span>
                    <span className={badgeClass}>{defaultCurrency}</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{amount(totalExpenses)}</p>
                  <p className={`mt-1 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    {expenseCount} expenses
                  </p>
                </div>

                <div
                  className={`rounded-xl p-5 shadow-sm transition-colors duration-200 ${
                    darkMode ? "border border-gray-700" : ""
                  }`}
                  style={cardStyle}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Receipt className="h-4 w-4" style={{ color: colors.primary }} />
                    <span
                      className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-600"}`}
                    >
                      Net Balance
                    </span>
                    <span className={badgeClass}>{defaultCurrency}</span>
                  </div>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: netBalance >= 0 ? colors.primary : "#dc2626" }}
                  >
                    {amount(netBalance)}
                  </p>
                  <p className={`mt-1 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    {activeCategories} active categories
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/add-data")}
                className="flex w-full items-center gap-4 rounded-xl p-5 text-left text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: colors.primary }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Add Data</h3>
                  <p className="text-sm text-white/80">Income, expense, category &amp; receipt</p>
                </div>
              </button>

              <button
                onClick={() => navigate("/expenses")}
                className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${
                  darkMode ? "border-gray-700" : ""
                }`}
                style={{
                  borderColor: colors.primary + "40",
                  backgroundColor: darkMode ? "#1e293b" : colors.primary + "08",
                }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <List className="h-6 w-6" style={{ color: colors.primary }} />
                </div>
                <div>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    All Transactions
                  </h3>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Browse, search &amp; filter
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate("/analytics")}
                className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${
                  darkMode ? "border-gray-700" : ""
                }`}
                style={{
                  borderColor: colors.primary + "40",
                  backgroundColor: darkMode ? "#1e293b" : colors.primary + "08",
                }}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                    darkMode ? "bg-emerald-900/40" : "bg-emerald-50"
                  }`}
                >
                  <BarChart3
                    className="h-6 w-6"
                    style={{ color: darkMode ? "#34d399" : "#059669" }}
                  />
                </div>
                <div>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    Analytics
                  </h3>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Charts &amp; insights
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate("/settings")}
                className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${
                  darkMode ? "border-gray-700" : ""
                }`}
                style={{
                  borderColor: colors.primary + "40",
                  backgroundColor: darkMode ? "#1e293b" : colors.primary + "08",
                }}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                    darkMode ? "bg-purple-900/40" : "bg-purple-50"
                  }`}
                >
                  <Settings
                    className="h-6 w-6"
                    style={{ color: darkMode ? "#c4b5fd" : "#7c3aed" }}
                  />
                </div>
                <div>
                  <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    Settings
                  </h3>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Theme, export &amp; more
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
