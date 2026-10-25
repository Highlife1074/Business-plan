import type { Params, Plan, Sender } from "./types";

export const DEFAULT_SENDER: Sender = {
  name: "",
  company: "",
  phone: "",
  email: "",
  followUpDays: 5,
  maxFollowUps: 2,
};

// Anciens plans : le coût variable était un % saisi dans chaque ligne de CA.
// Il devient une ligne de la section « Charges variables » rattachée à cette ligne de CA.
export function migrateVariableCosts(params: Params): Params {
  if (Array.isArray(params.variableCosts)) return params;
  return {
    ...params,
    variableCosts: params.revenueStreams
      .filter((s) => (s.variableCostPct || 0) > 0)
      .map((s) => ({
        id: `vc-${s.id}`,
        label: `Coûts variables — ${s.label}`,
        mode: "pct" as const,
        value: s.variableCostPct,
        streamId: s.id,
        note: "Matières, consommables, commissions…",
      })),
    revenueStreams: params.revenueStreams.map((s) => ({ ...s, variableCostPct: 0 })),
  };
}

// Complète les plans créés avant l'ajout de nouvelles rubriques (démarches, charges variables…)
export function normalizePlan(plan: Plan): Plan {
  return {
    ...plan,
    params: migrateVariableCosts(plan.params),
    chat: plan.chat ?? [],
    quotes: plan.quotes ?? [],
    quoteNeeds: plan.quoteNeeds ?? [],
    suppliers: plan.suppliers ?? [],
    outreach: plan.outreach ?? [],
    sender: { ...DEFAULT_SENDER, ...(plan.sender ?? {}) },
  };
}
