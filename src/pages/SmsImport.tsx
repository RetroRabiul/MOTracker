import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useTheme } from "../context/ThemeContext";
import { createTransaction } from "../services/transactionService";
import {
  configureSmsCapture,
  getPendingSms,
  hasSmsPermission,
  isSmsImportSupported,
  onSmsPending,
  readSmsInbox,
  requestSmsPermission,
  resolvePendingSms,
} from "../services/smsService";
import {
  applyRules,
  candidateFingerprint,
  confidenceBand,
  isAutoImportable,
  mergeCandidates,
  senderMatches,
  toIsoDate,
  type ParsedCandidate,
  type SmsMessage,
} from "../lib/smsParser";
import {
  activeSenders,
  clearSeenIds,
  loadAutoCapture,
    loadAutoImport,
  loadRulesWithPlatforms,
  loadSeenIds,
  rememberSeenIds,
} from "../lib/smsRules";
import {
  clearImportTimes,
  loadImportTimes,
  rememberImport,
  type SmsPlatform,
} from "../lib/smsPlatforms";
import { formatCurrency } from "../types/expense";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast, { type ToastTone } from "../components/Toast";

type Window_ = 7 | 30 | 90;

const WINDOWS: Array<{ value: Window_; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

/** Bounded so a bad rule cannot stall the UI on a full inbox. */
const MAX_MESSAGES = 100;

interface PlatformReport {
  platformId: string;
  name: string;
  /** Messages this platform has sent inside the scanned window. */
  total: number;
  /** How many were not already imported or dismissed. */
  fresh: number;
  /** How many of those parsed cleanly into a candidate. */
  parsed: number;
  /** When this platform last had a transaction approved. */
  lastImportAt: number | undefined;
}

const ago = (ms: number): string => {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/**
 * What the scan found, per platform.
 *
 * `fresh` counts messages that had not been handled before, which is the same
 * question the seen list answers elsewhere, so "up to date" cannot disagree with
 * what gets skipped. The import time is reported rather than used as a cutoff:
 * if an approval ever failed, a hard cutoff would make that money unreachable.
 */
function buildReport(
  messages: SmsMessage[],
  fresh: SmsMessage[],
  parsed: ParsedCandidate[],
  platforms: SmsPlatform[],
  importTimes: Record<string, number>,
): PlatformReport[] {
  const totals = new Map<string, number>();
  const freshCounts = new Map<string, number>();
  const parsedCounts = new Map<string, number>();

  // A message can belong to a platform by address, or through the rule that
  // matched it; both are recorded so a candidate always attributes somewhere.
  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);
  for (const message of messages) {
    for (const platform of platforms) {
      if (platform.enabled && platform.numbers.some((n) => senderMatches(message.address, n))) {
        bump(totals, platform.id);
        break;
      }
    }
  }
  for (const message of fresh) {
    for (const platform of platforms) {
      if (platform.enabled && platform.numbers.some((n) => senderMatches(message.address, n))) {
        bump(freshCounts, platform.id);
        break;
      }
    }
  }
  for (const candidate of parsed) {
    if (candidate.platformId) bump(parsedCounts, candidate.platformId);
  }

  const rows: PlatformReport[] = [];
  for (const platform of platforms) {
    if (!platform.enabled) continue;
    const total = totals.get(platform.id) ?? 0;
    if (total === 0) continue;
    rows.push({
      platformId: platform.id,
      name: platform.name || platform.numbers[0] || "Unnamed platform",
      total,
      fresh: freshCounts.get(platform.id) ?? 0,
      parsed: parsedCounts.get(platform.id) ?? 0,
      lastImportAt: importTimes[platform.id],
    });
  }
  return rows;
}

export default function SmsImport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { defaultCurrency } = useSettings();
  const { darkMode } = useTheme();

  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<Window_>(30);
  const [candidates, setCandidates] = useState<ParsedCandidate[]>([]);
  /**
   * Dismissed messages, keyed by fingerprint rather than id: the same SMS can
   * carry two ids, and a dismissal has to hide whichever copy turns up next.
   */
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  /**
   * Mirrors `candidates` so merging never depends on render state. Without this
   * the merge helper would capture the list, which changes identity on every
   * edit and would drag the pending-message effect down with it, re-subscribing
   * the receiver listener each time.
   */
  const candidatesRef = useRef<ParsedCandidate[]>([]);

  /** Single writer, so the ref and the rendered list cannot drift apart. */
  const setCandidateList = useCallback(
    (next: ParsedCandidate[] | ((prev: ParsedCandidate[]) => ParsedCandidate[])) => {
      const resolved = typeof next === "function" ? next(candidatesRef.current) : next;
      candidatesRef.current = resolved;
      setCandidates(resolved);
    },
    [],
  );

  /**
   * Notes that a platform has reached this point in time, which is what the
   * next scan compares against to decide "up to date".
   */
  const markImported = useCallback((candidate: ParsedCandidate) => {
    if (!candidate.platformId) return;
    rememberImport(candidate.platformId, candidate.receivedAt);
  }, []);
  const [scanNote, setScanNote] = useState<string | null>(null);
  /** Per-platform outcome of the last scan, shown under the Scan button. */
  const [report, setReport] = useState<PlatformReport[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const supported = isSmsImportSupported();
  const { rules, platforms } = useMemo(() => loadRulesWithPlatforms(), []);
  const senders = useMemo(() => activeSenders(rules, platforms), [rules, platforms]);

  useEffect(() => {
    if (!supported) return;
    void hasSmsPermission().then((granted) => setPermission(granted ? "granted" : "denied"));
  }, [supported]);

  /**
   * Keeps the native receiver in step with the sender list and the user's
   * preference. Without this the receiver has no idea which senders matter and
   * automatic capture stays off.
   */
  useEffect(() => {
    if (!supported) return;
    void hasSmsPermission().then((granted) => {
      void configureSmsCapture(senders, granted && loadAutoCapture());
    });
  }, [senders, supported]);

  /**
   * Adds candidates without disturbing what is already on screen. The list is
   * fed by both the receiver queue and the inbox scan, so the same SMS can
   * arrive twice under two ids; `mergeCandidates` keeps one row and reports the
   * id that lost, which is recorded as handled so it cannot be imported twice.
   */
  const fold = useCallback(
    (incoming: ParsedCandidate[]) => {
      if (incoming.length === 0) return;
      setCandidateList((prev) => {
        const { merged, foldedIds } = mergeCandidates(prev, incoming);
        if (foldedIds.length > 0) rememberSeenIds(foldedIds);
        return merged;
      });
    },
    [setCandidateList],
  );

  /**
   * Saves one candidate and records it as handled. The manual buttons and the
   * automatic pass share this so a message is never half-imported: the row, the
   * seen id and the queue removal either all happen or the candidate stays on
   * screen for another attempt. Splitting them is how a retry duplicates money.
   */
  const commitCandidate = useCallback(
    async (candidate: ParsedCandidate) => {
      if (!user) return false;
      if (candidate.problem || candidate.amount <= 0) return false;
      await createTransaction({
        userId: user.id,
        type: candidate.type,
        amount: candidate.amount,
        currency: candidate.currency || defaultCurrency,
        date: candidate.date || toIsoDate(candidate.receivedAt),
        category: candidate.category,
        description: candidate.merchant || `${candidate.ruleLabel} via SMS`,
      });
      rememberSeenIds([candidate.messageId]);
      void resolvePendingSms([candidate.messageId]);
      markImported(candidate);
      return true;
    },
    [defaultCurrency, markImported, user],
  );

  /**
   * Imports the messages the parser is sure about without waiting for a tap and
   * leaves the rest for review. Anything that throws is deliberately left on
   * screen: a failed save should surface as a row the user can retry, not as a
   * message that quietly vanished because the network was down.
   */
  const autoAdd = useCallback(
    async (parsed: ParsedCandidate[]) => {
      if (!user || parsed.length === 0) return 0;
      if (!loadAutoImport()) return 0;
      const confident = parsed.filter(isAutoImportable);
      if (confident.length === 0) return 0;
      const committed: string[] = [];
      for (const candidate of confident) {
        try {
          if (await commitCandidate(candidate)) committed.push(candidateFingerprint(candidate));
        } catch {
          // Keep it in the review list.
        }
      }
      if (committed.length > 0) {
        setSkipped((prev) => {
          const next = new Set(prev);
          for (const fingerprint of committed) next.add(fingerprint);
          return next;
        });
      }
      return committed.length;
    },
    [commitCandidate, user],
  );

  /**
   * Loads anything the receiver captured while the app was closed, and re-loads
   * it when a new message arrives while the app is open.
   */
  const drainPending = useCallback(async () => {
    const queued = await getPendingSms();
    if (queued.length === 0) return;
    const seen = loadSeenIds();
    const fresh = queued.filter((m) => !seen.has(m.id));
    if (fresh.length === 0) return;
    const parsed = applyRules(fresh, rules, platforms);
    if (parsed.length === 0) {
      setScanNote("A new message arrived, but no rule matched it. Check the rules screen.");
      return;
    }
    fold(parsed);
    const added = await autoAdd(parsed);
    if (added > 0) {
      setToast({ message: `Added ${added} to Transactions automatically`, tone: "success" });
    }
  }, [autoAdd, fold, platforms, rules]);

  useEffect(() => {
    if (!supported) return;
    void drainPending();
    let remove: (() => void) | undefined;
    void onSmsPending(({ count }) => {
      if (count > 0) void drainPending();
    }).then((handle) => {
      remove = handle.remove;
    });
    return () => remove?.();
  }, [drainPending, supported]);

  const askPermission = useCallback(async () => {
    setError("");
    const granted = await requestSmsPermission();
    setPermission(granted ? "granted" : "denied");
    if (!granted) {
      setError("Permission was not granted. Enable it for this app in Android Settings to import.");
    }
  }, []);

  const scan = useCallback(async () => {
    setError("");
    setScanNote(null);
    setReport([]);
    if (senders.length === 0) {
      setError("No platform is connected. Add one on the SMS sources screen first.");
      return;
    }
    setScanning(true);
    try {
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const messages: SmsMessage[] = await readSmsInbox(senders, since, MAX_MESSAGES);
      const seen = loadSeenIds();
      const fresh = messages.filter((m) => !seen.has(m.id));
      const parsed = applyRules(fresh, rules, platforms);
      fold(parsed);
      // Auto-import before the report so the per-platform "last added" column
      // reflects what was just written rather than the previous run.
      const added = await autoAdd(parsed);
      setReport(buildReport(messages, fresh, parsed, platforms, loadImportTimes()));
      if (added > 0) {
        setToast({ message: `Added ${added} to Transactions automatically`, tone: "success" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the SMS inbox");
    } finally {
      setScanning(false);
    }
  }, [autoAdd, days, fold, platforms, rules, senders]);

  const visible = useMemo(
    () => candidates.filter((c) => !skipped.has(candidateFingerprint(c))),
    [candidates, skipped],
  );

  const updateCandidate = useCallback(
    (id: string, patch: Partial<ParsedCandidate>) => {
      setCandidateList((prev) => prev.map((c) => (c.messageId === id ? { ...c, ...patch } : c)));
    },
    [setCandidateList],
  );

  const approve = useCallback(
    async (candidate: ParsedCandidate) => {
      setSaving(true);
      try {
        if (!(await commitCandidate(candidate))) return;
        setSkipped((prev) => new Set(prev).add(candidateFingerprint(candidate)));
        setToast({ message: `Added ${formatCurrency(candidate.amount, candidate.currency)}`, tone: "success" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the transaction");
      } finally {
        setSaving(false);
      }
    },
    [commitCandidate],
  );

  const approveAll = useCallback(async () => {
    const importable = visible.filter((c) => !c.problem && c.amount > 0);
    if (importable.length === 0) return;
    setSaving(true);
    const committed: string[] = [];
    let failed = 0;
    for (const candidate of importable) {
      try {
        if (await commitCandidate(candidate)) committed.push(candidateFingerprint(candidate));
      } catch {
        failed++;
      }
    }
    // Only rows that were actually saved leave the screen; a failed one stays put.
    setSkipped((prev) => {
      const next = new Set(prev);
      for (const fingerprint of committed) next.add(fingerprint);
      return next;
    });
    setSaving(false);
    setToast(
      failed === 0
        ? { message: `Imported ${committed.length} transaction(s)`, tone: "success" }
        : { message: `Imported ${committed.length}, ${failed} failed`, tone: "error" },
    );
  }, [commitCandidate, visible]);

  const header = (
    <div className="sticky top-0 z-20 border-b border-black/5 bg-white/80 pt-safe backdrop-blur-md dark:border-white/10 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          aria-label="Back to settings"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
          Import from SMS
        </h1>
        {loadingSpinner(scanning || saving)}
      </div>
    </div>
  );

  if (!supported) {
    return (
      <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
        {header}
        <main className="mx-auto max-w-3xl px-4 pb-tabbar pt-6">
          <Notice
            tone="info"
            icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            title="Android only"
            body="Browsers cannot read the SMS inbox, so this feature only works in the Android app. Your existing transactions and every other feature work here as normal."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      {header}
      <main className="mx-auto max-w-3xl px-4 pb-tabbar pt-6">
        {permission !== "granted" && (
          <Notice
            tone="warn"
            icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            title="Permission needed"
            body="Android requires permission to read messages. Only messages from the senders you configure are ever shown to the app, and nothing is uploaded."
            action={{ label: permission === "unknown" ? "Checking" : "Allow access", onClick: askPermission, disabled: permission === "unknown" }}
          />
        )}

        {permission === "granted" && (
          <>
            <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Scan inbox</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Watching {senders.length > 0 ? senders.join(", ") : "no senders yet"}.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
                  {WINDOWS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setDays(w.value)}
                      aria-pressed={days === w.value}
                      className={`min-h-[2.75rem] rounded-lg border px-3 text-sm font-medium transition ${
                        days === w.value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-black/10 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-1 gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={scan}
                    disabled={scanning || saving}
                    className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:flex-none"
                  >
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
                    {scanning ? "Scanning" : "Scan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/sms-rules")}
                    className="inline-flex min-h-[2.75rem] items-center justify-center gap-1 rounded-lg border border-black/10 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Rules
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {scanNote && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{scanNote}</p>
              )}

              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {loadAutoImport()
                  ? "Messages the parser reads with high confidence are added to your transactions straight away. Anything less certain waits here so you can check it."
                  : "Every message waits here for you to check before it is added to your transactions."}
              </p>

              {report.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {report.map((row) => (
                    <li
                      key={row.platformId}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-gray-600 dark:text-gray-400">
                        {row.fresh > 0 ? (
                          <>
                            {row.fresh} new
                            {row.parsed < row.fresh ? ` \u00b7 ${row.fresh - row.parsed} no rule matched` : ""}
                          </>
                        ) : row.lastImportAt ? (
                          <>Up to date · last added {ago(Date.now() - row.lastImportAt)}</>
                        ) : (
                          <>Nothing new yet</>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {error && (
              <div className="mt-4">
                <Notice tone="error" icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} title="Something went wrong" body={error} />
              </div>
            )}

            {candidates.length > 0 && (
              <section className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {visible.length} to review
                  </h2>
                  <button
                    type="button"
                    onClick={approveAll}
                    disabled={saving || visible.every((c) => c.problem || c.amount <= 0)}
                    className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Add all
                  </button>
                </div>

                <ul className="mt-3 space-y-3">
                  {visible.map((candidate) => (
                    <CandidateRow
                      key={candidate.messageId}
                      candidate={candidate}
                      darkMode={darkMode}
                      saving={saving}
                      onChange={(patch) => updateCandidate(candidate.messageId, patch)}
                      onApprove={() => void approve(candidate)}
                      onSkip={() => {
                        rememberSeenIds([candidate.messageId]);
                        void resolvePendingSms([candidate.messageId]);
                        setSkipped((prev) => new Set(prev).add(candidateFingerprint(candidate)));
                      }}
                    />
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="mt-4 inline-flex min-h-[2.75rem] items-center gap-2 text-sm font-medium text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Forget imported messages
                </button>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  Clears the list of already-imported messages so a rescan offers them again.
                </p>
              </section>
            )}
          </>
        )}
      </main>

      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          darkMode={darkMode}
          onDismiss={() => setToast(null)}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        darkMode={darkMode}
        title="Forget imported messages?"
        message="Messages already imported will be offered again the next time you scan. Transactions already saved are not deleted."
        confirmLabel="Forget"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          clearSeenIds();
          clearImportTimes();
          setReport([]);
          setCandidateList([]);
          setSkipped(new Set());
          setConfirmReset(false);
          setToast({ message: "Cleared the imported list", tone: "success" });
        }}
      />
    </div>
  );
}

function loadingSpinner(active: boolean) {
  if (!active) return null;
  return <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />;
}

interface NoticeProps {
  tone: "info" | "warn" | "error";
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}

function Notice({ tone, icon, title, body, action }: NoticeProps) {
  const palette = {
    info: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${palette}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm opacity-90">{body}</p>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="mt-3 inline-flex min-h-[2.5rem] items-center rounded-lg border border-current/30 px-3 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-60"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CandidateRowProps {
  candidate: ParsedCandidate;
  darkMode: boolean;
  saving: boolean;
  onChange: (patch: Partial<ParsedCandidate>) => void;
  onApprove: () => void;
  onSkip: () => void;
}

/**
 * One parsed message. Every extracted field is editable, because the user is
 * the only one who can tell whether a message is really a transaction.
 */
function CandidateRow({ candidate, darkMode, saving, onChange, onApprove, onSkip }: CandidateRowProps) {
  const [open, setOpen] = useState(false);
  const blocked = !!candidate.problem || candidate.amount <= 0;
  const band = confidenceBand(candidate.confidence);

  const bandColor = blocked
    ? "bg-red-500"
    : band === "high"
      ? "bg-emerald-500"
      : band === "medium"
        ? "bg-amber-500"
        : "bg-orange-500";

  return (
    <li className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${bandColor}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {candidate.problem ? "—" : formatCurrency(candidate.amount, candidate.currency)}
            </span>
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {candidate.type === "income" ? "Income" : candidate.type === "transfer" ? "Transfer" : "Expense"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-gray-600 dark:text-gray-400">
            {candidate.problem ?? (candidate.merchant || candidate.ruleLabel)}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-500">
            {candidate.date} · {candidate.ruleLabel} · from {candidate.address}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-black/5 p-4 dark:border-white/10">
          {candidate.problem && (
            <p className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
              {candidate.problem} — fix the rule, then skip this message.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={candidate.amount || ""}
                onChange={(e) => onChange({ amount: Number(e.target.value) || 0, problem: null })}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
              />
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={candidate.currency}
                onChange={(e) => onChange({ currency: e.target.value.toUpperCase().slice(0, 3) })}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={candidate.date}
                onChange={(e) => onChange({ date: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
              />
            </Field>
            <Field label="Category">
              <input
                type="text"
                value={candidate.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Merchant / description">
                <input
                  type="text"
                  value={candidate.merchant}
                  onChange={(e) => onChange({ merchant: e.target.value })}
                  placeholder={candidate.ruleLabel}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-gray-800 dark:text-white"
                />
              </Field>
            </div>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400">
              Original message
            </summary>
            <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {candidate.rawBody}
            </p>
          </details>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={blocked || saving}
              className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Add
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={saving}
              className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg border border-black/10 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}
