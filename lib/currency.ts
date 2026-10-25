import type { Plan } from "./types";

// Devises proposées dans le convertisseur (toutes celles reconnues par Intl restent utilisables)
export const CURRENCIES: { code: string; label: string }[] = [
  { code: "EUR", label: "Euro" },
  { code: "USD", label: "Dollar américain" },
  { code: "GBP", label: "Livre sterling" },
  { code: "CHF", label: "Franc suisse" },
  { code: "PLN", label: "Zloty polonais" },
  { code: "CZK", label: "Couronne tchèque" },
  { code: "HUF", label: "Forint hongrois" },
  { code: "RON", label: "Leu roumain" },
  { code: "SEK", label: "Couronne suédoise" },
  { code: "NOK", label: "Couronne norvégienne" },
  { code: "DKK", label: "Couronne danoise" },
  { code: "CAD", label: "Dollar canadien" },
  { code: "MAD", label: "Dirham marocain" },
  { code: "TND", label: "Dinar tunisien" },
  { code: "DZD", label: "Dinar algérien" },
  { code: "XOF", label: "Franc CFA (BCEAO)" },
  { code: "AED", label: "Dirham des Émirats" },
  { code: "TRY", label: "Livre turque" },
  { code: "JPY", label: "Yen" },
  { code: "CNY", label: "Yuan" },
];

// Convertit définitivement tous les montants du plan dans une autre devise
// (prix, charges, salaires, investissements, financement, devis, estimations).
// Les pourcentages, volumes et durées ne changent pas.
export function convertPlan(plan: Plan, to: string, rate: number): Plan {
  // 4 décimales : un prix ou un coût unitaire converti (ex. 0,225 €) ne doit pas être arrondi au centime
  const r = (v: number) => Math.round(v * rate * 10000) / 10000;
  const p = plan.params;
  return {
    ...plan,
    meta: { ...plan.meta, currency: to },
    params: {
      ...p,
      revenueStreams: p.revenueStreams.map((s) => ({ ...s, unitPrice: r(s.unitPrice) })),
      variableCosts: (p.variableCosts ?? []).map((v) => (v.mode === "unit" ? { ...v, value: r(v.value) } : v)),
      fixedCosts: p.fixedCosts.map((c) => ({ ...c, monthly: r(c.monthly) })),
      staff: p.staff.map((s) => ({ ...s, grossMonthly: r(s.grossMonthly) })),
      investments: p.investments.map((i) => ({ ...i, amount: r(i.amount) })),
      financing: {
        equity: r(p.financing.equity),
        subsidies: r(p.financing.subsidies),
        loans: p.financing.loans.map((l) => ({ ...l, amount: r(l.amount) })),
      },
    },
    quotes: plan.quotes.map((q) => ({ ...q, amount: r(q.amount) })),
    quoteNeeds: plan.quoteNeeds.map((n) => ({ ...n, estimatedAmount: r(n.estimatedAmount) })),
    outreach: (plan.outreach ?? []).map((o) => (o.analysis ? { ...o, analysis: { ...o.analysis, amount: r(o.analysis.amount) } } : o)),
  };
}

export interface Rates {
  base: string;
  date: string;
  rates: Record<string, number>; // 1 base = rates[X] X
}

const CACHE = "bp-sim:rates:";
const MAX_AGE = 12 * 60 * 60 * 1000;

// Taux de change du jour (sources gratuites, sans clé), mis en cache 12 h dans le navigateur.
async function getJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const upper = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toUpperCase(), v]));

// Sources de taux essayées dans l'ordre (gratuites, sans clé, accessibles depuis le navigateur)
const SOURCES: { name: string; load: (base: string) => Promise<Rates> }[] = [
  {
    name: "open.er-api.com",
    load: async (base) => {
      const d = await getJson<{ result?: string; time_last_update_utc?: string; rates?: Record<string, number> }>(
        `https://open.er-api.com/v6/latest/${base}`,
      );
      if (d.result !== "success" || !d.rates) throw new Error("réponse invalide");
      return { base, date: new Date(d.time_last_update_utc ?? Date.now()).toISOString().slice(0, 10), rates: d.rates };
    },
  },
  {
    name: "frankfurter.app (BCE)",
    load: async (base) => {
      const d = await getJson<{ date: string; rates: Record<string, number> }>(`https://api.frankfurter.app/latest?from=${base}`);
      return { base, date: d.date, rates: d.rates };
    },
  },
  ...[
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/`,
    `https://latest.currency-api.pages.dev/v1/currencies/`,
  ].map((prefix) => ({
    name: "currency-api",
    load: async (base: string) => {
      const d = await getJson<{ date: string } & Record<string, Record<string, number>>>(`${prefix}${base.toLowerCase()}.json`);
      return { base, date: d.date, rates: upper(d[base.toLowerCase()] ?? {}) };
    },
  })),
];

