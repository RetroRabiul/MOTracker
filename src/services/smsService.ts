import { Capacitor, registerPlugin } from "@capacitor/core";
import type { SmsMessage } from "../lib/smsParser";

interface SmsReaderPlugin {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  readInbox(options: {
    addresses: string[];
    since: number;
    limit?: number;
  }): Promise<{ messages: SmsMessage[] }>;
  /** Tells the native side which senders matter and whether to watch for new messages. */
  configure(options: { addresses: string[]; autoCapture: boolean }): Promise<void>;
  /** Messages captured while the app was closed. */
  getPending(): Promise<{ messages: SmsMessage[] }>;
  resolvePending(options: { ids: string[] }): Promise<void>;
  clearPending(): Promise<void>;
  addListener(event: "smsPending", cb: (payload: { count: number }) => void): Promise<{
    remove: () => void;
  }>;
}

const SmsReader = registerPlugin<SmsReaderPlugin>("SmsReader");

/**
 * SMS import is Android-only. No browser exposes the message inbox, so on web
 * the UI must not pretend the feature exists.
 */
export function isSmsImportSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function hasSmsPermission(): Promise<boolean> {
  if (!isSmsImportSupported()) return false;
  try {
    const { granted } = await SmsReader.hasPermission();
    return granted;
  } catch (error) {
    console.warn("Could not check the SMS permission:", error);
    return false;
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!isSmsImportSupported()) return false;
  try {
    const { granted } = await SmsReader.requestPermission();
    return granted;
  } catch (error) {
    console.warn("Could not request the SMS permission:", error);
    return false;
  }
}

/**
 * Reads inbox messages from the given senders. The native layer applies the
 * sender filter, so this never returns unrelated messages.
 *
 * @param since epoch millis; messages older than this are not fetched.
 */
export async function readSmsInbox(
  addresses: string[],
  since: number,
  limit = 50,
): Promise<SmsMessage[]> {
  if (!isSmsImportSupported()) {
    throw new Error("SMS import is only available in the Android app");
  }
  if (addresses.length === 0) {
    throw new Error("Add at least one sender before scanning");
  }
  const { messages } = await SmsReader.readInbox({ addresses, since, limit });
  return messages ?? [];
}

/**
 * Publishes the current sender list to the native receiver.
 *
 * The receiver runs with no web layer, so this is the only way it learns which
 * senders are relevant. Without it, automatic capture stays off.
 */
export async function configureSmsCapture(
  addresses: string[],
  autoCapture: boolean,
): Promise<void> {
  if (!isSmsImportSupported()) return;
  try {
    await SmsReader.configure({ addresses, autoCapture });
  } catch (error) {
    console.warn("Could not save the SMS configuration:", error);
  }
}

/** Messages captured by the receiver that are still awaiting review. */
export async function getPendingSms(): Promise<SmsMessage[]> {
  if (!isSmsImportSupported()) return [];
  try {
    const { messages } = await SmsReader.getPending();
    return messages ?? [];
  } catch (error) {
    console.warn("Could not read the pending SMS queue:", error);
    return [];
  }
}

/**
 * Clears queued messages. Called only once a message has actually been
 * imported or the user dismissed it, so nothing is dropped by accident.
 */
export async function resolvePendingSms(ids: string[]): Promise<void> {
  if (!isSmsImportSupported() || ids.length === 0) return;
  try {
    await SmsReader.resolvePending({ ids });
  } catch (error) {
    console.warn("Could not update the pending SMS queue:", error);
  }
}

/**
 * Subscribes to new-message notifications while the app is open.
 *
 * Returns a no-op handle elsewhere, so callers do not need to branch on
 * platform.
 */
export async function onSmsPending(cb: (payload: { count: number }) => void): Promise<{
  remove: () => void;
}> {
  if (!isSmsImportSupported()) {
    return { remove: () => {} };
  }
  try {
    return await SmsReader.addListener("smsPending", cb);
  } catch (error) {
    console.warn("Could not listen for incoming SMS:", error);
    return { remove: () => {} };
  }
}