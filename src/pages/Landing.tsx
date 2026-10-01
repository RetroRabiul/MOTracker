import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  Coins,
  Download,
  LogIn,
  Menu,
  Moon,
  Receipt,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const YEAR = new Date().getFullYear();

interface Plan {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

/** Placeholder pricing. Edit here; limits are not enforced by the app yet. */
const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Everything you need to start tracking.",
    features: [
      "20 transactions added per month",
      "2 PDF exports per month",
      "10 receipt photos per month",
      "Unlimited CSV & Excel exports",
      "One reporting currency",
      "Community email support",
    ],
    cta: "Create free account",
  },
  {
    name: "Pro",
    price: "$4.99",
    period: "per month",
    tagline: "No limits, for people who take it seriously.",
    features: [
      "Unlimited transactions",
      "Unlimited PDF, Excel & CSV exports",
      "Unlimited receipt photos",
      "All currencies with live conversion",
      "All 5 accent themes, light & dark",
      "Priority email support",
    ],
    cta: "Start 14-day free trial",
    highlighted: true,
  },
  {
    name: "Lifetime",
    price: "$79",
    period: "one-time",
    tagline: "Pay once, keep everything, forever.",
    features: [
      "Everything in Pro, permanently",
      "No recurring billing, ever",
      "Early access to new features",
      "Works with every future update",
      "90-day refund window",
      "Support for the life of the product",
    ],
    cta: "Buy Lifetime",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Add entries in seconds",
    body: "Type, tap a category, done. Income and expenses with date, amount, currency and notes.",
  },
  {
    icon: Camera,
    title: "Receipt photos",
    body: "Attach a photo of any receipt. Files are stored privately and only you can open them.",
  },
  {
    icon: Coins,
    title: "Multi-currency totals",
    body: "Log amounts in any currency and see every total converted into the one you care about.",
  },
  {
    icon: BarChart3,
    title: "Charts that answer questions",
    body: "Income vs expenses over time, plus per-category breakdowns for where the money went.",
  },
  {
    icon: Download,
    title: "Export anywhere",
    body: "Download any filtered range as CSV, Excel, or a formatted PDF report for your accountant.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Every row and file is locked to your account at the database level. Not just hidden in the UI.",
  },
];

