import { createClient } from "@supabase/supabase-js";
import type { Transaction, TransactionType } from "../types/expense";

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error(
    "Missing VITE_SUPABASE_URL. Copy .env.example to .env and set it to your Supabase project URL " +
      "(Project Settings -> Data API -> Project URL).",
  );
}

if (!anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and set it to the anon public key " +
      "(Project Settings -> Data API -> API Keys -> anon public). Never use the service_role key here.",
  );
}

/** Supabase is the only backend: Auth, Postgres (PostgREST) and Storage. */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const TRANSACTIONS_TABLE = "transactions";
export const RECEIPTS_BUCKET = "receipts";
export const RECEIPT_URL_TTL_SECONDS = 3600;

/** A row of `public.transactions` exactly as Postgres returns it. */
export interface TransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number | string;
  currency: string;
  date: string;
  category: string;
  description: string;
  receipt_path: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Columns the client is allowed to write. */
export interface TransactionInsert {
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  category: string;
  description: string;
  receipt_path?: string | null;
}

async function resolveReceiptUrl(receiptPath: string | null): Promise<string | undefined> {
  if (!receiptPath) return undefined;

  try {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(receiptPath, RECEIPT_URL_TTL_SECONDS);

    if (error) {
      console.warn("Could not create a signed receipt URL:", error.message);
      return undefined;
    }

    return data?.signedUrl;
  } catch (error) {
    console.warn("Could not create a signed receipt URL:", error);
    return undefined;
  }
}

/** Maps a snake_case Postgres row onto the app's `Transaction` shape. */
export async function mapRow(row: TransactionRow): Promise<Transaction> {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type === "income" ? "income" : "expense",
    amount: Number(row.amount),
    currency: row.currency,
    date: row.date,
    category: row.category,
    description: row.description ?? "",
    receiptUrl: await resolveReceiptUrl(row.receipt_path),
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}
