// Profils sectoriels de la fiche récap : les seuils (vert / orange) dépendent du métier.
// Une pizzeria vit avec un EBE de 12 %, une station de lavage vise 30 % ; une usine amortit
// sur 7 à 10 ans, un cabinet de conseil sur 2 ; une start-up perd de l'argent au début.
// Repères indicatifs tirés des ratios sectoriels courants (banques, centres de gestion).

export type Range = [good: number, warn: number]; // vert si ≥ good, orange si ≥ warn, rouge sinon

export interface SectorProfile {
  id: string;
  label: string;
  note: string; // ce qui distingue le secteur, affiché dans la fiche
  keywords: string[]; // mots détectés dans le type d'activité (sans accents, minuscules)
  equityPct: Range; // fonds propres (apport + subventions) / investissement
  grossMarginPct: Range; // marge sur coûts variables
  ebitdaPct: Range; // EBE / CA
  breakEvenDays: number; // point mort an 1 en jours : vert si ≤, orange jusqu'à 365
  safetyPct: Range; // marge de sécurité
  paybackMonths: Range; // retour sur investissement : vert si ≤ good, orange si ≤ warn (inversé)
  dscr: Range; // couverture de la dette
  earlyLosses?: boolean; // pertes des premières années normales (jugé en rythme de croisière)
}

export const GENERAL: SectorProfile = {
  id: "general",
  label: "Général",
  note: "Repères moyens, toutes activités confondues.",
  keywords: [],
  equityPct: [30, 15],
  grossMarginPct: [50, 25],
  ebitdaPct: [10, 0],
  breakEvenDays: 270,
  safetyPct: [20, 0],
  paybackMonths: [48, 84],
  dscr: [1.2, 1],
};

export const SECTORS: SectorProfile[] = [
  {
    id: "startup",
    label: "Start-up / tech",
    note: "Pertes des premières années acceptées : rentabilité et point mort jugés en rythme de croisière ; financement surtout en fonds propres.",
    keywords: ["start-up", "startup", "saas", "logiciel", "application", "appli", "plateforme", "marketplace", "fintech", "tech", "numerique", "digital", "intelligence artificielle", "biotech", "medtech"],
    equityPct: [50, 30],
    grossMarginPct: [70, 50],
    ebitdaPct: [15, 0],
    breakEvenDays: 270,
    safetyPct: [20, 0],
    paybackMonths: [60, 84],
    dscr: [1.2, 1],
    earlyLosses: true,
  },
  {
    id: "food",
    label: "Restauration / métiers de bouche",
    note: "Coût matière autour de 30 % (marge ≥ 65 %), EBE de 10 à 15 % : la masse salariale pèse lourd.",
    keywords: ["pizzeria", "pizza", "restaurant", "resto", "brasserie", "cafe", "bar", "snack", "fast-food", "fast food", "food truck", "boulangerie", "patisserie", "traiteur", "kebab", "burger", "sushi", "creperie", "glacier", "salon de the", "restauration", "cantine"],
    equityPct: [30, 20],
    grossMarginPct: [65, 55],
    ebitdaPct: [12, 6],
    breakEvenDays: 300,
    safetyPct: [15, 5],
    paybackMonths: [48, 72],
    dscr: [1.25, 1],
  },
  {
    id: "lodging",
    label: "Hôtellerie / hébergement",
    note: "Investissement immobilier lourd amorti sur longue durée, EBE élevé (25 % et plus).",
    keywords: ["hotel", "gite", "camping", "chambre d'hote", "chambres d'hotes", "auberge", "hebergement", "residence de tourisme", "airbnb", "location saisonniere"],
    equityPct: [30, 20],
    grossMarginPct: [75, 60],
    ebitdaPct: [25, 15],
    breakEvenDays: 330,
    safetyPct: [15, 5],
    paybackMonths: [96, 144],
    dscr: [1.3, 1.1],
  },
  {
    id: "equipment",
    label: "Services avec équipements",
    note: "Lavage auto, laverie, salle de sport… : peu de coûts variables et de personnel, EBE de 25 à 40 %, mais équipements lourds remboursés en 5 à 8 ans.",
    keywords: ["lavage", "car wash", "laverie", "pressing", "salle de sport", "fitness", "parking", "bowling", "karting", "self-service", "station", "location de materiel", "escape game", "trampoline"],
    equityPct: [30, 20],
    grossMarginPct: [75, 60],
    ebitdaPct: [30, 15],
    breakEvenDays: 300,
    safetyPct: [20, 10],
    paybackMonths: [72, 108],
    dscr: [1.3, 1.1],
  },
  {
    id: "industry",
    label: "Industrie / production",
    note: "Matières et énergie importantes (marge 30 à 40 %), machines amorties sur 7 à 10 ans, apport élevé attendu.",
    keywords: ["usine", "industrie", "industriel", "fabrication", "manufacture", "production", "atelier", "transformation", "plasturgie", "metallurgie", "scierie", "imprimerie", "usinage", "agroalimentaire", "recyclage"],
    equityPct: [35, 25],
    grossMarginPct: [35, 25],
    ebitdaPct: [12, 7],
    breakEvenDays: 330,
    safetyPct: [20, 10],
    paybackMonths: [84, 120],
    dscr: [1.3, 1.1],
  },
  {
    id: "retail",
    label: "Commerce de détail",
    note: "Achat-revente : marge commerciale de 25 à 40 %, EBE de 5 à 10 %, rotation du stock déterminante.",
    keywords: ["commerce", "boutique", "magasin", "epicerie", "superette", "supermarche", "negoce", "e-commerce", "concept store", "librairie", "fleuriste", "caviste", "pharmacie", "quincaillerie", "pret-a-porter", "vetements"],
    equityPct: [30, 20],
    grossMarginPct: [35, 25],
    ebitdaPct: [8, 4],
    breakEvenDays: 300,
    safetyPct: [15, 5],
    paybackMonths: [60, 84],
    dscr: [1.25, 1],
  },
  {
    id: "services",
    label: "Conseil / services intellectuels",
    note: "Peu d'investissement : marge élevée, retour rapide (2 à 4 ans) ; le risque est la charge de travail, pas la dette.",
    keywords: ["conseil", "consulting", "agence", "cabinet", "formation", "freelance", "bureau d'etudes", "communication", "marketing", "comptable", "architecte", "coaching", "services aux entreprises"],
    equityPct: [20, 10],
    grossMarginPct: [80, 60],
    ebitdaPct: [15, 8],
    breakEvenDays: 240,
    safetyPct: [25, 10],
    paybackMonths: [24, 48],
    dscr: [1.5, 1.2],
  },
];

export const ALL_SECTORS = [...SECTORS, GENERAL];

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");

// Secteur reconnu d'après le type d'activité (premier profil dont un mot-clé apparaît en mot entier)
export function detectSector(businessType: string): SectorProfile {
  const text = ` ${normalize(businessType)} `;
  for (const s of SECTORS) {
    if (s.keywords.some((k) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?([^a-z]|$)`).test(text))) return s;
  }
  return GENERAL;
}

// Secteur choisi par l'utilisateur, sinon détecté
export function sectorFor(meta: { businessType: string; sector?: string }): SectorProfile {
  return ALL_SECTORS.find((s) => s.id === meta.sector) ?? detectSector(meta.businessType);
}
