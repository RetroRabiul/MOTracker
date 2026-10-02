import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FlaskConical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { compileRule, confidenceBand, parseMessage, type SmsDirection, type SmsRule } from "../lib/smsParser";
import { createBlankRule, loadRules, resetRules, saveRules } from "../lib/smsRules";
import { CURRENCIES } from "../types/expense";

/**
 * Rules editor with a live tester.
 *
 * Patterns are the part of this feature most likely to be wrong, and the user is
 * the only one who can see a real bKash message. So every edit is testable
 * against pasted text in place, rather than saved and discovered later on the
 * import screen.
 */
export default function SmsRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<SmsRule[]>(() => loadRules());
  const [selectedId, setSelectedId] = useState<string>(() => rules[0]?.id ?? "");
  const [sample, setSample] = useState("");
  // Captured once so the preview is not impure during render. A rule with no
  // `date` group falls back to the SMS timestamp, and a constant is an honest
  // stand-in for it in a tester.
  const [fallbackDate] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);

  const selected = useMemo(() => rules.find((r) => r.id === selectedId) ?? rules[0], [rules, selectedId]);

  const persist = useCallback((next: SmsRule[]) => {
    setRules(next);
    const ok = saveRules(next);
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<SmsRule>) => {
      persist(rules.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    },
    [persist, rules],
  );

  const addRule = useCallback(() => {
    const rule = createBlankRule();
    persist([...rules, rule]);
    setSelectedId(rule.id);
    setSample("");
  }, [persist, rules]);

  const removeRule = useCallback(
    (id: string) => {
      const next = rules.filter((r) => r.id !== id);
      persist(next);
      if (selectedId === id) setSelectedId(next[0]?.id ?? "");
    },
    [persist, rules, selectedId],
  );

  const preview = useMemo(() => {
    if (!selected) return null;
    const compiled = compileRule(selected);
    if (compiled.regex === null) return { problem: compiled.problem, candidate: null };
    if (!sample.trim()) return { problem: null, candidate: null, idle: true };
    const candidate = parseMessage(
      {
        id: "sample",
        address: selected.sender || "SENDER",
        body: sample,
        date: fallbackDate,
        read: true,
      },
      selected,
    );
    if (!candidate) return { problem: "Pattern does not match this message", candidate: null };
    return { problem: candidate.problem, candidate };
  }, [fallbackDate, sample, selected]);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-20 border-b border-black/5 bg-white/80 pt-safe backdrop-blur-md dark:border-white/10 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/sms-import")}
            aria-label="Back to SMS import"
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
            SMS rules
          </h1>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Saved
            </span>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-tabbar pt-6">
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          These starter patterns are a starting point, not verified truth. bKash and bank wording
          differs by product and language, so test each rule against a real message below before
          relying on it.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRule}
            className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add rule
          </button>
          <button
            type="button"
            onClick={() => {
              const fresh = resetRules();
              setRules(fresh);
              setSelectedId(fresh[0]?.id ?? "");
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-black/10 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restore defaults
          </button>
        </div>

        <ul className="mt-4 space-y-2" role="tablist" aria-label="Rules">
          {rules.map((rule) => {
            const active = rule.id === selected?.id;
            const compiled = compileRule(rule);
            return (
              <li key={rule.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedId(rule.id);
                    setSample("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                      : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900 dark:hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      !rule.enabled ? "bg-gray-300 dark:bg-gray-700" : compiled.regex === null ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {rule.label}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {rule.sender || "manual only"} · {rule.direction} · {rule.defaultCurrency}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected && (
          <section className="mt-6 rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-6 dark:border-white/10 dark:bg-gray-900">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Labeled label="Name">
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => patch(selected.id, { label: e.target.value })}
                  className={inputClass}
                />
              </Labeled>
              <Labeled label="Sender address or name">
                <input
                  type="text"
                  value={selected.sender}
                  onChange={(e) => patch(selected.id, { sender: e.target.value })}
                  placeholder="bKash"
                  className={inputClass}
                />
              </Labeled>
              <Labeled label="Direction">
                <select
                  value={selected.direction}
                  onChange={(e) => patch(selected.id, { direction: e.target.value as SmsDirection })}
                  className={inputClass}
                >
                  <option value="expense">Expense (money out)</option>
                  <option value="income">Income (money in)</option>
                </select>
              </Labeled>
              <Labeled label="Currency">
                <select
                  value={selected.defaultCurrency}
                  onChange={(e) => patch(selected.id, { defaultCurrency: e.target.value })}
                  className={inputClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Category">
                <input
                  type="text"
                  value={selected.category}
                  onChange={(e) => patch(selected.id, { category: e.target.value })}
                  className={inputClass}
                />
              </Labeled>
              <div className="flex items-end">
                <label className="flex min-h-[2.75rem] w-full cursor-pointer items-center gap-3 rounded-lg border border-black/10 px-3 dark:border-white/15">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) => patch(selected.id, { enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <Labeled label="Extraction pattern">
                  <textarea
                    value={selected.pattern}
                    onChange={(e) => patch(selected.id, { pattern: e.target.value })}
                    rows={3}
                    spellCheck={false}
                    className={`${inputClass} font-mono text-xs`}
                  />
                </Labeled>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  Use a named <code className="font-mono">(?P&lt;amount&gt;…)</code> group (required),
                  plus optional <code className="font-mono">currency</code>,{" "}
                  <code className="font-mono">merchant</code> and <code className="font-mono">date</code>.
                  Matching is case-insensitive and runs against the message with Bengali numerals already
                  converted to ASCII.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-black/5 pt-5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Test this rule</h2>
              </div>
              <textarea
                value={sample}
                onChange={(e) => setSample(e.target.value)}
                rows={3}
                placeholder="Paste a real bKash or bank message here"
                className={`${inputClass} mt-3`}
              />

              {preview && (
                <div className="mt-3">
                  {preview.problem && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {preview.problem}
                    </p>
                  )}
                  {preview.candidate && !preview.candidate.problem && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <p className="font-semibold">
                        {preview.candidate.type === "income" ? "Income" : "Expense"} ·{" "}
                        {preview.candidate.amount} {preview.candidate.currency} ·{" "}
                        {preview.candidate.date}
                      </p>
                      <p className="mt-0.5 opacity-90">
                        {preview.candidate.merchant || "no merchant captured"} ·{" "}
                        {preview.candidate.category} ·{" "}
                        {confidenceBand(preview.candidate.confidence)} confidence
                      </p>
                    </div>
                  )}
                  {preview.idle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Paste a message to see what this rule would extract.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeRule(selected.id)}
              className="mt-6 inline-flex min-h-[2.75rem] items-center gap-2 text-sm font-medium text-red-600 transition hover:underline dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete this rule
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-gray-800 dark:text-white";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}
