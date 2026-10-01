import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "error" | "success" | "info";

interface ToastProps {
  tone: ToastTone;
  message: string;
  darkMode: boolean;
  onDismiss: () => void;
}

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
} as const;

const TONES: Record<ToastTone, { border: string; bg: string; text: string; icon: string }> = {
  error: {
    border: "border-red-300",
    bg: "bg-red-50",
    text: "text-red-900",
    icon: "text-red-600",
  },
  success: {
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    icon: "text-emerald-600",
  },
  info: {
    border: "border-gray-300",
    bg: "bg-white",
    text: "text-gray-800",
    icon: "text-gray-500",
  },
};

const DARK_TONES: Record<ToastTone, { border: string; bg: string; text: string; icon: string }> = {
  error: { border: "border-red-800", bg: "bg-red-950/60", text: "text-red-200", icon: "text-red-400" },
  success: {
    border: "border-emerald-800",
    bg: "bg-emerald-950/60",
    text: "text-emerald-200",
    icon: "text-emerald-400",
  },
  info: { border: "border-slate-700", bg: "bg-slate-800", text: "text-slate-200", icon: "text-slate-400" },
};

/**
 * Non-blocking status message.
 *
 * `window.alert` halts the whole page behind an OS dialog that cannot be styled
 * or made accessible, which is especially jarring inside the Android WebView.
 */
export default function Toast({ tone, message, darkMode, onDismiss }: ToastProps) {
  const Icon = ICONS[tone];
  const palette = (darkMode ? DARK_TONES : TONES)[tone];

  return (
    <div
      // `status` is polite so it does not interrupt a screen reader mid-sentence.
      role="status"
      aria-live="polite"
      className={`fixed inset-x-3 bottom-3 z-50 flex items-start gap-3 rounded-xl border p-4 shadow-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-sm ${
        palette.border
      } ${palette.bg}`}
      style={{ bottom: "calc(0.75rem + var(--sab))" }}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${palette.icon}`} aria-hidden="true" />
      <p className={`flex-1 text-sm ${palette.text}`}>{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`-m-1 shrink-0 rounded-lg p-1 transition hover:bg-black/5 ${palette.icon}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
