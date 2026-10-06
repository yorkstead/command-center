const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return dollars.format(cents / 100);
}

/** Parses "7,500" or "$7500.50" into whole cents. Returns null for blank input. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) throw new Error("Enter a dollar amount");
  return Math.round(value * 100);
}
