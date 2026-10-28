import type { Params } from "./types";
import type { Projection } from "./finance";
import { monthName, num, pct } from "./format.ts";

// Fiche récap : les indicateurs regroupés par thème, chacun avec un feu (vert / orange / rouge)
// selon des seuils usuels des banques et des investisseurs.

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
  groups: RecapGroup[];
  score: number; // sur 10
  tone: Tone;
  verdict: string;
}

const worst = (tones: Tone[]): Tone =>
  tones.includes("bad") ? "bad" : tones.includes("warn") ? "warn" : "good";

const grade = (v: number, good: number, warn: number): Tone => (v >= good ? "good" : v >= warn ? "warn" : "bad");

// Nombre de mois entre le démarrage et un mois "AAAA-MM" de la projection (1 = premier mois)
const monthsFromStart = (proj: Projection, label: string | null) =>
  label ? proj.months.findIndex((r) => r.label === label) + 1 : 0;

export function buildRecap(params: Params, proj: Projection, money: (v: number) => string): Recap {
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
          tone: grade(equityShare, 30, 15),
          hint: "Repère banques : ≥ 30 %",
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
        { label: "Marge sur coûts variables", value: pct(y1.grossMarginPct), tone: grade(y1.grossMarginPct, 50, 25), hint: "Ce qui reste de 100 vendus pour payer les charges fixes" },
      ],
    },
    {
      id: "profitability",
      title: "Rentabilité",
      question: "Le projet gagne-t-il de l'argent ?",
      items: [
        { label: "EBE an 1", value: `${money(y1.ebitda)} (${pct(y1.ebitdaPct, 0)})`, tone: grade(y1.ebitdaPct, 10, 0), hint: "Repère : ≥ 10 % du CA" },
        { label: "Résultat net an 1", value: money(y1.netIncome), tone: y1.netIncome >= 0 ? "good" : yN.netIncome >= 0 ? "warn" : "bad", hint: `An ${yN.year} : ${money(yN.netIncome)}` },
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
          tone: ind.avgDscr === null ? "good" : ind.avgDscr >= 1.2 ? "good" : ind.avgDscr >= 1 ? "warn" : "bad",
          hint: "Repère banques : ≥ 1,2",
        },
      ],
    },
    {
      id: "risk",
      title: "Point mort et sécurité",
      question: "Quelle marge d'erreur ?",
      items: [
        {
          label: "Point mort an 1",
          value: beReached ? `${num(y1.breakEvenDays!)} jours` : "Non atteint",
          tone: !beReached ? "bad" : y1.breakEvenDays! <= 270 ? "good" : "warn",
          hint: `Seuil : ${money(y1.breakEvenRevenue)} de CA`,
        },
        { label: "Marge de sécurité an 1", value: pct(y1.safetyMarginPct, 0), tone: grade(y1.safetyMarginPct, 20, 0), hint: "Baisse de CA supportable — repère : ≥ 20 %" },
        { label: `Marge de sécurité an ${yN.year}`, value: pct(yN.safetyMarginPct, 0), tone: grade(yN.safetyMarginPct, 20, 0), hint: "En rythme de croisière" },
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
          tone: !payback ? "bad" : payback <= 48 ? "good" : "warn",
          hint: payback ? `Après ${num(payback)} mois — repère : ≤ 4 ans` : `Pas sur ${n} ans`,
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
  const warn = full.filter((g) => g.tone === "warn").map((g) => g.title.toLowerCase());
  const tone: Tone = bad.length > 0 ? "bad" : warn.length > 0 ? "warn" : "good";
  const verdict =
    tone === "good"
      ? "Projet solide : tous les critères sont au vert."
      : tone === "warn"
        ? `Projet viable, à consolider : ${warn.join(", ")}.`
        : `Projet fragile en l'état — points bloquants : ${bad.join(", ")}.`;

  return { groups: full, score, tone, verdict };
}
