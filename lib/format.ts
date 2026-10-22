export function money(value: number, currency: string, compact = false): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? "compact" : "standard",
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("fr-FR")} ${currency}`;
  }
}

export function num(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function pct(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${num(value, digits)} %` : "—";
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function monthName(label: string | null): string {
  if (!label) return "—";
  const [y, m] = label.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}
