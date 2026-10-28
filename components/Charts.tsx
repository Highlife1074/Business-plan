"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "./ui";
import { useMoney } from "./CurrencyProvider";
import type { Projection, YearRow } from "@/lib/finance";
import { monthName, pct } from "@/lib/format";

// Graphiques partagés entre les onglets. Ordre des couleurs fixe (validé daltonisme) :
// bleu (c2), orange (c1), violet (c4), vert (c3).

function useKit() {
  const c = useChartColors();
  const { fmt } = useMoney();
  const axis = { stroke: c.muted, fontSize: 12 };
  const tooltip = {
    contentStyle: { background: c.surface, border: `1px solid ${c.border}`, color: c.text, borderRadius: 8 },
    labelStyle: { color: c.text },
  };
  const money = (v: unknown) => fmt(Number(v));
  const compact = (v: number) => fmt(v, true);
  return { c, axis, tooltip, money, compact };
}

// Graduation courte de l'axe des mois : "avr. 27"
const monthTick = (label: string) => monthName(label).replace(/ \d\d(\d\d)$/, " $1");

// CA, EBE et résultat net par année
export function ActivityChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip, money, compact } = useKit();
  const data = proj.years.map((y) => ({
    name: `An ${y.year}`,
    "Chiffre d'affaires": Math.round(y.revenue),
    EBE: Math.round(y.ebitda),
    "Résultat net": Math.round(y.netIncome),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} barGap={2}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} cursor={{ fill: c.border, opacity: 0.3 }} />
          <Legend itemSorter={null} />
          <ReferenceLine y={0} stroke={c.muted} />
          <Bar dataKey="Chiffre d'affaires" fill={c.c2} radius={[4, 4, 0, 0]} />
          <Bar dataKey="EBE" fill={c.c1} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Résultat net" fill={c.c4} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Trésorerie de fin de mois
export function CashChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip, money, compact } = useKit();
  const data = proj.months.map((r) => ({ name: r.label, Trésorerie: Math.round(r.cashBalance) }));
  const low = proj.indicators;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} interval={11} tickFormatter={monthTick} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} labelFormatter={(l) => monthName(String(l))} />
          <ReferenceLine y={0} stroke={c.neg} strokeDasharray="4 4" />
          <Area type="monotone" dataKey="Trésorerie" stroke={c.c2} fill={c.c2} fillOpacity={0.15} strokeWidth={2} />
          <ReferenceDot x={low.minCashMonth} y={Math.round(low.minCash)} r={5} fill={low.minCash < 0 ? c.neg : c.c2} stroke={c.surface} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// CA mensuel face aux charges d'exploitation (montée en charge, saisonnalité)
