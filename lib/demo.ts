import type { Plan } from "./types";

// Exemple prêt à l'emploi (sans appel à Claude) : station de lavage auto en Pologne.
// Les chiffres sont indicatifs et servent de point de départ à la simulation.
export function demoPlan(id: string): Plan {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    meta: {
      name: "Station de lavage auto — Wrocław",
      businessType: "Lavage auto (self-service + portique)",
      country: "Pologne",
      city: "Wrocław",
      currency: "PLN",
      description:
        "Station de lavage de 4 boxes haute pression self-service, 1 portique automatique et une zone d'aspiration, ouverte 24h/24 avec paiement par carte et application.",
    },
    params: {
      startDate: "2027-04",
      horizonYears: 5,
      vatRatePct: 23,
      corporateTaxPct: 19,
      employerChargesPct: 20.5,
      inflationPct: 3.5,
      discountRatePct: 10,
      seasonality: [1.2, 1.15, 1.1, 1.15, 1.0, 0.9, 0.85, 0.85, 0.9, 0.95, 1.0, 0.95],
      rampUpMonths: 9,
      rampUpStartPct: 45,
      revenueStreams: [
        {
          id: "rs-boxes",
          label: "Boxes self-service (4 postes)",
          unitLabel: "lavage",
          unitPrice: 13,
          unitsPerDay: 120,
          openDaysPerMonth: 30,
          variableCostPct: 12,
          growthPct: 5,
          note: "≈ 30 lavages/box/jour, ticket moyen 16 PLN TTC",
        },
        {
          id: "rs-portique",
          label: "Portique automatique",
          unitLabel: "lavage",
          unitPrice: 30,
          unitsPerDay: 45,
          openDaysPerMonth: 30,
          variableCostPct: 15,
          growthPct: 6,
          note: "Programmes de 25 à 45 PLN TTC",
        },
        {
          id: "rs-annexes",
          label: "Aspirateurs & services annexes",
          unitLabel: "utilisation",
          unitPrice: 5,
          unitsPerDay: 60,
          openDaysPerMonth: 30,
          variableCostPct: 5,
          growthPct: 3,
          note: "Aspiration, gonflage, distributeur de produits",
        },
      ],
      fixedCosts: [
        { id: "fc-terrain", label: "Location du terrain", monthly: 8000, note: "Bail long terme, zone commerciale" },
        { id: "fc-maintenance", label: "Maintenance & pièces", monthly: 4000, note: "Contrat constructeur" },
        { id: "fc-energie", label: "Énergie & eau (part fixe)", monthly: 2000, note: "Abonnements, hors consommation variable" },
        { id: "fc-assurance", label: "Assurances", monthly: 1200, note: "" },
        { id: "fc-compta", label: "Comptabilité & juridique", monthly: 1500, note: "Biuro rachunkowe" },
        { id: "fc-marketing", label: "Marketing local & digital", monthly: 2500, note: "" },
        { id: "fc-telemetrie", label: "Télématique & paiement", monthly: 800, note: "Terminaux, application, monitoring" },
      ],
      staff: [
        { id: "st-manager", role: "Gérant de site", count: 1, grossMonthly: 8000, startMonth: 1 },
        { id: "st-tech", role: "Technicien d'entretien", count: 1, grossMonthly: 6500, startMonth: 1 },
      ],
      investments: [
        { id: "inv-genie", label: "Génie civil & construction", amount: 600000, depreciationYears: 20, note: "Dalles, auvents, réseaux" },
        { id: "inv-boxes", label: "Équipement 4 boxes self-service", amount: 520000, depreciationYears: 8, note: "" },
        { id: "inv-portique", label: "Portique de lavage automatique", amount: 450000, depreciationYears: 8, note: "" },
        { id: "inv-aspi", label: "Aspirateurs & équipements annexes", amount: 40000, depreciationYears: 5, note: "" },
        { id: "inv-eau", label: "Station de traitement / recyclage de l'eau", amount: 80000, depreciationYears: 10, note: "Exigence environnementale" },
        { id: "inv-paiement", label: "Terminaux de paiement & télématique", amount: 40000, depreciationYears: 5, note: "" },
        { id: "inv-etudes", label: "Études, permis & frais d'établissement", amount: 50000, depreciationYears: 5, note: "" },
        { id: "inv-bfr", label: "Trésorerie de départ / BFR", amount: 100000, depreciationYears: 0, note: "Non amortissable" },
      ],
      financing: {
        equity: 620000,
        subsidies: 100000,
        loans: [
          { id: "ln-1", label: "Prêt bancaire d'investissement", amount: 1200000, ratePct: 8.5, years: 7, deferralMonths: 6 },
        ],
      },
      scenario: { volumePct: 100, pricePct: 100, costPct: 100 },
    },
    texts: {
      summary:
        "Création d'une station de lavage moderne à Wrocław combinant 4 boxes self-service, un portique automatique et une zone d'aspiration. Le marché polonais du lavage est porté par un parc automobile en croissance (plus de 650 véhicules pour 1 000 habitants), des hivers salés qui imposent des lavages fréquents et une préférence marquée pour le self-service sans contact.\n\nL'investissement total est d'environ 1,88 M PLN, financé par 620 k PLN d'apport, 100 k PLN de subventions et un prêt bancaire de 1,2 M PLN sur 7 ans. Après une montée en charge de 9 mois, la station vise environ 1,15 M PLN HT de chiffre d'affaires annuel en régime de croisière, avec un EBE supérieur à 50 %.",
      market:
        "Forte densité de stations self-service en Pologne mais un niveau d'équipement encore inégal ; la demande est saisonnière (pic en hiver et au printemps). Concurrence principale : stations-service avec portique et autres myjnie bezdotykowe du quartier.",
      legal: [
        {
          id: "lg-1",
          title: "Forme juridique",
          content:
            "Sp. z o.o. (SARL polonaise) : capital minimum 5 000 PLN, responsabilité limitée, immatriculation au KRS (possible en ligne via S24).",
        },
        {
          id: "lg-2",
          title: "Urbanisme & permis",
          content:
            "Vérifier le plan local d'urbanisme (MPZP) ou obtenir une décision WZ, puis le permis de construire (pozwolenie na budowę).",
        },
        {
          id: "lg-3",
          title: "Environnement & eau",
          content:
            "Permis loi sur l'eau (pozwolenie wodnoprawne) pour le rejet des eaux usées ; séparateur d'hydrocarbures obligatoire ; contrat avec le gestionnaire du réseau d'assainissement.",
        },
        {
          id: "lg-4",
          title: "Fiscalité",
          content:
            "TVA 23 % ; impôt sur les sociétés (CIT) de 19 %, ou 9 % pour les « petits contribuables » (CA < 2 M EUR) ; possibilité d'estoński CIT sous conditions.",
        },
      ],
      strengths: [
        "Exploitation 24h/24 avec peu de personnel",
        "Offre complète : self-service + portique + aspiration",
        "Paiement sans contact et application de fidélité",
      ],
      weaknesses: [
        "Investissement initial élevé",
        "Dépendance aux conditions météorologiques",
        "Notoriété à construire",
      ],
      opportunities: [
        "Flottes d'entreprises et VTC (abonnements)",
        "Hausse continue du parc automobile",
        "Subventions liées au recyclage de l'eau",
      ],
      threats: [
        "Arrivée de concurrents à proximité",
        "Hausse du prix de l'énergie et de l'eau",
        "Durcissement des normes environnementales",
      ],
      risks: [
        {
          id: "rk-1",
          risk: "Fréquentation inférieure aux prévisions",
          probability: "moyen",
          impact: "élevé",
          mitigation: "Étude d'emplacement (trafic), offres de lancement, partenariats flottes",
        },
        {
          id: "rk-2",
          risk: "Retard d'obtention des permis",
          probability: "moyen",
          impact: "moyen",
          mitigation: "Démarrer les démarches tôt, se faire accompagner par un architecte local",
        },
        {
          id: "rk-3",
          risk: "Panne d'équipement",
          probability: "faible",
          impact: "moyen",
          mitigation: "Contrat de maintenance avec délai d'intervention garanti, télésurveillance",
        },
      ],
      keyAssumptions: [
        "Ouverture 7j/7, 24h/24",
        "Montée en charge sur 9 mois à partir de 45 % du régime de croisière",
        "Prix indexés sur l'inflation (3,5 %/an)",
      ],
    },
    quotes: [],
    quoteNeeds: [
      { id: "qn-1", item: "Équipement boxes self-service", category: "Équipement", estimatedAmount: 520000, done: false },
      { id: "qn-2", item: "Portique automatique", category: "Équipement", estimatedAmount: 450000, done: false },
      { id: "qn-3", item: "Génie civil / entreprise générale", category: "Travaux", estimatedAmount: 600000, done: false },
      { id: "qn-4", item: "Station de recyclage de l'eau", category: "Équipement", estimatedAmount: 80000, done: false },
      { id: "qn-5", item: "Assurance multirisque", category: "Services", estimatedAmount: 14400, done: false },
    ],
    chat: [],
  };
}
