import type { Plan, Sender } from "./types";

export const DEFAULT_SENDER: Sender = {
  name: "",
  company: "",
  phone: "",
  email: "",
  followUpDays: 5,
  maxFollowUps: 2,
};

// Complète les plans créés avant l'ajout de nouvelles rubriques (démarches…)
export function normalizePlan(plan: Plan): Plan {
  return {
    ...plan,
    chat: plan.chat ?? [],
    quotes: plan.quotes ?? [],
    quoteNeeds: plan.quoteNeeds ?? [],
    suppliers: plan.suppliers ?? [],
    outreach: plan.outreach ?? [],
    sender: { ...DEFAULT_SENDER, ...(plan.sender ?? {}) },
  };
}
