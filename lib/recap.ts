import type { Params } from "./types";
import type { Projection } from "./finance";
import { monthName, num, pct } from "./format.ts";
import { GENERAL, type Range, type SectorProfile } from "./sectors.ts";

// Fiche récap : les indicateurs regroupés par thème, chacun avec un feu (vert / orange / rouge)
// selon les seuils du secteur d'activité (voir sectors.ts).

export type Tone = "good" | "warn" | "bad";

export interface RecapItem {
  label: string;
  value: string;
  tone?: Tone; // absent : simple information, non notée
  hint: string; // repère : ce qui est attendu
}

export interface RecapGroup {
  id: string;
  title: string;
  question: string; // la question à laquelle répond le groupe
  tone: Tone;
  items: RecapItem[];
}

export interface Recap {
  sector: SectorProfile;
  groups: RecapGroup[];
  score: number; // sur 10
  tone: Tone;
  verdict: string;
}

const worst = (tones: Tone[]): Tone =>
  tones.includes("bad") ? "bad" : tones.includes("warn") ? "warn" : "good";

const grade = (v: number, [good, warn]: Range): Tone => (v >= good ? "good" : v >= warn ? "warn" : "bad");
const fr = (v: number) => v.toLocaleString("fr-FR");

// Nombre de mois entre le démarrage et un mois "AAAA-MM" de la projection (1 = premier mois)
const monthsFromStart = (proj: Projection, label: string | null) =>
  label ? proj.months.findIndex((r) => r.label === label) + 1 : 0;

