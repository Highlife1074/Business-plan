import type { Plan } from "./types";
import type { Projection } from "./finance";
import { summarize } from "./outreach";

// Contexte envoyé à l'assistant Claude : hypothèses (avec les identifiants des lignes, utilisés
// par l'outil modifier_plan), résultats calculés et analyses. Montants dans la devise du plan.
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
  const day = (iso: string | null) => iso?.slice(0, 10) ?? null;
  const consultations = plan.outreach
    .filter((o) => o.messages.length > 0)
    .map((o) => {
      const supplier = plan.suppliers.find((s) => s.id === o.supplierId);
      const s = summarize(o, plan.sender);
      return {
        fournisseur: supplier?.name,
        objet: plan.quoteNeeds.find((n) => n.id === supplier?.needId)?.item,
        statut: o.status,
        demandeEnvoyee: day(s.requestedAt),
        relances: s.followUpDates.map(day),
        dernierRetour: day(s.lastReplyAt),
        delaiRetourJours: s.replyDelayDays,
        prochaineRelance: day(s.nextFollowUpAt),
      };
    });
  return JSON.stringify(
    {
      projet: plan.meta,
      hypotheses: plan.params,
      resultatsAnnuels: years,
      indicateurs: proj.indicators,
      syntheses: {
        synthese: plan.texts.summary,
        marche: plan.texts.market,
        juridique: plan.texts.legal,
        forces: plan.texts.strengths,
        faiblesses: plan.texts.weaknesses,
        opportunites: plan.texts.opportunities,
        menaces: plan.texts.threats,
        risques: plan.texts.risks,
      },
      devis: quotes,
      devisAObtenir: plan.quoteNeeds,
      suiviConsultations: consultations,
    },
    null,
    1,
  );
}
