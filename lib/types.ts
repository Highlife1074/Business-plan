// Modèle de données d'un business plan.
// Les paramètres chiffrés (Params) sont la seule source de vérité :
// tous les tableaux (résultats, trésorerie, point mort…) sont recalculés à partir d'eux.

export interface RevenueStream {
  id: string;
  label: string;
  unitLabel: string; // ex. "lavage", "pizza", "client"
  unitPrice: number; // prix de vente HT par unité
  unitsPerDay: number; // volume moyen par jour d'ouverture, en régime de croisière
  openDaysPerMonth: number;
  variableCostPct: number; // ancien coût variable par ligne (repris dans variableCosts, laissé à 0)
  growthPct: number; // croissance annuelle des volumes
  note: string;
}

// Charge variable : proportionnelle au CA (%) ou au nombre d'unités vendues (montant par unité)
export interface VariableCost {
  id: string;
  label: string;
  mode: "pct" | "unit";
  value: number; // % du CA, ou montant HT par unité vendue (devise du plan)
  streamId: string | null; // ligne de CA concernée ; null = toutes les lignes
  note: string;
}

export interface FixedCost {
  id: string;
  label: string;
  monthly: number; // montant mensuel HT
  note: string;
}

export interface StaffLine {
  id: string;
  role: string;
  count: number;
  grossMonthly: number; // salaire brut mensuel par personne
  startMonth: number; // 1 = premier mois d'activité
}

export interface Investment {
  id: string;
  label: string;
  amount: number; // HT
  depreciationYears: number; // 0 = non amortissable (terrain, BFR, caution…)
  note: string;
}

export interface Loan {
  id: string;
  label: string;
  amount: number;
  ratePct: number; // taux annuel
  years: number; // durée totale, différé compris
  deferralMonths: number; // différé d'amortissement (intérêts seuls)
}

export interface Financing {
  equity: number; // apport en capital
  subsidies: number; // subventions
  loans: Loan[];
}

export interface Scenario {
  volumePct: number; // 100 = réaliste
  pricePct: number;
  costPct: number;
}

export interface Params {
  startDate: string; // "YYYY-MM"
  horizonYears: number;
  vatRatePct: number;
  corporateTaxPct: number;
  employerChargesPct: number; // charges patronales en % du brut
  inflationPct: number; // indexation annuelle des prix et des charges
  discountRatePct: number; // taux d'actualisation pour la VAN
  seasonality: number[]; // 12 coefficients, janvier → décembre (1 = mois moyen)
  rampUpMonths: number; // durée de montée en charge
  rampUpStartPct: number; // % du régime de croisière au premier mois
  revenueStreams: RevenueStream[];
  variableCosts: VariableCost[];
  fixedCosts: FixedCost[];
  staff: StaffLine[];
  investments: Investment[];
  financing: Financing;
  scenario: Scenario;
}

export interface LegalItem {
  id: string;
  title: string;
  content: string;
}

export type Level = "faible" | "moyen" | "élevé";

export interface Risk {
  id: string;
  risk: string;
  probability: Level;
  impact: Level;
  mitigation: string;
}

export type QuoteStatus = "à demander" | "reçu" | "retenu" | "refusé";

export interface Quote {
  id: string;
  supplier: string;
  label: string;
  amount: number; // HT
  kind: "investissement" | "charge mensuelle";
  // Ligne du business plan alimentée par ce devis lorsqu'il est "retenu"
  linkedId: string | null;
  status: QuoteStatus;
  date: string;
  validUntil: string;
  contact: string;
  notes: string;
}

export interface QuoteNeed {
  id: string;
  item: string;
  category: string;
  estimatedAmount: number;
  done: boolean;
}

// --- Démarches : recherche de fournisseurs, e-mails, suivi et relances ---

export interface Supplier {
  id: string;
  needId: string; // devis à obtenir concerné (QuoteNeed.id)
  name: string;
  email: string;
  website: string;
  phone: string;
  city: string;
  notes: string;
  source: "claude" | "manuel";
}

export interface OutreachMessage {
  id: string;
  direction: "envoyé" | "reçu";
  kind: "demande" | "relance" | "réponse";
  from: string;
  subject: string;
  body: string;
  date: string; // ISO
  gmailId: string | null;
}

export type OutreachStatus = "brouillon" | "envoyé" | "relancé" | "réponse reçue" | "devis enregistré" | "clos";

export interface ReplyAnalysis {
  summary: string;
  hasQuote: boolean;
  amount: number; // HT, 0 si aucun montant
  kind: "investissement" | "charge mensuelle";
  linkedId: string | null; // ligne du plan concernée
  conditions: string;
  nextStep: string;
}

export interface Outreach {
  id: string;
  supplierId: string;
  status: OutreachStatus;
  to: string;
  subject: string;
  draft: string; // brouillon en cours (demande ou relance)
  draftKind: "demande" | "relance";
  threadId: string | null;
  lastSentAt: string | null;
  followUps: number;
  messages: OutreachMessage[];
  analysis: ReplyAnalysis | null;
  quoteId: string | null;
}

export interface Sender {
  name: string;
  company: string;
  phone: string;
  email: string;
  followUpDays: number; // délai avant relance
  maxFollowUps: number;
}

export interface Texts {
  summary: string;
  market: string;
  legal: LegalItem[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  risks: Risk[];
  keyAssumptions: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Plan {
  id: string;
  createdAt: string;
  updatedAt: string;
  meta: {
    name: string;
    businessType: string;
    country: string;
    city: string;
    currency: string; // code ISO 4217
    description: string;
  };
  params: Params;
  texts: Texts;
  quotes: Quote[];
  quoteNeeds: QuoteNeed[];
  chat: ChatMessage[];
  suppliers: Supplier[];
  outreach: Outreach[];
  sender: Sender;
}
