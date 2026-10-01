/**
 * Axis tick formatting for the responsive charts.
 *
 * Recharts renders the Y axis at its natural label width. A fully formatted
 * amount like "$12,345.67" needs roughly 70px, which on a 360px phone leaves
 * the plot area too narrow to read, so ticks are abbreviated instead. The
 * tooltip still shows the exact figure.
 */
export function compactAxisValue(value: number): string {
  if (!Number.isFinite(value)) return "";

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}k`;
  if (abs >= 100) return String(Math.round(value));
  return String(Math.round(value * 100) / 100);
}

function trim(value: number): string {
  // One decimal place, and only when it carries information ("1.5k" not "1.0k").
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
