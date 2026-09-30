export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  category: string;
  description: string;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type ExpenseCategory =
  | "Travel"
  | "Food"
  | "Equipment"
  | "Utility Bills"
  | "Salaries"
  | "Office Supplies"
  | "Marketing"
  | "Insurance"
  | "Rent"
  | "Other";

export type IncomeCategory =
  | "Sales"
  | "Services"
  | "Investments"
  | "Salary"
  | "Freelance"
  | "Rental Income"
  | "Other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Travel",
  "Food",
  "Equipment",
  "Utility Bills",
  "Salaries",
  "Office Supplies",
  "Marketing",
  "Insurance",
  "Rent",
  "Other",
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  "Sales",
  "Services",
  "Investments",
  "Salary",
  "Freelance",
  "Rental Income",
  "Other",
];

export const CATEGORY_COLORS: Record<string, string> = {
  Travel: "#3b82f6",
  Food: "#ef4444",
  Equipment: "#8b5cf6",
  "Utility Bills": "#f59e0b",
  Salaries: "#10b981",
  "Office Supplies": "#06b6d4",
  Marketing: "#ec4899",
  Insurance: "#6366f1",
  Rent: "#84cc16",
  Other: "#6b7280",
  Sales: "#14b8a6",
  Services: "#0ea5e9",
  Investments: "#a855f7",
  Salary: "#f97316",
  Freelance: "#eab308",
  "Rental Income": "#d946ef",
};

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "MXN", symbol: "Mex$", name: "Mexican Peso" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
];

const currencySymbolMap: Record<string, string> = {};
for (const c of CURRENCIES) {
  currencySymbolMap[c.code] = c.symbol;
}

export function getCurrencySymbol(code: string): string {
  return currencySymbolMap[code] || code;
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
  }
}
