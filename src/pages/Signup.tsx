import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, EMAIL_CONFIRMATION_MESSAGE } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Loader2, Mail, Lock, Eye, EyeOff, User, Receipt } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup, loginWithGoogle } = useAuth();
  const { colors, darkMode } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name);
      navigate("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      if (message === EMAIL_CONFIRMATION_MESSAGE) {
        setSuccess("Account created! Check your email to confirm your account, then sign in.");
      } else {
        setError(message);
      }
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

  const fieldClass = `w-full rounded-lg border py-2.5 pl-10 pr-4 transition focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
    darkMode
      ? "border-slate-700 bg-slate-800/80 text-slate-100 placeholder-gray-400 focus:bg-slate-900"
      : "border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white"
  }`;

  const labelClass = `mb-1.5 block text-sm font-medium ${
    darkMode ? "text-gray-300" : "text-gray-700"
  }`;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8"
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
            Create Account
          </h1>
          <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Start tracking your business expenses
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className={labelClass}>
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
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
                  required
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className={`${fieldClass} pr-12`}
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

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className={fieldClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: colors.primary }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
            </button>
          </form>

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
            Sign up with Google
          </button>

          <p className={`mt-6 text-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold" style={{ color: colors.primary }}>
              Sign in
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