export function buildRecap(
  params: Params,
  proj: Projection,
  money: (v: number) => string,
  sector: SectorProfile = GENERAL,
): Recap {
  const S = sector;
  const ind = proj.indicators;
  const y1 = proj.years[0];
  const yN = proj.years[proj.years.length - 1];
  const n = proj.years.length;
  const fin = params.financing;
  const inv = ind.totalInvestment;

  const coverage = inv > 0 ? (ind.totalFinancing / inv) * 100 : 100;
  const equityShare = inv > 0 ? ((fin.equity + fin.subsidies) / inv) * 100 : 100;
  const growth = n > 1 && y1.revenue > 0 && yN.revenue > 0 ? (Math.pow(yN.revenue / y1.revenue, 1 / (n - 1)) - 1) * 100 : 0;
  const cumulNet = proj.years.reduce((a, y) => a + y.netIncome, 0);
  const beReached = y1.breakEvenDays !== null && y1.breakEvenDays <= 365;
  // Première année où le seuil de rentabilité est atteint (utile quand les pertes initiales sont normales)
  const beYear = proj.years.find((y) => y.breakEvenDays !== null && y.breakEvenDays <= 365)?.year ?? null;
  // Rentabilité jugée l'an 1, ou en rythme de croisière (dernière année) pour les start-up
  const yR = S.earlyLosses ? yN : y1;
  const payback = monthsFromStart(proj, ind.paybackMonth);
  const firstProfit = monthsFromStart(proj, ind.firstProfitableMonth);
  const rate = params.discountRatePct;

  const groups: Omit<RecapGroup, "tone">[] = [
    {
      id: "financing",
      title: "Financement",
      question: "Le projet est-il financé ?",
      items: [
        { label: "Investissement total", value: money(inv), hint: "Besoins de départ" },
        {
          label: "Besoins couverts",
          value: pct(coverage, 0),
          tone: coverage >= 100 ? "good" : coverage >= 90 ? "warn" : "bad",
          hint: ind.financingGap < 0 ? `Il manque ${money(-ind.financingGap)}` : "Repère : 100 %",
        },
        {
          label: "Fonds propres (apport + subventions)",
          value: pct(equityShare, 0),
          tone: grade(equityShare, S.equityPct),
          hint: `Repère : ≥ ${S.equityPct[0]} %`,
        },
      ],
    },
    {
      id: "activity",
      title: "Activité",
      question: "Combien le projet vend-il ?",
      items: [
        { label: "Chiffre d'affaires an 1", value: money(y1.revenue), tone: y1.revenue > 0 ? "good" : "bad", hint: `An ${yN.year} : ${money(yN.revenue)}` },
        { label: "Croissance annuelle moyenne", value: n > 1 ? pct(growth) : "—", tone: n > 1 && growth < 0 ? "warn" : "good", hint: `Sur ${n} ans` },
        { label: "Marge sur coûts variables", value: pct(y1.grossMarginPct), tone: grade(y1.grossMarginPct, S.grossMarginPct), hint: `Repère : ≥ ${S.grossMarginPct[0]} % — ce qui reste de 100 vendus pour payer les charges fixes` },
      ],
    },
    {
      id: "profitability",
      title: "Rentabilité",
      question: "Le projet gagne-t-il de l'argent ?",
      items: [
        { label: `EBE an ${yR.year}`, value: `${money(yR.ebitda)} (${pct(yR.ebitdaPct, 0)})`, tone: grade(yR.ebitdaPct, S.ebitdaPct), hint: `Repère : ≥ ${S.ebitdaPct[0]} % du CA${S.earlyLosses ? " en rythme de croisière" : ""}` },
        {
          label: "Résultat net an 1",
          value: money(y1.netIncome),
          tone: y1.netIncome >= 0 ? "good" : yN.netIncome >= 0 ? (S.earlyLosses ? "good" : "warn") : "bad",
          hint: `An ${yN.year} : ${money(yN.netIncome)}${S.earlyLosses && y1.netIncome < 0 ? " — perte de démarrage normale" : ""}`,
        },
        { label: `Résultat cumulé sur ${n} ans`, value: money(cumulNet), tone: cumulNet >= 0 ? "good" : "bad", hint: firstProfit ? `1er mois bénéficiaire : ${monthName(ind.firstProfitableMonth)}` : "Aucun mois bénéficiaire" },
      ],
    },
    {
      id: "cash",
      title: "Trésorerie",
      question: "La caisse tient-elle ?",
      items: [
        { label: "Point bas de trésorerie", value: money(ind.minCash), tone: ind.minCash >= 0 ? "good" : "bad", hint: monthName(ind.minCashMonth) },
        { label: `Trésorerie fin an ${yN.year}`, value: money(yN.endCash), tone: yN.endCash >= 0 ? "good" : "bad", hint: "Fin de l'horizon" },
        {
          label: "Couverture de la dette (DSCR)",
          value: ind.avgDscr === null ? "Pas de prêt" : num(ind.avgDscr, 2),
          tone: ind.avgDscr === null ? "good" : grade(ind.avgDscr, S.dscr),
          hint: `Repère : ≥ ${fr(S.dscr[0])}`,
        },
      ],
    },
    {
      id: "risk",
      title: "Point mort et sécurité",
      question: "Quelle marge d'erreur ?",
      items: [
        S.earlyLosses
          ? {
              label: "Seuil de rentabilité atteint",
              value: beYear ? `An ${beYear}` : "Non atteint",
              tone: !beYear ? "bad" : beYear <= 3 ? "good" : "warn",
              hint: "Repère : au plus tard l'an 3",
            }
          : {
              label: "Point mort an 1",
              value: beReached ? `${num(y1.breakEvenDays!)} jours` : "Non atteint",
              tone: !beReached ? "bad" : y1.breakEvenDays! <= S.breakEvenDays ? "good" : "warn",
              hint: `Repère : ≤ ${S.breakEvenDays} jours — seuil : ${money(y1.breakEvenRevenue)} de CA`,
            },
        {
          label: "Marge de sécurité an 1",
          value: pct(y1.safetyMarginPct, 0),
          // L'an 1 inclut la montée en charge : orange tant qu'elle reste positive.
          // Start-up : simple information, pas un critère.
          tone: S.earlyLosses ? undefined : grade(y1.safetyMarginPct, [S.safetyPct[0], 0]),
          hint: `Baisse de CA supportable — repère : ≥ ${S.safetyPct[0]} %`,
        },
        { label: `Marge de sécurité an ${yN.year}`, value: pct(yN.safetyMarginPct, 0), tone: grade(yN.safetyMarginPct, S.safetyPct), hint: "En rythme de croisière" },
      ],
    },
    {
      id: "return",
      title: "Retour sur investissement",
      question: "Quand récupère-t-on la mise ?",
      items: [
        {
          label: "Investissement remboursé",
          value: payback ? monthName(ind.paybackMonth) : "Au-delà de l'horizon",
          tone: !payback || payback > S.paybackMonths[1] ? "bad" : payback <= S.paybackMonths[0] ? "good" : "warn",
          hint: `${payback ? `Après ${num(payback)} mois` : `Pas sur ${n} ans`} — repère : ≤ ${fr(S.paybackMonths[0] / 12)} ans`,
        },
        { label: `VAN (${num(rate, 1)} %)`, value: money(ind.npv), tone: ind.npv >= 0 ? "good" : "bad", hint: "Valeur créée, positive = projet rentable" },
        {
          label: "TRI",
          value: ind.irr === null ? "—" : pct(ind.irr * 100),
          tone: ind.irr === null ? "bad" : ind.irr * 100 >= rate ? "good" : ind.irr > 0 ? "warn" : "bad",
          hint: `À comparer au taux d'actualisation (${num(rate, 1)} %)`,
        },
      ],
    },
  ];

  const tones = (items: RecapItem[]) => items.flatMap((i) => (i.tone ? [i.tone] : []));
  const full = groups.map((g) => ({ ...g, tone: worst(tones(g.items)) }));
  const all = full.flatMap((g) => tones(g.items));
  const points = all.reduce((a, t) => a + (t === "good" ? 2 : t === "warn" ? 1 : 0), 0);
  const score = Math.round((points / (all.length * 2)) * 100) / 10;
  const bad = full.filter((g) => g.tone === "bad").map((g) => g.title.toLowerCase());
  const weak = full.filter((g) => g.tone !== "good").map((g) => g.title.toLowerCase());
  // Bloquant : financement non bouclé, caisse à découvert ou projet perdant sur tout l'horizon
  const blocking = ind.financingGap < 0 || ind.minCash < 0 || cumulNet < 0;
  const tone: Tone = blocking || score < 5 || bad.length >= 3 ? "bad" : weak.length > 0 ? "warn" : "good";
  const verdict =
    tone === "good"
      ? "Projet solide : tous les critères sont au vert."
      : tone === "warn"
        ? `Projet viable, à consolider : ${weak.join(", ")}.`
        : `Projet fragile en l'état — points bloquants : ${(bad.length ? bad : weak).join(", ")}.`;

  return { sector, groups: full, score, tone, verdict };
}