// Taux de change du jour, mis en cache 12 h dans le navigateur. `need` : devise recherchée.
export async function fetchRates(base: string, need?: string): Promise<Rates> {
  const key = CACHE + base;
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? "null") as (Rates & { at: number }) | null;
    if (cached && Date.now() - cached.at < MAX_AGE && (!need || cached.rates[need])) return cached;
  } catch {}

  const errors: string[] = [];
  for (const source of SOURCES) {
    try {
      const result = await source.load(base);
      if (need && !(result.rates[need] > 0)) throw new Error(`pas de taux ${need}`);
      try {
        localStorage.setItem(key, JSON.stringify({ ...result, at: Date.now() }));
      } catch {}
      return result;
    } catch (err) {
      errors.push(`${source.name} : ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`Taux de change ${base} → ${need ?? "?"} introuvable (${errors.join(" ; ")}). Saisissez le taux manuellement.`);
}

// Taux saisi à la main (si aucune source n'est joignable), mémorisé par paire de devises
export function manualRate(base: string, to: string): number | null {
  try {
    const v = Number(localStorage.getItem(`bp-sim:manual-rate:${base}-${to}`));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setManualRate(base: string, to: string, rate: number | null) {
  try {
    const k = `bp-sim:manual-rate:${base}-${to}`;
    if (rate && rate > 0) localStorage.setItem(k, String(rate));
    else localStorage.removeItem(k);
  } catch {}
}

// --- Conversion des montants écrits dans les textes (synthèse, juridique, réponses de Claude…) ---

// Écritures possibles d'une devise : code ISO et symboles usuels (ex. PLN, zł ; EUR, € ; USD, $, US$)
export function currencyTokens(code: string): string[] {
  const tokens = new Set<string>([code]);
  for (const display of ["symbol", "narrowSymbol"] as const) {
    for (const locale of ["fr-FR", "en-US"]) {
      try {
        const part = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: display })
          .formatToParts(1)
          .find((p) => p.type === "currency");
        if (part?.value) tokens.add(part.value);
      } catch {}
    }
  }
  return [...tokens].sort((a, b) => b.length - a.length);
}

const MULT: Record<string, number> = { k: 1e3, K: 1e3, M: 1e6, Md: 1e9, Mds: 1e9, Mrd: 1e9 };
const MULT_WORDS: [RegExp, number][] = [
  [/^(?:milliards?|mds?)$/i, 1e9],
  [/^millions?$/i, 1e6],
  [/^(?:milliers?|mille)$/i, 1e3],
];

function parseAmount(raw: string, hasMultiplier: boolean): number | null {
  let s = raw.replace(/[\s  ]/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // le dernier séparateur est le séparateur décimal
    const dec = lastComma > lastDot ? "," : ".";
    const thousands = dec === "," ? "." : ",";
    s = s.split(thousands).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    // « 1,88 » → décimal ; « 1,200,000 » → milliers (sauf devant un multiplicateur : « 1,250 M »)
    s = !hasMultiplier && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    s = !hasMultiplier && /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Remplace chaque montant exprimé dans la devise `base` par son équivalent dans `display`.
export function convertText(text: string, base: string, display: string, rate: number, format: (v: number, compact: boolean) => string): string {
  if (!text || base === display || !(rate > 0)) return text;
  const cur = currencyTokens(base).map(escapeRe).join("|");
  const num = String.raw`\d[\d\s  .,]*\d|\d`;
  const mult = String.raw`(?:k|K|Mds?|Mrd|M|milliards?|millions?|milliers?|mille)`;
  const sp = String.raw`[\s  ]?`;
  // « 1,88 M PLN », « 620 k PLN », « 5 000 PLN », « 2 millions de PLN »
  const after = new RegExp(String.raw`(${num})(?:${sp}(${mult})\.?)?${sp}(?:de${sp}|d')?(${cur})(?![A-Za-z])`, "g");
  // « PLN 5 000 », « zł 120 »
  const before = new RegExp(String.raw`(?<![A-Za-z])(${cur})${sp}(${num})(?:${sp}(${mult})\b)?`, "g");
  const convert = (rawNum: string, rawMult: string | undefined) => {
    const factor = rawMult ? (MULT[rawMult.replace(/\.$/, "")] ?? MULT_WORDS.find(([re]) => re.test(rawMult))?.[1] ?? 1) : 1;
    const value = parseAmount(rawNum, Boolean(rawMult));
    if (value === null) return null;
    return format(value * factor * rate, Boolean(rawMult) || value * factor >= 1e6);
  };
  return text
    .replace(after, (whole, n: string, m: string | undefined) => convert(n, m) ?? whole)
    .replace(before, (whole, _c: string, n: string, m: string | undefined) => convert(n, m) ?? whole);
}
