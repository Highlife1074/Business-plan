import type { Plan } from "./types";
import type { Projection } from "./finance";

// Contexte textuel envoyé à l'assistant Claude : hypothèses, résultats calculés et analyses.
export function planContext(plan: Plan, proj: Projection): string {
  const r = (n: number) => (Number.isFinite(n) ? Math.round(n) : null);
  const years = proj.years.map((y) => ({
    annee: y.year,
    ca: r(y.revenue),
    margeBrute: r(y.grossMargin),
    chargesFixes: r(y.fixedCosts),
    personnel: r(y.staffCosts),
    ebe: r(y.ebitda),
    amortissements: r(y.depreciation),
    resultatExploitation: r(y.operatingIncome),
    interets: r(y.interest),
    impot: r(y.tax),
    resultatNet: r(y.netIncome),
    caf: r(y.cashFlowFromOps),
    tresorerieFin: r(y.endCash),
    seuilRentabilite: r(y.breakEvenRevenue),
    pointMortJours: y.breakEvenDays === null ? null : r(y.breakEvenDays),
  }));
  const quotes = plan.quotes.map((q) => ({
    fournisseur: q.supplier,
    objet: q.label,
    montant: q.amount,
    type: q.kind,
    statut: q.status,
  }));
  return JSON.stringify(
    {
      projet: plan.meta,
      hypotheses: plan.params,
      resultatsAnnuels: years,
      indicateurs: proj.indicators,
      syntheses: {
        synthese: plan.texts.summary,
        marche: plan.texts.market,
        juridique: plan.texts.legal.map((l) => `${l.title} : ${l.content}`),
        forces: plan.texts.strengths,
        faiblesses: plan.texts.weaknesses,
        opportunites: plan.texts.opportunities,
        menaces: plan.texts.threats,
        risques: plan.texts.risks,
      },
      devis: quotes,
    },
    null,
    1,
  );
}
