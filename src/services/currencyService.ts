import type { Transaction } from "../types/expense";

interface RateCache {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

let cachedRates: RateCache | null = null;

function loadCache(): RateCache | null {
  try {
    const raw = localStorage.getItem("expense_rates");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RateCache;
    if (Date.now() - parsed.timestamp > 3600000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(base: string, rates: Record<string, number>) {
  localStorage.setItem("expense_rates", JSON.stringify({ base, rates, timestamp: Date.now() }));
}

export async function fetchRates(): Promise<Record<string, number>> {
  const cached = loadCache();
  if (cached) {
    cachedRates = cached;
    return cached.rates;
  }

  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawzahmed0/currency-api@latest/v1/currencies/usd.json",
    );
    const data = (await res.json()) as { usd?: Record<string, number> };
    const raw: Record<string, number> = data.usd ?? {};
    const rates: Record<string, number> = {};
    for (const [key, val] of Object.entries(raw)) {
      rates[key.toUpperCase()] = val;
    }
    rates.USD = 1;
    saveCache("USD", rates);
    cachedRates = { base: "USD", rates, timestamp: Date.now() };
    return rates;
  } catch {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=USD");
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rates: Record<string, number> = { USD: 1, ...data.rates };
      saveCache("USD", rates);
      cachedRates = { base: "USD", rates, timestamp: Date.now() };
      return rates;
    } catch {
      if (cachedRates) return cachedRates.rates;
      return { USD: 1 };
    }
  }
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  const inUSD = amount / fromRate;
  return inUSD * toRate;
}

export async function convertTransactions(
  transactions: Transaction[],
  targetCurrency: string,
): Promise<Transaction[]> {
  const rates = await fetchRates();
  return transactions.map((t) => ({
    ...t,
    amount: convertAmount(t.amount, t.currency || "USD", targetCurrency, rates),
    currency: targetCurrency,
  }));
}

export async function getConvertedTotals(
  transactions: Transaction[],
  targetCurrency: string,
): Promise<{ totalIncome: number; totalExpenses: number }> {
  const rates = await fetchRates();
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    const converted = convertAmount(t.amount, t.currency || "USD", targetCurrency, rates);
    if (t.type === "income") {
      totalIncome += converted;
    } else {
      totalExpenses += converted;
    }
  }

  return { totalIncome, totalExpenses };
}
