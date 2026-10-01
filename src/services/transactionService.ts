import type { User } from "@supabase/supabase-js";
import {
  mapRow,
  RECEIPTS_BUCKET,
  supabase,
  TRANSACTIONS_TABLE,
  type TransactionInsert,
  type TransactionRow,
} from "../lib/supabase";
import type { Transaction, TransactionType } from "../types/expense";

/**
 * Partial update payload. `receiptUrl` is special:
 *  - omitted / `undefined` -> leave the stored receipt exactly as it is
 *  - `null`                -> explicitly remove the stored receipt
 * A brand new file passed as the third argument replaces the stored receipt.
 */
export type TransactionUpdates = Omit<
  Partial<Omit<Transaction, "id" | "userId" | "createdAt">>,
  "receiptUrl"
> & {
  receiptUrl?: string | null;
};

async function assertNotSignedOut(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in to do that. Please log in again.");
  }
}

async function requireUser(): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("You must be signed in to do that. Please log in again.");
  }
  return data.user;
}

/**
 * The `userId` argument exists only so existing call sites keep working.
 * Row Level Security derives the real owner from the Supabase JWT, so a
 * mismatched value can never widen access - it is only logged.
 */
async function warnOnUserIdMismatch(userId?: string): Promise<void> {
  if (!userId) return;
  const { data } = await supabase.auth.getSession();
  const sessionUserId = data.session?.user.id;
  if (sessionUserId && sessionUserId !== userId) {
    console.warn(
      "Query userId does not match the signed-in user. Supabase RLS scopes the " +
        "result to the signed-in user, so the passed userId is ignored.",
    );
  }
}

async function fetchRow(id: string): Promise<TransactionRow | null> {
  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load transaction: ${error.message}`);
  }

  return (data as TransactionRow | null) ?? null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function mapRows(rows: TransactionRow[]): Promise<Transaction[]> {
  const CONCURRENCY = 4;
  const results: Transaction[] = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map((r) => mapRow(r)))));
  }
  return results;
}

export async function createTransaction(
  transaction: Omit<Transaction, "id" | "createdAt">,
  receiptFile?: File,
): Promise<string> {
  await assertNotSignedOut();
  const user = await requireUser();
  await warnOnUserIdMismatch(transaction.userId);

  let receiptPath: string | null = null;
  if (receiptFile) {
    receiptPath = await uploadReceipt(receiptFile, user.id);
  }

  const insert: TransactionInsert = {
    user_id: user.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.date,
    category: transaction.category,
    description: transaction.description,
    receipt_path: receiptPath,
  };

  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    if (receiptPath) await deleteReceipt(receiptPath);
    throw new Error(`Failed to save transaction: ${error.message}`);
  }

  const newId = (data as { id: string } | null)?.id;
  if (!newId) {
    throw new Error("Failed to save transaction: the database did not return an id.");
  }

  return newId;
}

export async function updateTransaction(
  transactionId: string,
  updates: TransactionUpdates,
  receiptFile?: File,
): Promise<void> {
  await assertNotSignedOut();
  const existing = await fetchRow(transactionId);

  const patch: Partial<TransactionInsert> = {};
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.amount !== undefined) patch.amount = updates.amount;
  if (updates.currency !== undefined) patch.currency = updates.currency;
  if (updates.date !== undefined) patch.date = updates.date;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.description !== undefined) patch.description = updates.description;

  // Storage is cleaned up only after the row has been updated, so a failed
  // update leaves the previous receipt intact and reachable.
  let staleReceipt: string | null = null;

  if (receiptFile) {
    const user = await requireUser();
    patch.receipt_path = await uploadReceipt(receiptFile, user.id);
    if (existing?.receipt_path && existing.receipt_path !== patch.receipt_path) {
      staleReceipt = existing.receipt_path;
    }
  } else if (updates.receiptUrl === null) {
    patch.receipt_path = null;
    staleReceipt = existing?.receipt_path ?? null;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .update(patch)
    .eq("id", transactionId);

  if (error) {
    // A brand new upload is now unreferenced, so drop it to avoid an orphan.
    if (receiptFile && patch.receipt_path) {
      await deleteReceipt(patch.receipt_path);
    }
    throw new Error(`Failed to update transaction: ${error.message}`);
  }

  if (staleReceipt) {
    await deleteReceipt(staleReceipt);
  }
}

export async function getTransactionsByType(
  userId: string,
  type: TransactionType,
): Promise<Transaction[]> {
  await assertNotSignedOut();
  await warnOnUserIdMismatch(userId);

  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select("*")
    .eq("type", type)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load transactions: ${error.message}`);
  }

  return mapRows((data ?? []) as TransactionRow[]);
}

export async function getTransactionsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Transaction[]> {
  await assertNotSignedOut();
  await warnOnUserIdMismatch(userId);

  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select("*")
    .gte("date", toDateOnly(startDate))
    .lte("date", toDateOnly(endDate))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load transactions: ${error.message}`);
  }

  return mapRows((data ?? []) as TransactionRow[]);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await assertNotSignedOut();

  // Read the receipt path before deleting the row. The row is removed first so
  // that a storage failure can only orphan an image, never lose one.
  const existing = await fetchRow(transactionId);

  const { error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .delete()
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to delete transaction: ${error.message}`);
  }

  if (existing?.receipt_path) {
    await deleteReceipt(existing.receipt_path);
  }
}

export async function getTransactionsByUser(userId: string): Promise<Transaction[]> {
  await assertNotSignedOut();
  await warnOnUserIdMismatch(userId);

  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load transactions: ${error.message}`);
  }

  return mapRows((data ?? []) as TransactionRow[]);
}

export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  await assertNotSignedOut();
  const row = await fetchRow(transactionId);
  return row ? mapRow(row) : null;
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned.slice(-80) : "receipt";
}

/**
 * Uploads into the private `receipts` bucket under `<user-id>/<ts>_<name>`,
 * which is the layout the storage RLS policies expect.
 */
async function uploadReceipt(file: File, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}_${safeFileName(file.name)}`;

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  return path;
}

/** Deletes by storage path (never by URL) and never throws. */
async function deleteReceipt(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
    if (error) {
      console.error("Error deleting receipt:", error.message);
    }
  } catch (error) {
    console.error("Error deleting receipt:", error);
  }
}