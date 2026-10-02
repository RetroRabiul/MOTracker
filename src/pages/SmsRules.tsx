import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FlaskConical, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { compileRule, confidenceBand, parseMessage, type SmsDirection, type SmsRule } from "../lib/smsParser";
import { createBlankRule, loadRulesWithPlatforms, resetRules, saveRules } from "../lib/smsRules";
import {
  cleanNumbers,
  createBlankPlatform,
  savePlatforms,
  type SmsPlatform,
} from "../lib/smsPlatforms";
import { CURRENCIES } from "../types/expense";

/**
 * Sources screen: the platforms the user has connected, and the rules that parse
 * them.
 *
 * Two things are edited here on purpose. A platform is which numbers to watch,
 * and the user is the only one who knows them. A rule is how to read a message
 * from that platform, and only a real message can confirm that. Keeping both on
 * one screen means connecting a service is name plus number, with no regex
 * required to get started.
 */
export default function SmsRules() {
  const navigate = useNavigate();
  const [{ rules, platforms }, setLoaded] = useState(() => loadRulesWithPlatforms());
  const [selectedId, setSelectedId] = useState<string>(() => rules[0]?.id ?? "");
  const [sample, setSample] = useState("");
  // Captured once so the preview is not impure during render. A rule with no
  // `date` group falls back to the SMS timestamp, and a constant is an honest
  // stand-in for it in a tester.
  const [fallbackDate] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);

  const selected = useMemo(() => rules.find((r) => r.id === selectedId) ?? rules[0], [rules, selectedId]);
  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === selected?.platformId),
    [platforms, selected?.platformId],
  );

  const flash = useCallback((ok: boolean) => {
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  }, []);

  const persistRules = useCallback((next: SmsRule[]) => {
    setLoaded({ rules: next, platforms });
    flash(saveRules(next));
  }, [flash, platforms]);

  const patch = useCallback(
    (id: string, changes: Partial<SmsRule>) => {
      persistRules(rules.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    },
    [persistRules, rules],
  );

  const persistPlatforms = useCallback((next: SmsPlatform[]) => {
    setLoaded({ rules, platforms: next });
    flash(savePlatforms(next));
  }, [flash, rules]);

  const addRule = useCallback(() => {
    const rule = createBlankRule();
    persistRules([...rules, rule]);
    setSelectedId(rule.id);
    setSample("");
  }, [persistRules, rules]);

  const removeRule = useCallback(
    (id: string) => {
      const next = rules.filter((r) => r.id !== id);
      persistRules(next);
      if (selectedId === id) setSelectedId(next[0]?.id ?? "");
    },
    [persistRules, rules, selectedId],
  );

  const addPlatform = useCallback(() => {
    const platform = createBlankPlatform();
    persistPlatforms([...platforms, platform]);
  }, [persistPlatforms, platforms]);

  const patchPlatform = useCallback(
    (id: string, changes: Partial<SmsPlatform>) => {
      persistPlatforms(platforms.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    },
    [persistPlatforms, platforms],
  );

  const patchPlatformNumber = useCallback(
    (id: string, index: number, value: string) => {
      const platform = platforms.find((p) => p.id === id);
      if (!platform) return;
      const numbers = [...platform.numbers];
      numbers[index] = value;
      // Stored clean so "bKash" and "bkash" cannot both become senders.
      patchPlatform(id, { numbers: cleanNumbers(numbers.length ? numbers : [""]) });
    },
    [patchPlatform, platforms],
  );

  const removePlatform = useCallback(
    (id: string) => {
      // Rules keep pointing at the id; with it gone they show as unattached
      // rather than silently matching a different platform's messages.
      persistPlatforms(platforms.filter((p) => p.id !== id));
    },
    [persistPlatforms, platforms],
  );

  const preview = useMemo(() => {
    if (!selected) return null;
    const compiled = compileRule(selected);
    if (compiled.regex === null) return { problem: compiled.problem, candidate: null };
    if (!sample.trim()) return { problem: null, candidate: null, idle: true };
    // Testing against the platform's real sender address means the sample goes
    // through the same sender check the inbox will apply.
    const address = selectedPlatform?.numbers[0] || selected.sender || "SENDER";
    const candidate = parseMessage(
      {
        id: "sample",
        address,
        body: sample,
        date: fallbackDate,
        read: true,
      },
      selected,
    );
    if (!candidate) return { problem: "Pattern does not match this message", candidate: null };
    return { problem: candidate.problem, candidate };
  }, [fallbackDate, sample, selected, selectedPlatform]);

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
            SMS sources
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
          Add a platform and the number it sends from, and the app will read messages from that
          number only. The starter patterns are a starting point, not verified truth: bKash and bank
          wording differs by product and language, so test each rule against a real message below
          before relying on it.
        </p>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Platforms</h2>
            <button
              type="button"
              onClick={addPlatform}
              className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-black/10 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add platform
            </button>
          </div>

          {platforms.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-black/10 p-4 text-sm text-gray-600 dark:border-white/15 dark:text-gray-400">
              No platforms yet. Add one to choose which numbers the app watches.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {platforms.map((platform) => (
                <li
                  key={platform.id}
                  className="rounded-xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <Labeled label="Platform name">
                        <input
                          type="text"
                          value={platform.name}
                          onChange={(e) => patchPlatform(platform.id, { name: e.target.value })}
                          placeholder="bKash"
                          aria-label={`Name for platform ${platform.name || "unnamed"}`}
                          className={inputClass}
                        />
                      </Labeled>

                      {/*
                        A platform on its own does nothing. Messages from it are
                        captured and then have nowhere to go, which used to show
                        up as a count on the import screen with no explanation.
                        Saying it here, next to the number, is where it can be
                        acted on.
                      */}
                      {!rules.some((r) => r.enabled && r.platformId === platform.id) && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                          No rule is connected to this platform, so messages from it will be captured
                          and then ignored. Pick this platform on a rule below.
                        </p>
                      )}

                      <div>
                        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Numbers it sends from
                        </span>
                        <div className="space-y-2">
                          {platform.numbers.map((number, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={number}
                                onChange={(e) => patchPlatformNumber(platform.id, index, e.target.value)}
                                placeholder="bKash or 1712345678"
                                aria-label={`Number ${index + 1} for ${platform.name || "platform"}`}
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() => patchPlatform(platform.id, { numbers: platform.numbers.filter((_, i) => i !== index) })}
                                disabled={platform.numbers.length <= 1}
                                aria-label={`Remove number ${index + 1}`}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => patchPlatform(platform.id, { numbers: [...platform.numbers, ""] })}
                          className="mt-2 inline-flex min-h-[2.5rem] items-center gap-1.5 text-xs font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          Add another number
                        </button>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                          A number matches in any format, so 1712345678 catches +8801712345678. A
                          name like bKash matches case-insensitively. Only these senders are ever read.
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={platform.enabled}
                          onChange={(e) => patchPlatform(platform.id, { enabled: e.target.checked })}
                          aria-label={`Watch ${platform.name || "this platform"}`}
                          className="h-4 w-4"
                        />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">On</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removePlatform(platform.id)}
                        aria-label={`Delete ${platform.name || "platform"}`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-black/10 text-red-600 transition hover:bg-red-50 dark:border-white/15 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Rules</h2>
          <div className="flex flex-wrap gap-2">
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
                setLoaded({ rules: fresh, platforms });
                setSelectedId(fresh[0]?.id ?? "");
                flash(true);
              }}
              className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg border border-black/10 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Restore defaults
            </button>
          </div>
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
                      {platforms.find((p) => p.id === rule.platformId)?.name ?? "no platform"} ·{" "}
                      {rule.direction} · {rule.defaultCurrency}
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
              <Labeled label="Platform">
                <select
                  value={selected.platformId}
                  onChange={(e) => patch(selected.id, { platformId: e.target.value })}
                  aria-label="Platform this rule reads messages from"
                  className={inputClass}
                >
                  <option value="">Not connected — manual paste only</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id} disabled={!platform.enabled}>
                      {platform.name || "Unnamed platform"}
                      {platform.enabled ? "" : " (off)"}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {selectedPlatform
                    ? `Reads messages from ${selectedPlatform.numbers.join(", ") || "no numbers yet"}.`
                    : "Without a platform this rule is never matched against your inbox."}
                </p>
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
