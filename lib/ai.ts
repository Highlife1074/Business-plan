import { z } from "zod";
import type { Plan } from "./types";
import { uid } from "./uid";

// Schéma de la réponse demandée à Claude lors de la génération d'un business plan.
// Tous les champs sont requis : Claude doit fournir une base complète, modifiable ensuite.
const level = z.enum(["faible", "moyen", "élevé"]);

// La génération se fait en deux appels (chiffres, puis textes) : un schéma unique
// dépasse la taille de grammaire acceptée par les sorties structurées de l'API.
export const FiguresSchema = z.object({
  name: z.string().describe("Nom court du projet"),
  currency: z.string().describe("Code devise ISO 4217 du pays (EUR, PLN, MAD, CHF…)"),
  description: z.string().describe("Description du concept en 2-3 phrases"),
  params: z.object({
    startDate: z.string().describe("Mois de démarrage de l'activité, format YYYY-MM"),
    horizonYears: z.number().describe("Horizon de projection en années (5 recommandé)"),
    vatRatePct: z.number().describe("Taux de TVA standard applicable à l'activité, en %"),
    corporateTaxPct: z.number().describe("Taux d'impôt sur les sociétés applicable à une PME, en %"),
    employerChargesPct: z.number().describe("Charges patronales en % du salaire brut"),
    inflationPct: z.number().describe("Inflation annuelle retenue pour indexer prix et charges, en %"),
    discountRatePct: z.number().describe("Taux d'actualisation pour la VAN, en %"),
    seasonality: z
      .array(z.number())
      .describe("Exactement 12 coefficients de saisonnalité de janvier à décembre, moyenne égale à 1"),
    rampUpMonths: z.number().describe("Durée de montée en charge en mois"),
    rampUpStartPct: z.number().describe("Activité du premier mois en % du régime de croisière"),
    revenueStreams: z.array(
      z.object({
        label: z.string(),
        unitLabel: z.string().describe("Unité vendue : lavage, pizza, couvert, client…"),
        unitPrice: z.number().describe("Prix de vente moyen HT par unité, dans la devise locale"),
        unitsPerDay: z.number().describe("Unités vendues par jour d'ouverture en régime de croisière"),
        openDaysPerMonth: z.number(),
        variableCostPct: z.number().describe("Coût variable direct en % du CA de cette ligne"),
        growthPct: z.number().describe("Croissance annuelle des volumes en %"),
        note: z.string().describe("Justification courte de l'hypothèse"),
      }),
    ),
    fixedCosts: z.array(
      z.object({
        label: z.string(),
        monthly: z.number().describe("Montant mensuel HT dans la devise locale"),
        note: z.string(),
      }),
    ),
    staff: z.array(
      z.object({
        role: z.string(),
        count: z.number(),
        grossMonthly: z.number().describe("Salaire brut mensuel par personne, devise locale"),
        startMonth: z.number().describe("Mois d'embauche (1 = ouverture)"),
      }),
    ),
    investments: z.array(
      z.object({
        label: z.string(),
        amount: z.number().describe("Montant HT dans la devise locale"),
        depreciationYears: z.number().describe("Durée d'amortissement ; 0 pour BFR, dépôts, terrain"),
        note: z.string(),
      }),
    ),
    financing: z.object({
      equity: z.number(),
      subsidies: z.number(),
      loans: z.array(
        z.object({
          label: z.string(),
          amount: z.number(),
          ratePct: z.number(),
          years: z.number(),
          deferralMonths: z.number(),
        }),
      ),
    }),
  }),
});

