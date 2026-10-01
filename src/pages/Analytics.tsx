import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Home,
  Laptop,
  Loader2,
  RefreshCw,
  Package,
  Plane,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { getTransactionsByUser } from "../services/transactionService";
import { useConvertedTransactions } from "../hooks/useConvertedTransactions";
import CurrencyWarning from "../components/CurrencyWarning";
import type { Transaction } from "../types/expense";
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatCurrency } from "../types/expense";
import { compactAxisValue } from "../lib/formatChartAxis";

type TimeRange = "week" | "month" | "all";

interface ChartPoint {
  date: string;
  income: number;
  expense: number;
}

interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

const EXPENSE_ICONS: Record<string, ReactNode> = {
  Travel: <Plane className="h-4 w-4" />,
  Food: <UtensilsCrossed className="h-4 w-4" />,
  Equipment: <Laptop className="h-4 w-4" />,
  "Utility Bills": <Zap className="h-4 w-4" />,
  Salaries: <Users className="h-4 w-4" />,
  Other: <Package className="h-4 w-4" />,
};

const INCOME_ICONS: Record<string, ReactNode> = {
  Sales: <Briefcase className="h-4 w-4" />,
  Services: <Users className="h-4 w-4" />,
  Investments: <TrendingUp className="h-4 w-4" />,
  Salary: <Briefcase className="h-4 w-4" />,
  Freelance: <Laptop className="h-4 w-4" />,
  "Rental Income": <Home className="h-4 w-4" />,
  Other: <Package className="h-4 w-4" />,
};

const INCOME_COLOR = "#10b981";
const EXPENSE_COLOR = "#ef4444";

