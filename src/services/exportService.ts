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

export function exportToCSV(transactions: Transaction[], filename: string = "transactions") {
  const headers = [
    "Type",
    "Date",
    "Category",
    "Amount",
    "Currency",
    "Description",
    "Receipt URL",
  ];
  const rows = transactions.map((t) => [
    t.type,
    t.date,
    t.category,
    t.amount.toFixed(2),
    t.currency || "USD",
    t.description || "",
    t.receiptUrl || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportToExcel(transactions: Transaction[], filename: string = "transactions") {
  const data = transactions.map((t) => ({
    Type: t.type,
    Date: t.date,
    Category: t.category,
    Amount: t.amount,
    Currency: t.currency || "USD",
    Description: t.description || "",
    "Receipt URL": t.receiptUrl || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");

  const colWidths = [{ wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 40 }];
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(
  transactions: Transaction[],
  filename: string = "transactions",
  defaultCurrency: string = "USD",
) {
  const doc = new jsPDF();
  const rates = await fetchRates();

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of transactions) {
    const converted = convertAmount(t.amount, t.currency || "USD", defaultCurrency, rates);
    if (t.type === "income") totalIncome += converted;
    else totalExpenses += converted;
  }

  doc.setFontSize(20);
  doc.text("Financial Report", 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  doc.text(`Total Transactions: ${transactions.length}`, 14, 36);
  doc.text(`Total Income: ${formatCurrency(totalIncome, defaultCurrency)}`, 14, 42);
  doc.text(`Total Expenses: ${formatCurrency(totalExpenses, defaultCurrency)}`, 14, 48);
  doc.text(`Net Income: ${formatCurrency(totalIncome - totalExpenses, defaultCurrency)}`, 14, 54);

  const tableData = transactions.map((t) => {
    const convAmount = convertAmount(t.amount, t.currency || "USD", defaultCurrency, rates);
    return [
      t.type === "income" ? "Income" : "Expense",
      t.date,
      t.category,
      `${t.type === "income" ? "+" : "-"}${formatCurrency(convAmount, defaultCurrency)}`,
      t.description || "-",
    ];
  });

  autoTable(doc, {
    startY: 62,
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
