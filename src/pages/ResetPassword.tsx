import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2, Receipt } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading, recoveryActive, updatePassword } = useAuth();
  const { colors, darkMode } = useTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update your password");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `w-full rounded-lg border px-4 py-3 outline-none transition focus:ring-2 ${
    darkMode
      ? "border-gray-700 bg-gray-800 text-white focus:border-blue-500"
      : "border-gray-300 bg-white text-gray-900 focus:border-blue-500"
  }`;

  return (
    <div
      className="pt-safe flex min-h-screen items-center justify-center px-4 py-12 pb-[calc(3rem+var(--sab))]"
      style={{
        backgroundColor: darkMode ? "#0f172a" : colors.primary + "08",
        color: darkMode ? "#f1f5f9" : undefined,
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl p-8 shadow-sm ${
          darkMode ? "border border-gray-700 bg-gray-900" : "border border-gray-200 bg-white"
        }`}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Choose a new password
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.primary }} />
          </div>
        ) : done ? (
          <div className="text-center">
            <p className="text-sm font-medium text-emerald-600">Password updated.</p>
            <p className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Taking you to your dashboard...
            </p>
          </div>
        ) : !recoveryActive || !user ? (
          <div className="text-center">
            <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              This password reset link is no longer valid
            </p>
            <p className={`mt-2 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Reset links expire and can only be used once. Request a new one to carry on.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="mt-6 w-full rounded-lg px-4 py-3 font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: colors.primary }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Resetting the password for <span className="font-medium">{user.email}</span>.
            </p>

            <div>
              <label
                htmlFor="new-password"
                className={`mb-1.5 block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className={`mb-1.5 block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className={inputClass}
                placeholder="Re-enter your new password"
              />
            </div>

            {error && (
              <p
                role="alert"
                className={`rounded-lg border p-3 text-sm ${
                  darkMode
                    ? "border-red-800 bg-red-950/40 text-red-200"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: colors.primary }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4" />
                  Update password
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