export default function Analytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors, darkMode } = useTheme();
  const { defaultCurrency } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

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

  const { expenseCategoryData, incomeCategoryData, lineData } = useMemo(() => {
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

    // Only converted rows may be charted, otherwise figures change once rates land.
    const filtered = conversion.converted.filter((t) => t.date >= startStr && t.date <= endStr);

    const expenseSlices: CategorySlice[] = EXPENSE_CATEGORIES.map((category) => ({
      name: category,
      value: filtered
        .filter((t) => t.type === "expense" && t.category === category)
        .reduce((s, t) => s + t.amount, 0),
      color: CATEGORY_COLORS[category] ?? "#6b7280",
    })).filter((item) => item.value > 0);

    const incomeSlices: CategorySlice[] = INCOME_CATEGORIES.map((category) => ({
      name: category,
      value: filtered
        .filter((t) => t.type === "income" && t.category === category)
        .reduce((s, t) => s + t.amount, 0),
      color: CATEGORY_COLORS[category] ?? "#6b7280",
    })).filter((item) => item.value > 0);

    let daily: ChartPoint[] = [];

    if (timeRange === "week") {
      daily = eachDayOfInterval({ start: startDate, end: endDate }).map((date) => {
        const dayT = filtered.filter((t) => t.date === format(date, "yyyy-MM-dd"));
        return {
          date: format(date, "EEE"),
          income: dayT.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expense: dayT.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        };
      });
    } else if (timeRange === "month") {
      daily = eachWeekOfInterval({ start: startDate, end: endDate }).map((weekStart) => {
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
      daily = eachMonthOfInterval({ start: startDate, end: endDate }).map((monthStart) => {
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
      expenseCategoryData: expenseSlices,
      incomeCategoryData: incomeSlices,
      lineData: daily,
    };
  }, [conversion.converted, timeRange]);

  const tooltipStyle = {
    backgroundColor: darkMode ? "#1e293b" : "white",
    border: `1px solid ${darkMode ? "#334155" : "#e5e7eb"}`,
    borderRadius: "0.5rem",
    color: darkMode ? "#f1f5f9" : "#1f2937",
    fontSize: "12px",
  };

  const cardStyle = { backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" };
  const panelClass = `rounded-2xl border p-5 transition-colors duration-200 ${
    darkMode ? "border-gray-700" : "border-gray-200"
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
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
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
              Financial Analytics
            </h1>
          </div>
          {/*
            Scrollable rather than wrapping: four range buttons on a 360px
            screen would otherwise push the title off the row.
          */}
          <div
            role="group"
            aria-label="Time range"
            className={`-mx-4 flex overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:rounded-lg sm:border sm:p-0.5 sm:px-0 ${
              darkMode ? "sm:border-gray-700 sm:bg-gray-800" : "sm:border-gray-300 sm:bg-white"
            }`}
          >
            <div className="flex shrink-0 gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setTimeRange(r.key)}
                  aria-pressed={timeRange === r.key}
                  className={`min-h-[2.75rem] shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition sm:min-h-0 sm:border-0 sm:px-3 ${
                    timeRange === r.key
                      ? "border-transparent text-white"
                      : darkMode
                        ? "border-gray-700 bg-gray-800 text-gray-400 sm:bg-transparent"
                        : "border-gray-300 bg-white text-gray-600 sm:bg-transparent"
                  }`}
                  style={timeRange === r.key ? { backgroundColor: colors.primary } : {}}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="pb-tabbar mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
        {loadError ? (
          <div
            role="alert"
            className={`rounded-2xl border p-6 text-center ${
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
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.primary }} />
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
              className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
                darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
              }`}
            >
              <span>All amounts shown in</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  darkMode ? "bg-gray-700 text-gray-300" : "bg-white text-gray-600 shadow-sm"
                }`}
              >
                {defaultCurrency}
              </span>
            </div>

            <div className={panelClass} style={cardStyle}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  Income vs Expenses
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className={darkMode ? "text-gray-400" : "text-gray-600"}>Income</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className={darkMode ? "text-gray-400" : "text-gray-600"}>Expenses</span>
                  </span>
                </div>
              </div>
              {lineData.length === 0 || lineData.every((d) => d.income === 0 && d.expense === 0) ? (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-sm text-gray-500">No transaction data available for charts</p>
                </div>
              ) : (
                <div className="h-60 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
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
                          tickFormatter={compactAxisValue}
                          width={44}
                        />
                      <Tooltip
                        contentStyle={tooltipStyle}
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

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={panelClass} style={cardStyle}>
                <h3
                  className={`mb-4 text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}
                >
                  Expenses Category Breakdown
                </h3>
                {expenseCategoryData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center">
                    <p className="text-sm text-gray-500">No expenses recorded yet to show breakdown</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex items-center justify-center">
                      <div className="h-40 w-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={expenseCategoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="none"
                            >
                              {expenseCategoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(value: unknown) =>
                                formatCurrency(Number(value), defaultCurrency)
                              }
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {EXPENSE_CATEGORIES.map((cat) => {
                        const value = expenseCategoryData.find((c) => c.name === cat)?.value ?? 0;
                        const color = CATEGORY_COLORS[cat] || "#6b7280";
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg"
                              style={{ backgroundColor: color + "20", color }}
                            >
                              {EXPENSE_ICONS[cat] ?? <Package className="h-4 w-4" />}
                            </div>
                            <span
                              className={`flex-1 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {cat}
                            </span>
                            <span
                              className={`text-sm font-medium ${
                                darkMode ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {formatCurrency(value, defaultCurrency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className={panelClass} style={cardStyle}>
                <h3
                  className={`mb-4 text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}
                >
                  Income Category Breakdown
                </h3>
                {incomeCategoryData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center">
                    <p className="text-sm text-gray-500">No income recorded yet to show breakdown</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex items-center justify-center">
                      <div className="h-40 w-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={incomeCategoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="none"
                            >
                              {incomeCategoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(value: unknown) =>
                                formatCurrency(Number(value), defaultCurrency)
                              }
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {INCOME_CATEGORIES.map((cat) => {
                        const value = incomeCategoryData.find((c) => c.name === cat)?.value ?? 0;
                        const color = CATEGORY_COLORS[cat] || "#6b7280";
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg"
                              style={{ backgroundColor: color + "20", color }}
                            >
                              {INCOME_ICONS[cat] ?? <Package className="h-4 w-4" />}
                            </div>
                            <span
                              className={`flex-1 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {cat}
                            </span>
                            <span
                              className={`text-sm font-medium ${
                                darkMode ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {formatCurrency(value, defaultCurrency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