export function RevenueCostsChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip, money, compact } = useKit();
  const data = proj.months.map((r) => ({
    name: r.label,
    "Chiffre d'affaires": Math.round(r.revenue),
    "Charges d'exploitation": Math.round(r.variableCosts + r.fixedCosts + r.staffCosts),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} interval={11} tickFormatter={monthTick} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} labelFormatter={(l) => monthName(String(l))} />
          <Legend itemSorter={null} />
          <Line type="monotone" dataKey="Chiffre d'affaires" stroke={c.c2} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Charges d'exploitation" stroke={c.c1} strokeWidth={2} dot={false} strokeDasharray="6 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Retour sur investissement : cumul (EBE − IS) − investissement ; passe au-dessus de 0 quand la mise est récupérée
export function PaybackChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip, money, compact } = useKit();
  let cumul = -proj.indicators.totalInvestment;
  const data = proj.months.map((r) => {
    cumul += r.ebitda - r.tax;
    return { name: r.label, "Gain cumulé après investissement": Math.round(cumul) };
  });
  const pb = proj.indicators.paybackMonth;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} interval={11} tickFormatter={monthTick} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} labelFormatter={(l) => monthName(String(l))} />
          <ReferenceLine y={0} stroke={c.muted} strokeDasharray="4 4" />
          <Area type="monotone" dataKey="Gain cumulé après investissement" stroke={c.c4} fill={c.c4} fillOpacity={0.15} strokeWidth={2} />
          {pb && (
            <ReferenceLine x={pb} stroke={c.c3} strokeDasharray="4 4"
              label={{ value: `remboursé : ${monthName(pb)}`, position: "insideTopRight", fill: c.text, fontSize: 12 }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Structure des charges par année (barres empilées)
export function CostStructureChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip, money, compact } = useKit();
  const data = proj.years.map((y) => ({
    name: `An ${y.year}`,
    "Charges variables": Math.round(y.variableCosts),
    "Charges fixes": Math.round(y.fixedCosts),
    Personnel: Math.round(y.staffCosts),
    "Amortissements et intérêts": Math.round(y.depreciation + y.interest),
  }));
  const seg = { stroke: c.surface, strokeWidth: 2 };
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} cursor={{ fill: c.border, opacity: 0.3 }} />
          <Legend itemSorter={null} />
          <Bar dataKey="Charges variables" stackId="a" fill={c.c2} {...seg} />
          <Bar dataKey="Charges fixes" stackId="a" fill={c.c1} {...seg} />
          <Bar dataKey="Personnel" stackId="a" fill={c.c4} {...seg} />
          <Bar dataKey="Amortissements et intérêts" stackId="a" fill={c.c3} radius={[4, 4, 0, 0]} {...seg} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Taux de marge par année (en % du CA)
export function MarginsChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip } = useKit();
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const data = proj.years.map((y) => ({
    name: `An ${y.year}`,
    "Marge sur coûts variables": r1(y.grossMarginPct),
    "EBE / CA": r1(y.ebitdaPct),
    "Marge nette": r1(y.netMarginPct),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={(v) => `${v} %`} width={50} />
          <Tooltip {...tooltip} formatter={(v) => pct(Number(v))} />
          <Legend itemSorter={null} />
          <ReferenceLine y={0} stroke={c.muted} />
          <Line type="monotone" dataKey="Marge sur coûts variables" stroke={c.c2} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="EBE / CA" stroke={c.c1} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Marge nette" stroke={c.c4} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Courbe classique du point mort : CA et charges totales selon le niveau d'activité de l'année
export function BreakEvenChart({ year }: { year: YearRow }) {
  const { c, axis, tooltip, money, compact } = useKit();
  const structural = year.fixedCosts + year.staffCosts + year.depreciation + year.interest;
  const varRate = year.revenue > 0 ? year.variableCosts / year.revenue : 0;
  const bePct = year.revenue > 0 && Number.isFinite(year.breakEvenRevenue) ? (year.breakEvenRevenue / year.revenue) * 100 : null;
  const maxPct = Math.min(300, Math.max(150, Math.ceil(((bePct ?? 0) * 1.2) / 10) * 10));
  const data = [];
  for (let p = 0; p <= maxPct; p += 5) {
    const rev = (year.revenue * p) / 100;
    data.push({ activity: p, "Chiffre d'affaires": Math.round(rev), "Charges totales": Math.round(structural + rev * varRate) });
  }
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="activity" type="number" domain={[0, maxPct]} tick={axis} stroke={c.border} tickFormatter={(v) => `${v} %`} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} labelFormatter={(l) => `Activité : ${l} % du prévu`} />
          <Legend itemSorter={null} />
          <ReferenceLine x={100} stroke={c.muted} strokeDasharray="4 4" label={{ value: "prévu", position: "insideTopRight", fill: c.muted, fontSize: 12 }} />
          {bePct !== null && bePct <= maxPct && (
            <ReferenceDot x={Math.round(bePct * 10) / 10} y={Math.round(year.breakEvenRevenue)} r={6} fill={c.c3} stroke={c.surface} strokeWidth={2}
              label={{ value: `point mort : ${Math.round(bePct)} % du prévu`, position: "bottom", offset: 12, fill: c.text, fontSize: 12 }} />
          )}
          <Line type="linear" dataKey="Chiffre d'affaires" stroke={c.c2} strokeWidth={2} dot={false} />
          <Line type="linear" dataKey="Charges totales" stroke={c.c1} strokeWidth={2} dot={false} strokeDasharray="6 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Encaissements et décaissements d'exploitation mensuels (hors financement et investissement initiaux)
export function CashFlowChart({ proj }: { proj: Projection }) {
  const { c, axis, tooltip, money, compact } = useKit();
  const data = proj.months.map((r) => ({
    name: r.label,
    Encaissements: Math.round(r.revenue),
    Décaissements: Math.round(r.cashOut - r.investmentsOut),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke={c.border} interval={11} tickFormatter={monthTick} />
          <YAxis tick={axis} stroke={c.border} tickFormatter={compact} width={70} />
          <Tooltip {...tooltip} formatter={money} labelFormatter={(l) => monthName(String(l))} />
          <Legend itemSorter={null} />
          <Line type="monotone" dataKey="Encaissements" stroke={c.c2} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Décaissements" stroke={c.c1} strokeWidth={2} dot={false} strokeDasharray="6 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