const FAQS = [
  {
    q: "What counts as a transaction?",
    a: "One income or expense entry, with an amount, date and category. Editing an existing entry never uses another one from your monthly limit.",
  },
  {
    q: "Is my financial data private?",
    a: "Yes. Access is enforced by database-level security rules tied to your account, so your entries and receipts are unreadable to anyone else, including us.",
  },
  {
    q: "What happens when I hit a limit?",
    a: "Nothing is deleted. You keep everything you have entered, you just cannot add or export more until your allowance resets on the 1st, or you upgrade.",
  },
  {
    q: "Can I cancel the paid plan?",
    a: "Any time. You drop back to the Free plan and keep all of your data, which is never held hostage to a subscription.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan needs no card. If you upgrade, you can cancel within the trial and pay nothing.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const { colors, darkMode, toggleDarkMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const cardStyle = { backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" };
  const cardClass = `rounded-2xl border shadow-xl transition-colors duration-200 ${
    darkMode ? "border-slate-700" : "border-gray-200"
  }`;
  const primaryButton = `inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2`;
  const secondaryButton = `inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 ${
    darkMode
      ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
  }`;

  const sectionHeading = `text-2xl font-bold sm:text-3xl ${darkMode ? "text-white" : "text-gray-900"}`;
  const mutedText = darkMode ? "text-slate-400" : "text-gray-500";

  return (
    <div
      className="min-h-screen"
      style={{
        background: darkMode
          ? "linear-gradient(135deg, #020617 0%, #111827 40%, #1f2937 100%)"
          : `linear-gradient(135deg, ${colors.primary}10, white, ${colors.primary}20)`,
      }}
    >
      {/* ---------------------------------------------------------------- Header */}
      <header
        className={`sticky top-0 z-20 border-b backdrop-blur ${
          darkMode ? "border-slate-800 bg-slate-950/80" : "border-gray-200 bg-white/80"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow"
              style={{ backgroundColor: colors.primary }}
            >
              <Receipt className="h-5 w-5 text-white" />
            </span>
            <span className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
              ExpenseTracker
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#features" className={`text-sm transition ${mutedText} hover:opacity-80`}>
              Features
            </a>
            <a href="#pricing" className={`text-sm transition ${mutedText} hover:opacity-80`}>
              Pricing
            </a>
            <a href="#faq" className={`text-sm transition ${mutedText} hover:opacity-80`}>
              FAQ
            </a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className={`rounded-lg border p-2 transition ${
                darkMode
                  ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user ? (
              <Link
                to="/dashboard"
                className={primaryButton}
                style={{ backgroundColor: colors.primary }}
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className={secondaryButton}>
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className={primaryButton}
                  style={{ backgroundColor: colors.primary }}
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className={`rounded-lg border p-2 md:hidden ${
              darkMode
                ? "border-slate-700 text-slate-300"
                : "border-gray-300 text-gray-600"
            }`}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div
            className={`border-t px-4 py-4 md:hidden ${
              darkMode ? "border-slate-800 bg-slate-950" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex flex-col gap-3">
              <a
                href="#features"
                onClick={() => setMenuOpen(false)}
                className={`text-sm ${mutedText}`}
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMenuOpen(false)}
                className={`text-sm ${mutedText}`}
              >
                Pricing
              </a>
              <a href="#faq" onClick={() => setMenuOpen(false)} className={`text-sm ${mutedText}`}>
                FAQ
              </a>
              <div className="mt-1 flex flex-col gap-2">
                {user ? (
                  <Link
                    to="/dashboard"
                    className={`${primaryButton} w-full`}
                    style={{ backgroundColor: colors.primary }}
                  >
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className={`${secondaryButton} w-full`}>
                      Log in
                    </Link>
                    <Link
                      to="/signup"
                      className={`${primaryButton} w-full`}
                      style={{ backgroundColor: colors.primary }}
                    >
                      Create free account
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------------ Hero */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: colors.primary + "22", color: colors.primary }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Free plan available, no credit card
            </span>

            <h1
              className={`mt-5 text-4xl font-extrabold leading-tight sm:text-5xl ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Know exactly where your money goes.
            </h1>
            <p className={`mt-4 text-lg leading-relaxed ${mutedText}`}>
              ExpenseTracker turns everyday spending into a clear picture. Log income and
              expenses, snap a receipt, and watch the balance, the charts and the exports update in
              real time.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link
                  to="/dashboard"
                  className={`${primaryButton} px-6 py-3`}
                  style={{ backgroundColor: colors.primary }}
                >
                  Open your dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className={`${primaryButton} px-6 py-3`}
                    style={{ backgroundColor: colors.primary }}
                  >
                    Create free account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/login" className={`${secondaryButton} px-6 py-3`}>
                    <LogIn className="h-4 w-4" />
                    Log in
                  </Link>
                </>
              )}
            </div>

            <p className={`mt-4 text-xs ${mutedText}`}>
              Works on desktop and mobile · Installable as an app · Export to CSV, Excel or PDF
            </p>
          </div>

          {/* Decorative product preview, built from the same palette as the app. */}
          <div className={cardClass} style={cardStyle} aria-hidden="true">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                  This month
                </p>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    darkMode ? "bg-slate-700 text-slate-300" : "bg-white text-gray-500"
                  }`}
                >
                  USD
                </span>
              </div>
              <p
                className="mt-2 text-3xl font-extrabold"
                style={{ color: darkMode ? "#fff" : "#111827" }}
              >
                $2,480.00
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div
                  className={`rounded-xl p-3 ${
                    darkMode ? "bg-slate-800/70" : "bg-white/70"
                  }`}
                >
                  <p className={`text-[11px] ${mutedText}`}>Income</p>
                  <p className="mt-0.5 flex items-center text-sm font-bold text-emerald-500">
                    <TrendingUp className="mr-1 h-3.5 w-3.5" />
                    $3,200
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3 ${
                    darkMode ? "bg-slate-800/70" : "bg-white/70"
                  }`}
                >
                  <p className={`text-[11px] ${mutedText}`}>Expenses</p>
                  <p className="mt-0.5 flex items-center text-sm font-bold text-red-500">
                    <TrendingDown className="mr-1 h-3.5 w-3.5" />
                    $1,760
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                {[
                  { label: "Food", share: 78, color: "#f59e0b" },
                  { label: "Travel", share: 54, color: colors.primary },
                  { label: "Equipment", share: 36, color: "#10b981" },
                  { label: "Utility Bills", share: 22, color: "#0ea5e9" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className={`w-24 text-xs ${mutedText}`}>{row.label}</span>
                    <span
                      className="h-2 flex-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: darkMode ? "#334155" : "#e5e7eb" }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${row.share}%`, backgroundColor: row.color }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <p
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: colors.primary }}
        >
          Features
        </p>
        <h2 className={`mt-2 ${sectionHeading}`}>Everything a budget tracker should do</h2>
        <p className={`mt-3 max-w-2xl ${mutedText}`}>
          No bloat, no manual spreadsheet juggling. Just the tools you actually use to stay on top
          of your money.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className={`${cardClass} p-6`} style={cardStyle}>
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: colors.primary + "1f", color: colors.primary }}
              >
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className={`mt-4 font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {feature.title}
              </h3>
              <p className={`mt-1.5 text-sm leading-relaxed ${mutedText}`}>{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="text-center">
          <p
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: colors.primary }}
          >
            Pricing
          </p>
          <h2 className={`mt-2 ${sectionHeading}`}>Start free, upgrade when you outgrow it</h2>
          <p className={`mx-auto mt-3 max-w-2xl ${mutedText}`}>
            Every plan includes the full app. Paid plans simply remove the monthly limits on
            entries, receipts and exports.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-7 ${
                plan.highlighted ? "lg:-mt-4 lg:pb-10 lg:pt-10" : ""
              } ${cardClass}`}
              style={{
                backgroundColor: darkMode ? "#1e293b" : colors.primary + "15",
                ...(plan.highlighted
                  ? {
                      borderColor: colors.primary,
                      boxShadow: `0 20px 25px -5px ${colors.primary}40`,
                    }
                  : {}),
              }}
            >
              {plan.highlighted && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: colors.primary }}
                >
                  Most popular
                </span>
              )}

              <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </h3>
              <p className={`mt-1 text-sm ${mutedText}`}>{plan.tagline}</p>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span
                  className="text-4xl font-extrabold"
                  style={{ color: darkMode ? "#fff" : "#111827" }}
                >
                  {plan.price}
                </span>
                <span className={`text-sm ${mutedText}`}>{plan.period}</span>
              </p>
              {plan.name === "Pro" && (
                <p className={`mt-1 text-xs ${mutedText}`}>or $39/year, two months free</p>
              )}

              <Link
                to={user ? "/dashboard" : "/signup"}
                className={`mt-6 w-full ${plan.highlighted ? primaryButton : secondaryButton}`}
                style={plan.highlighted ? { backgroundColor: colors.primary } : {}}
              >
                {user ? "Open dashboard" : plan.cta}
              </Link>

              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: plan.highlighted ? colors.primary : "#10b981" }}
                    />
                    <span className={darkMode ? "text-slate-300" : "text-gray-700"}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className={`mt-6 text-center text-xs italic ${mutedText}`}>
          Prices and limits shown here are placeholders. The app does not enforce plan limits yet.
        </p>
      </section>

      {/* ------------------------------------------------------------------- FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className={`text-center ${sectionHeading}`}>Questions people ask</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className={`${cardClass} group px-5 py-4`}
              style={cardStyle}
            >
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {faq.q}
                <span
                  className="text-lg leading-none transition-transform group-open:rotate-45"
                  style={{ color: colors.primary }}
                >
                  +
                </span>
              </summary>
              <p className={`mt-3 text-sm leading-relaxed ${mutedText}`}>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div
          className={`${cardClass} px-6 py-12 text-center sm:px-12`}
          style={{ backgroundColor: darkMode ? "#1e293b" : colors.primary + "15" }}
        >
          <Wallet className={`mx-auto h-10 w-10 ${darkMode ? "text-slate-500" : "text-gray-400"}`} />
          <h2 className={`mt-4 text-2xl font-bold sm:text-3xl ${darkMode ? "text-white" : "text-gray-900"}`}>
            Start tracking today
          </h2>
          <p className={`mx-auto mt-3 max-w-xl ${mutedText}`}>
            Create an account and add your first transaction in under a minute. No card, no trial
            timer.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? (
              <Link
                to="/dashboard"
                className={`${primaryButton} px-6 py-3`}
                style={{ backgroundColor: colors.primary }}
              >
                Open your dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className={`${primaryButton} px-6 py-3`}
                  style={{ backgroundColor: colors.primary }}
                >
                  Create free account
                </Link>
                <Link to="/login" className={`${secondaryButton} px-6 py-3`}>
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Footer */}
      <footer
        className={`border-t py-10 ${
          darkMode ? "border-slate-800" : "border-gray-200"
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: colors.primary }}
            >
              <Receipt className="h-4 w-4 text-white" />
            </span>
            <span className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              ExpenseTracker
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className={`text-sm ${mutedText} transition hover:opacity-80`}>
              Log in
            </Link>
            <Link to="/signup" className={`text-sm ${mutedText} transition hover:opacity-80`}>
              Sign up
            </Link>
            <a href="#pricing" className={`text-sm ${mutedText} transition hover:opacity-80`}>
              Pricing
            </a>
          </div>
          <p className={`text-xs ${mutedText}`}>© {YEAR} ExpenseTracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
