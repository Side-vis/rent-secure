/** Format an amount in its own currency, e.g. "UGX 1,200,000" or "$800". */
export function formatMoney(amount: number, currency: string | null | undefined = "USD") {
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown/invalid currency code: fall back to a plain number with the code.
    return `${code} ${Math.round(amount).toLocaleString()}`;
  }
}

/**
 * Sum amounts per currency. Amounts in different currencies must never be added
 * together, so this returns one total per currency code.
 */
export function sumByCurrency(
  rows: Array<{ amount: number | null | undefined; currency: string | null | undefined }>
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount == null || !Number.isFinite(row.amount)) continue;
    const code = (row.currency || "USD").toUpperCase();
    totals.set(code, (totals.get(code) ?? 0) + row.amount);
  }
  return totals;
}

/** "UGX 2,400,000 · $800", or the fallback when there is nothing to show. */
export function formatCurrencyTotals(totals: Map<string, number>, fallback = "—") {
  if (totals.size === 0) return fallback;
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, amount]) => formatMoney(amount, code))
    .join(" · ");
}
