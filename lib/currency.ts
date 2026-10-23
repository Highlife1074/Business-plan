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
  const r = (v: number) => Math.round(v * rate * 100) / 100;
  const p = plan.params;
  return {
    ...plan,
    meta: { ...plan.meta, currency: to },
    params: {
      ...p,
      revenueStreams: p.revenueStreams.map((s) => ({ ...s, unitPrice: r(s.unitPrice) })),
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
export async function fetchRates(base: string): Promise<Rates> {
  const key = CACHE + base;
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? "null") as (Rates & { at: number }) | null;
    if (cached && Date.now() - cached.at < MAX_AGE) return cached;
  } catch {}

  let result: Rates | null = null;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const d = (await res.json()) as { result?: string; time_last_update_utc?: string; rates?: Record<string, number> };
    if (d.result === "success" && d.rates) {
      result = { base, date: new Date(d.time_last_update_utc ?? Date.now()).toISOString().slice(0, 10), rates: d.rates };
    }
  } catch {}
  if (!result) {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.min.json`);
    if (!res.ok) throw new Error("Taux de change indisponibles (connexion ?)");
    const d = (await res.json()) as { date: string } & Record<string, Record<string, number>>;
    const lower = d[base.toLowerCase()] ?? {};
    result = {
      base,
      date: d.date,
      rates: Object.fromEntries(Object.entries(lower).map(([k, v]) => [k.toUpperCase(), v])),
    };
  }
  try {
    localStorage.setItem(key, JSON.stringify({ ...result, at: Date.now() }));
  } catch {}
  return result;
}
