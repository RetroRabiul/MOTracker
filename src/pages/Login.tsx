import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Loader2, Mail, Lock, Eye, EyeOff, Receipt, ArrowLeft, KeyRound } from "lucide-react";

type LoginMode = "password" | "code";

const RESEND_COOLDOWN_SECONDS = 60;

const inputClass = (darkMode: boolean) =>
  `w-full rounded-lg border py-2.5 pl-10 pr-4 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
    darkMode
      ? "border-slate-700 bg-slate-800/80 text-slate-100 placeholder-gray-400 focus:bg-slate-900"
      : "border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white"
  }`;

const labelClass = (darkMode: boolean) =>
  `mb-1.5 block text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`;

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const {
    login,
    loginWithGoogle,
    resetPassword,
    sendEmailCode,
    verifyEmailCode,
    resendSignupConfirmation,
  } = useAuth();
  const { colors, darkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setError("");
    setSuccess("");
    setCode("");
    setShowReset(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await sendEmailCode(email);
      setCodeSent(true);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setSuccess(`We sent a 6-digit code to ${email.trim()}. Enter it below.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send the sign-in code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await verifyEmailCode(email, code);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That code is not valid");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await sendEmailCode(email);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setSuccess(`A new code is on its way to ${email.trim()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend the code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendIn > 0) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await resendSignupConfirmation(email);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setSuccess(`Confirmation email sent again to ${email.trim()}. Open it to activate your account.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend the confirmation email");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      // Full-page redirect to Google and back; onAuthStateChange picks the user up.
      await loginWithGoogle();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Try again or use email/password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess("Password reset email sent! The link in it opens a page where you can set a new password.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (showReset) {
    return (
      <div
        className="pt-safe flex min-h-screen flex-col items-center justify-center px-4 py-8 pb-[calc(2rem+var(--sab))]"
        style={{
          background: darkMode
            ? "linear-gradient(135deg, #020617 0%, #111827 40%, #1f2937 100%)"
            : `linear-gradient(135deg, ${colors.primary}10, white, ${colors.primary}20)`,
        }}
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <button
              onClick={() => {
                setShowReset(false);
                setError("");
                setSuccess("");
              }}
              className={`mb-4 inline-flex items-center gap-1 text-sm transition ${
                darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
            <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
              Reset Password
            </h1>
            <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Enter your email to receive a reset link
            </p>
          </div>

          <div
            className="rounded-2xl p-6 shadow-xl sm:p-8"
            style={{
              backgroundColor: darkMode ? "#1e293b" : colors.primary + "15",
              boxShadow: `0 20px 25px -5px ${colors.primary}20`,
            }}
          >
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="reset-email"
                  className={labelClass(darkMode)}
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={inputClass(darkMode)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pt-safe flex min-h-screen flex-col items-center justify-center px-4 py-8 pb-[calc(2rem+var(--sab))]"
      style={{
        background: darkMode
          ? "linear-gradient(135deg, #020617 0%, #111827 40%, #1f2937 100%)"
          : `linear-gradient(135deg, ${colors.primary}10, white, ${colors.primary}20)`,
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ backgroundColor: colors.primary }}
          >
            <Receipt className="h-8 w-8 text-white" />
          </div>
          <h1 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            ExpenseTracker
          </h1>
          <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Sign in to manage your expenses
          </p>
        </div>

        <div
          className="rounded-2xl p-6 shadow-xl sm:p-8"
          style={{
            backgroundColor: darkMode ? "#1e293b" : colors.primary + "15",
            boxShadow: `0 20px 25px -5px ${colors.primary}20`,
          }}
        >
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div
            className={`mb-5 grid grid-cols-2 gap-1 rounded-lg border p-1 ${
              darkMode ? "border-slate-700 bg-slate-800/60" : "border-gray-200 bg-gray-50"
            }`}
          >
            {(
              [
                { key: "password", label: "Password" },
                { key: "code", label: "Email code" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => switchMode(option.key)}
                aria-pressed={mode === option.key}
                className={`rounded-md py-1.5 text-sm font-medium transition ${
                  mode === option.key
                    ? "text-white shadow-sm"
                    : darkMode
                      ? "text-slate-400 hover:text-slate-100"
                      : "text-gray-600 hover:text-gray-900"
                }`}
                style={mode === option.key ? { backgroundColor: colors.primary } : {}}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className={labelClass(darkMode)}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={inputClass(darkMode)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={labelClass(darkMode)}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className={`${inputClass(darkMode)} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                      darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-sm"
                  style={{ color: colors.primary }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleResendConfirmation()}
                disabled={resendIn > 0 || loading}
                className={`text-center text-xs underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {resendIn > 0
                  ? `Resend confirmation email in ${resendIn}s`
                  : "Need to confirm your email? Resend the confirmation email"}
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: colors.primary }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
              </button>
            </form>
          ) : !codeSent ? (
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
                We'll email you a 6-digit code. No password needed, and new accounts are created
                automatically.
              </p>
              <div>
                <label htmlFor="code-email" className={labelClass(darkMode)}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="code-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={inputClass(darkMode)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: colors.primary }}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Continue with email code
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
              <div>
                <label htmlFor="otp" className={labelClass(darkMode)}>
                  6-digit code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    className={`${inputClass(darkMode)} text-center text-lg font-semibold tracking-[0.4em]`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: colors.primary }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify and sign in"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setCodeSent(false);
                    setCode("");
                    setSuccess("");
                    setError("");
                  }}
                  className={darkMode ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-700"}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={resendIn > 0 || loading}
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ color: colors.primary }}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${darkMode ? "border-slate-700" : "border-gray-200"}`} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className={`px-3 ${darkMode ? "bg-slate-800 text-gray-400" : "bg-white text-gray-500"}`}
              >
                or continue with
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`flex w-full items-center justify-center gap-3 rounded-lg border py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
              darkMode
                ? "border-slate-700 bg-slate-800 text-gray-100 hover:bg-slate-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          <p className={`mt-6 text-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold" style={{ color: colors.primary }}>
              Sign up
            </Link>
          </p>
        </div>

        <p className={`mt-6 text-center text-xs ${darkMode ? "text-slate-500" : "text-gray-400"}`}>
          Track expenses, capture receipts, and export reports
        </p>
      </div>
    </div>
  );
}
