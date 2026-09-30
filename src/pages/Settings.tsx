import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTransactionsByUser } from "../services/transactionService";
import { exportToCSV, exportToExcel, exportToPDF } from "../services/exportService";
import { useTheme, type ColorPalette } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { CURRENCIES } from "../types/expense";
import {
  ArrowLeft,
  Palette,
  FileSpreadsheet,
  FileText,
  File,
  Download,
  Loader2,
  LogOut,
  Check,
  Cloud,
  Moon,
  Sun,
  Coins,
} from "lucide-react";

const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

const paletteOptions: { key: ColorPalette; label: string; color: string }[] = [
  { key: "amethyst", label: "Amethyst", color: "#8b5cf6" },
  { key: "emerald", label: "Emerald", color: "#10b981" },
  { key: "ruby", label: "Ruby", color: "#f43f5e" },
  { key: "oceanic", label: "Oceanic", color: "#0ea5e9" },
  { key: "orange", label: "Orange", color: "#f97316" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { palette, setPalette, colors, darkMode, toggleDarkMode } = useTheme();
  const { defaultCurrency, setDefaultCurrency } = useSettings();
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    if (!user) return;
    setExporting(format);
    try {
      const data = await getTransactionsByUser(user.id);
      if (data.length === 0) {
        alert("No transactions to export");
        return;
      }
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `transactions_${timestamp}`;

      switch (format) {
        case "csv":
          exportToCSV(data, filename);
          break;
        case "excel":
          exportToExcel(data, filename);
          break;
        case "pdf":
          await exportToPDF(data, filename, defaultCurrency);
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: darkMode ? "#020617" : colors.primary + "08" }}
    >
      <header
        className={`border-b ${darkMode ? "border-slate-800" : "border-gray-200"}`}
        style={{ backgroundColor: darkMode ? "#0f172a" : colors.primary + "12" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => navigate("/")}
            aria-label="Back to dashboard"
            className={`rounded-lg p-2 transition ${
              darkMode ? "text-gray-300 hover:bg-slate-800" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div
          className={`rounded-xl border p-6 shadow-sm transition-colors duration-200 ${
            darkMode ? "border-slate-700" : "border-transparent"
          }`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                Appearance
              </h3>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Switch between light and dark interfaces
              </p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                darkMode
                  ? "border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 shadow-sm transition-colors duration-200 ${
            darkMode ? "border-slate-700" : "border-transparent"
          }`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <Coins className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                Default Currency
              </h3>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                All totals and charts will be shown in this currency
              </p>
            </div>
          </div>

          <select
            value={defaultCurrency}
            onChange={(e) => setDefaultCurrency(e.target.value)}
            className={`w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
              darkMode
                ? "border-slate-600 bg-slate-800 text-white focus:border-primary-500"
                : "border-gray-300 bg-gray-50 text-gray-900 focus:border-primary-500 focus:bg-white"
            }`}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <div
          className={`rounded-xl border p-6 shadow-sm transition-colors duration-200 ${
            darkMode ? "border-slate-700" : "border-transparent"
          }`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <Palette className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                App Color Palette
              </h3>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Choose your preferred theme color
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {paletteOptions.map((p) => (
              <button
                key={p.key}
                onClick={() => setPalette(p.key)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${
                  palette === p.key
                    ? "border-current"
                    : darkMode
                      ? "border-transparent hover:border-slate-700"
                      : "border-transparent hover:border-gray-200"
                }`}
                style={palette === p.key ? { color: p.color, borderColor: p.color } : {}}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: p.color + "20" }}
                >
                  <div className="h-5 w-5 rounded-full" style={{ backgroundColor: p.color }} />
                </div>
                <span className={`text-xs font-medium ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                  {p.label}
                </span>
                {palette === p.key && <Check className="h-3.5 w-3.5" style={{ color: p.color }} />}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 shadow-sm transition-colors duration-200 ${
            darkMode ? "border-slate-700" : "border-transparent"
          }`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <Download className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                Export Data
              </h3>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Download your transactions in any format
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition disabled:opacity-60 ${
                darkMode
                  ? "border-slate-700 bg-slate-900/70 hover:bg-slate-800"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <File className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  CSV
                </p>
                <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Spreadsheet apps
                </p>
              </div>
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                <Download className={`h-4 w-4 ${darkMode ? "text-gray-400" : "text-gray-400"}`} />
              )}
            </button>

            <button
              onClick={() => void handleExport("excel")}
              disabled={exporting !== null}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition disabled:opacity-60 ${
                darkMode
                  ? "border-slate-700 bg-slate-900/70 hover:bg-slate-800"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  Excel
                </p>
                <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>.xlsx format</p>
              </div>
              {exporting === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <Download className={`h-4 w-4 ${darkMode ? "text-gray-400" : "text-gray-400"}`} />
              )}
            </button>

            <button
              onClick={() => void handleExport("pdf")}
              disabled={exporting !== null}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition disabled:opacity-60 ${
                darkMode
                  ? "border-slate-700 bg-slate-900/70 hover:bg-slate-800"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  PDF
                </p>
                <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  For investors
                </p>
              </div>
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <Download className={`h-4 w-4 ${darkMode ? "text-gray-400" : "text-gray-400"}`} />
              )}
            </button>
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 shadow-sm transition-colors duration-200 ${
            darkMode ? "border-slate-700" : "border-transparent"
          }`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <Cloud className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <h3 className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                Cloud Backup
              </h3>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                All data is synced to Supabase
              </p>
            </div>
          </div>
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-4 py-2 ${
              darkMode ? "bg-emerald-900/30" : "bg-emerald-50"
            }`}
          >
            <Check className="h-4 w-4 text-emerald-600" />
            <span className={`text-sm ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>
              Synced and backed up
            </span>
          </div>
        </div>

        <button
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-600 transition hover:bg-red-100"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        <div className="mt-4">
          <h3 className={`mb-2 text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            App Download
          </h3>
          <p className={`mb-2 text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Install the Android APK directly on your phone.
          </p>
          {isAndroid ? (
            <a
              href="/app.apk"
              download
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download APK
            </a>
          ) : (
            <a
              href="/app.apk"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              <Download className="h-4 w-4" />
              Download APK (open on Android to install)
            </a>
          )}
          <p className={`mt-2 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
            A signed release APK is available at <span className="font-mono">/public/app.apk</span>.
          </p>
        </div>

        <p className={`text-center text-xs ${darkMode ? "text-slate-500" : "text-gray-400"}`}>
          ExpenseTracker v1.0
        </p>
      </main>
    </div>
  );
}
