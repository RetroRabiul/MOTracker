import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle,
  FileText,
  Loader2,
  Tag,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getTransactionById, updateTransaction } from "../services/transactionService";
import { CURRENCIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCurrencySymbol } from "../types/expense";

const EXPENSE_CHIPS: { label: string; icon: string }[] = [
  { label: "Travel", icon: "✈️" },
  { label: "Food", icon: "🍴" },
  { label: "Equipment", icon: "💻" },
  { label: "Utility Bills", icon: "⚡" },
  { label: "Salaries", icon: "👥" },
  { label: "Office Supplies", icon: "📎" },
  { label: "Marketing", icon: "📢" },
  { label: "Insurance", icon: "🛡️" },
  { label: "Rent", icon: "🏠" },
  { label: "Other", icon: "" },
];

const INCOME_CHIPS: { label: string; icon: string }[] = [
  { label: "Sales", icon: "🛒" },
  { label: "Services", icon: "🔧" },
  { label: "Investments", icon: "📈" },
  { label: "Salary", icon: "💰" },
  { label: "Freelance", icon: "💼" },
  { label: "Rental Income", icon: "🏘️" },
  { label: "Other", icon: "📦" },
];

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export default function EditTransaction() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, darkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [removeStoredReceipt, setRemoveStoredReceipt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const loadTransaction = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTransactionById(id);
      if (!data) {
        setNotFound(true);
        return;
      }
      setType(data.type);
      setAmount(data.amount.toString());
      setCurrency(data.currency || "USD");
      setDate(data.date);
      setCategory(data.category);
      setDescription(data.description || "");
      setReceiptPreview(data.receiptUrl ?? null);
    } catch (loadError) {
      console.error("Error loading transaction:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load transaction");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTransaction();
  }, [loadTransaction]);

  const chips = type === "expense" ? EXPENSE_CHIPS : INCOME_CHIPS;
  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_RECEIPT_BYTES) {
      setError("File size must be less than 5MB");
      return;
    }

    setReceiptFile(file);
    setRemoveStoredReceipt(false);
    const reader = new FileReader();
    reader.onloadend = () => setReceiptPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    setError("");
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setRemoveStoredReceipt(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than zero");
      return;
    }

    setError("");
    setSaving(true);

    try {
      await updateTransaction(
        id,
        {
          type,
          amount: parsedAmount,
          currency,
          date,
          category,
          description,
          ...(removeStoredReceipt ? { receiptUrl: null } : {}),
        },
        receiptFile ?? undefined,
      );
      setSuccess(true);
      setTimeout(() => navigate("/expenses"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: darkMode ? "#0f172a" : colors.primary + "08" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.primary }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-4"
        style={{ backgroundColor: darkMode ? "#0f172a" : colors.primary + "08" }}
      >
        <div
          className={`w-full max-w-sm rounded-2xl p-8 text-center shadow-sm ${darkMode ? "border border-gray-700" : ""}`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <FileText className={`mx-auto h-12 w-12 ${darkMode ? "text-gray-600" : "text-gray-300"}`} />
          <h2 className={`mt-4 text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Transaction not found
          </h2>
          <p className={`mt-2 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            It may have been deleted, or it belongs to another account.
          </p>
          <button
            onClick={() => navigate("/expenses")}
            className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: colors.primary }}
          >
            Back to Transactions
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center px-4 ${
          darkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
          <h2 className={`mt-4 text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Transaction Updated!
          </h2>
          <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Redirecting...</p>
        </div>
      </div>
    );
  }

  const cardClass = `rounded-xl p-6 shadow-sm transition-colors duration-200 ${
    darkMode ? "border border-gray-700" : ""
  }`;
  const cardStyle = { backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" };
  const labelClass = `mb-1.5 block text-sm font-medium ${
    darkMode ? "text-gray-300" : "text-gray-700"
  }`;
  const inputClass = `w-full rounded-lg border py-2.5 pl-10 pr-4 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
    darkMode
      ? "border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-primary-500"
      : "border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:bg-white"
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
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => navigate("/expenses")}
            aria-label="Back to transactions"
            className={`rounded-lg p-2 transition ${
              darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Edit Transaction
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={`${cardClass} p-4`} style={cardStyle}>
            <label className={labelClass}>Type</label>
            <div className={`flex rounded-lg p-1 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
              <button
                type="button"
                onClick={() => {
                  setType("expense");
                  setCategory("Other");
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition ${
                  type === "expense"
                    ? "text-white shadow-sm"
                    : darkMode
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
                style={type === "expense" ? { backgroundColor: colors.primary } : {}}
              >
                <TrendingDown className="h-4 w-4" />
                Expense
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("income");
                  setCategory("Other");
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition ${
                  type === "income"
                    ? "text-white shadow-sm"
                    : darkMode
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
                style={type === "income" ? { backgroundColor: colors.primary } : {}}
              >
                <TrendingUp className="h-4 w-4" />
                Income
              </button>
            </div>
          </div>

          <div className={cardClass} style={cardStyle}>
            <div className="mb-4">
              <label className={labelClass}>Amount</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                    {getCurrencySymbol(currency)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className={inputClass}
                  />
                </div>
                <div className="relative shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                    {getCurrencySymbol(currency)}
                  </span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    aria-label="Currency"
                    className={`w-28 appearance-none rounded-lg border py-2.5 pl-9 pr-8 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      darkMode
                        ? "border-gray-600 bg-gray-800 text-white focus:border-primary-500"
                        : "border-gray-300 bg-gray-50 text-gray-900 focus:border-primary-500 focus:bg-white"
                    }`}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Category</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className={`${inputClass} appearance-none pr-10`}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className={cardClass} style={cardStyle}>
            <label className={`mb-3 block text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              Quick Select Category
            </label>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => {
                const isActive = category === chip.label;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setCategory(chip.label)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? "text-white"
                        : darkMode
                          ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    style={isActive ? { backgroundColor: colors.primary } : {}}
                  >
                    <span>{chip.icon}</span>
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cardClass} style={cardStyle}>
            <label className={`mb-3 block text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              Receipt Photo (Optional)
            </label>

            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className={`w-full rounded-lg border ${darkMode ? "border-gray-700" : "border-gray-200"}`}
                />
                <button
                  type="button"
                  onClick={removeReceipt}
                  aria-label="Remove receipt"
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 transition ${
                    darkMode
                      ? "border-gray-600 bg-gray-800 hover:border-primary-500 hover:bg-gray-700"
                      : "border-gray-300 bg-gray-50 hover:border-primary-500 hover:bg-primary-50"
                  }`}
                >
                  <Camera className={`mb-2 h-8 w-8 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                  <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    Take Photo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 transition ${
                    darkMode
                      ? "border-gray-600 bg-gray-800 hover:border-primary-500 hover:bg-gray-700"
                      : "border-gray-300 bg-gray-50 hover:border-primary-500 hover:bg-primary-50"
                  }`}
                >
                  <Upload className={`mb-2 h-8 w-8 ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                  <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    Upload File
                  </span>
                </button>
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {removeStoredReceipt && (
              <p className={`mt-2 text-xs ${darkMode ? "text-red-400" : "text-red-600"}`}>
                The stored receipt will be deleted when you save.
              </p>
            )}

            <p className={`mt-2 text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
              Max file size: 5MB. Supported formats: JPG, PNG
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !amount}
            className="flex w-full items-center justify-center rounded-lg py-3 text-base font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: colors.primary }}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Transaction"}
          </button>
        </form>
      </main>
    </div>
  );
}
