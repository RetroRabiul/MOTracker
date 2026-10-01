import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Extra classes so the dialog can follow the active theme. */
  darkMode: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces `window.confirm`, which on Android renders an unstyled system dialog
 * that does not match the app and cannot be styled or made accessible. This is
 * focus-trapped, dismissible with Escape or a backdrop tap, and returns focus
 * to the trigger.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  darkMode,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement;
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind the dialog from scrolling under it on touch devices.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (restoreFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        // Stop a tap inside the panel from reaching the backdrop's dismiss handler.
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl p-5 shadow-xl ${
          darkMode ? "border border-slate-700 bg-slate-800" : "bg-white"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="confirm-title"
              className={`text-base font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}
            >
              {title}
            </h2>
            <p
              id="confirm-message"
              className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className={`min-h-[2.75rem] rounded-lg border px-4 py-2 text-sm font-medium transition ${
              darkMode
                ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="min-h-[2.75rem] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