export const TextsSchema = z.object({
  summary: z
    .string()
    .describe("Synthèse exécutive (3-4 paragraphes séparés par une ligne vide) : concept, marché, chiffres clés, financement"),
  market: z.string().describe("Analyse du marché local et de la concurrence (1-2 paragraphes)"),
  legal: z
    .array(z.object({ title: z.string(), content: z.string() }))
    .describe(
      "Points juridiques propres au pays : forme juridique conseillée, immatriculation, licences et autorisations, normes sectorielles, fiscalité, social, assurances obligatoires",
    ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  opportunities: z.array(z.string()),
  threats: z.array(z.string()),
  risks: z.array(
    z.object({ risk: z.string(), probability: level, impact: level, mitigation: z.string() }),
  ),
  keyAssumptions: z.array(z.string()),
  quoteNeeds: z
    .array(z.object({ item: z.string(), category: z.string(), estimatedAmount: z.number() }))
    .describe("Liste des devis à obtenir auprès de fournisseurs pour fiabiliser le plan"),
});

export const GeneratedPlanSchema = FiguresSchema.extend(TextsSchema.shape);

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

export interface GenerateRequest {
  businessType: string;
  country: string;
  city: string;
  budget: string;
  details: string;
}

export const GENERATE_SYSTEM = `Tu es un expert-comptable et consultant en création d'entreprise international.
Tu construis des business plans réalistes et prudents pour des petites et moyennes entreprises.

Règles :
- Tous les montants sont dans la devise locale du pays, hors taxes.
- Les hypothèses doivent refléter les prix, salaires, loyers, taux d'intérêt et règles fiscales réels du pays et de la ville indiqués ; reste prudent plutôt qu'optimiste.
- Le financement (apport + subventions + prêts) doit couvrir le total des investissements, et inclure une ligne "Trésorerie de départ / BFR" non amortissable dans les investissements.
- Le volet juridique doit être concret et spécifique au pays (noms locaux des formes juridiques, registres, autorisations).
- Rédige tout le texte en français.`;

function briefLines(req: GenerateRequest): string[] {
  return [
    `Type d'activité : ${req.businessType}`,
    `Pays : ${req.country}`,
    req.city ? `Ville / région : ${req.city}` : "",
    req.budget ? `Budget ou apport envisagé : ${req.budget}` : "",
    req.details ? `Précisions du porteur de projet : ${req.details}` : "",
  ].filter(Boolean);
}

export function figuresPrompt(req: GenerateRequest): string {
  return [
    ...briefLines(req),
    "",
    "Établis les hypothèses chiffrées détaillées du business plan : lignes de revenus, charges fixes, personnel, investissements et financement, ainsi que les paramètres généraux (fiscalité, inflation, saisonnalité, montée en charge).",
  ].join("\n");
}

export function textsPrompt(req: GenerateRequest, figures: z.infer<typeof FiguresSchema>): string {
  return [
    ...briefLines(req),
    "",
    "Hypothèses chiffrées déjà retenues pour ce projet (JSON) :",
    JSON.stringify(figures),
    "",
    "Rédige, en cohérence avec ces chiffres : la synthèse exécutive, l'analyse du marché, le volet juridique propre au pays, le SWOT, les risques, les hypothèses clés et la liste des devis à obtenir.",
  ].join("\n");
}


// Transforme la réponse de Claude en Plan exploitable par l'application.
export function toPlan(g: GeneratedPlan, req: GenerateRequest): Plan {
  const now = new Date().toISOString();
  const p = g.params;
  const season =
    p.seasonality.length === 12 ? p.seasonality : new Array(12).fill(1);
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    meta: {
      name: g.name,
      businessType: req.businessType,
      country: req.country,
      city: req.city,
      currency: /^[A-Z]{3}$/.test(g.currency) ? g.currency : "EUR",
      description: g.description,
    },
    params: {
      startDate: /^\d{4}-\d{2}$/.test(p.startDate) ? p.startDate : new Date().toISOString().slice(0, 7),
      horizonYears: p.horizonYears || 5,
      vatRatePct: p.vatRatePct,
      corporateTaxPct: p.corporateTaxPct,
      employerChargesPct: p.employerChargesPct,
      inflationPct: p.inflationPct,
      discountRatePct: p.discountRatePct || 10,
      seasonality: season,
      rampUpMonths: p.rampUpMonths,
      rampUpStartPct: p.rampUpStartPct,
      revenueStreams: p.revenueStreams.map((s) => ({ id: uid(), ...s })),
      fixedCosts: p.fixedCosts.map((c) => ({ id: uid(), ...c })),
      staff: p.staff.map((s) => ({ id: uid(), ...s })),
      investments: p.investments.map((i) => ({ id: uid(), ...i })),
      financing: {
        equity: p.financing.equity,
        subsidies: p.financing.subsidies,
        loans: p.financing.loans.map((l) => ({ id: uid(), ...l })),
      },
      scenario: { volumePct: 100, pricePct: 100, costPct: 100 },
    },
    texts: {
      summary: g.summary,
      market: g.market,
      legal: g.legal.map((l) => ({ id: uid(), ...l })),
      strengths: g.strengths,
      weaknesses: g.weaknesses,
      opportunities: g.opportunities,
      threats: g.threats,
      risks: g.risks.map((r) => ({ id: uid(), ...r })),
      keyAssumptions: g.keyAssumptions,
    },
    quotes: [],
    quoteNeeds: g.quoteNeeds.map((q) => ({ id: uid(), ...q, done: false })),
    chat: [],
  };
}

export const ASK_SYSTEM = `Tu es le conseiller financier et juridique intégré à un simulateur de business plan.
Tu réponds en français, de façon concrète et chiffrée, en t'appuyant sur les données du plan fournies (paramètres et résultats calculés).
Quand tu recommandes de modifier une hypothèse, cite précisément le paramètre concerné et la nouvelle valeur proposée, pour que l'utilisateur puisse l'ajuster dans l'onglet Paramètres.
Signale clairement ce qui relève d'une estimation à vérifier (devis, expert-comptable, avocat local).`;
