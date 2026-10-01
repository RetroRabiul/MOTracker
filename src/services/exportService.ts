import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Transaction } from "../types/expense";
import { formatCurrency } from "../types/expense";
import { fetchRates, convertAmount } from "./currencyService";

function escapeCsvCell(cell: string): string {
  const escaped = String(cell).replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Receipt URLs are 1-hour signed links, so they are deliberately not exported:
 * a file kept for a week would contain links that 403. `Has Receipt` records
 * that a receipt exists without promising a link that expires.
 */
function toRows(transactions: Transaction[]) {
  return transactions.map((t) => ({
    Type: t.type,
    Date: t.date,
    Category: t.category,
    Amount: t.amount,
    Currency: t.currency || "USD",
    Description: t.description || "",
    "Has Receipt": t.receiptUrl ? "Yes" : "No",
  }));
}

export function exportToCSV(transactions: Transaction[], filename: string = "transactions") {
  const headers = ["Type", "Date", "Category", "Amount", "Currency", "Description", "Has Receipt"];
  const rows = transactions.map((t) => [
    t.type,
    t.date,
    t.category,
    t.amount.toFixed(2),
    t.currency || "USD",
    t.description || "",
    t.receiptUrl ? "Yes" : "No",
  ]);

  const csvContent = [
    headers.map((cell) => escapeCsvCell(cell)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ].join("\n");

  // The BOM keeps Excel from mojibaking non-ASCII category and description text.
  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportToExcel(transactions: Transaction[], filename: string = "transactions") {
  const ws = XLSX.utils.json_to_sheet(toRows(transactions));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  ws["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 34 },
    { wch: 12 },
  ];
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(
  transactions: Transaction[],
  filename: string = "transactions",
  defaultCurrency: string = "USD",
) {
  const doc = new jsPDF();
  const { rates, stale, error, provider, asOf } = await fetchRates();

  // Unconvertible rows keep their original currency rather than being mislabelled.
  const convertedRows: {
    transaction: Transaction;
    amount: number;
    converted: boolean;
  }[] = [];
  for (const t of transactions) {
    const amount = convertAmount(t.amount, t.currency || "USD", defaultCurrency, rates);
    convertedRows.push({ transaction: t, amount: amount ?? t.amount, converted: amount !== null });
  }

  const included = convertedRows.filter((r) => r.converted);
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const row of included) {
    if (row.transaction.type === "income") totalIncome += row.amount;
    else totalExpenses += row.amount;
  }

  let y = 22;
  doc.setFontSize(20);
  doc.text("Financial Report", 14, y);

  doc.setFontSize(11);
  doc.setTextColor(100);
  y += 8;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);
  y += 6;
  doc.text(`Total Transactions: ${transactions.length}`, 14, y);
  y += 6;
  doc.text(`Total Income: ${formatCurrency(totalIncome, defaultCurrency)}`, 14, y);
  y += 6;
  doc.text(`Total Expenses: ${formatCurrency(totalExpenses, defaultCurrency)}`, 14, y);
  y += 6;
  doc.text(`Net Income: ${formatCurrency(totalIncome - totalExpenses, defaultCurrency)}`, 14, y);

  const excluded = convertedRows.length - included.length;
  if (excluded > 0) {
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text(
      `Note: ${excluded} transaction(s) could not be converted to ${defaultCurrency} and are ` +
        "excluded from the totals above. Those rows show their original amount.",
      14,
      y,
      { maxWidth: 180 },
    );
    if (error) {
      y += 5;
      doc.setTextColor(120);
      doc.text(
        stale ? "Using the last saved exchange rates." : "Live exchange rates were unavailable.",
        14,
        y,
        { maxWidth: 180 },
      );
    }
    // A financial report is only auditable if it says which table it used.
    if (provider) {
      y += 5;
      doc.setTextColor(120);
      doc.text(
        `Converted using ${provider} rates${asOf ? ` dated ${asOf}` : ""}.`,
        14,
        y,
        { maxWidth: 180 },
      );
    }
  }

  const tableData = convertedRows.map(({ transaction: t, amount, converted }) => [
    t.type === "income" ? "Income" : "Expense",
    t.date,
    t.category,
    converted
      ? `${t.type === "income" ? "+" : "-"}${formatCurrency(amount, defaultCurrency)}`
      : `${t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)} ${t.currency || "USD"}`,
    t.description || "-",
  ]);

  autoTable(doc, {
    startY: y + 10,
    head: [["Type", "Date", "Category", "Amount", "Description"]],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      3: { halign: "right" },
    },
  });

  doc.save(`${filename}.pdf`);
}
