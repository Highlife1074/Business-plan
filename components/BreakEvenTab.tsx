"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FinTable, { type FinLine } from "./FinTable";
import ScenarioBar from "./ScenarioBar";
import { useMoney } from "./CurrencyProvider";
import { Kpi, useChartColors } from "./ui";
import type { TabProps } from "./tab";
import type { YearRow } from "@/lib/finance";
import { num, pct } from "@/lib/format";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default function BreakEvenTab({ plan, proj, update, askClaude }: TabProps) {
  const cur = plan.meta.currency;
  const { fmt } = useMoney();
  const m = (v: number) => fmt(v);
  const c = useChartColors();
  const [year, setYear] = useState(1);
  const y = proj.years[Math.min(year, proj.years.length) - 1];
  const reached = y.breakEvenDays !== null && y.breakEvenDays <= 365;
  const ratio = y.revenue > 0 && Number.isFinite(y.breakEvenRevenue) ? y.breakEvenRevenue / y.revenue : Infinity;

  // Date approximative à laquelle le point mort est atteint dans l'exercice
  let dateLabel = "Non atteint";
  if (reached) {
    const [sy, sm] = plan.params.startDate.split("-").map(Number);
    const monthsIn = Math.floor((y.breakEvenDays! / 365) * 12);
    const total = sy * 12 + (sm - 1) + (y.year - 1) * 12 + monthsIn;
    dateLabel = `${MONTHS[total % 12]} ${Math.floor(total / 12)}`;
  }

  const lines: FinLine<YearRow>[] = [
    { label: "Chiffre d'affaires HT", value: (r) => r.revenue, format: m, kind: "total" },
    { label: "Marge sur coûts variables", value: (r) => r.grossMargin, format: m },
    { label: "Taux de marge sur coûts variables", value: (r) => r.grossMarginPct, format: (v) => pct(v) },
    { label: "Charges de structure (fixes + personnel + amort. + intérêts)", value: (r) => r.fixedCosts + r.staffCosts + r.depreciation + r.interest, format: m },
    { label: "Seuil de rentabilité (CA)", value: (r) => r.breakEvenRevenue, format: m, kind: "total" },
    { label: "Point mort (jours)", value: (r) => r.breakEvenDays ?? NaN, format: (v) => (Number.isFinite(v) && v <= 365 ? `${num(v)} j` : "non atteint") },
    { label: "Marge de sécurité", value: (r) => r.safetyMarginPct, format: (v) => pct(v), signColor: true },
    { label: "CA moyen par jour d'ouverture", value: (r) => r.revenuePerOpenDay, format: m },
    { label: "CA nécessaire par jour d'ouverture", value: (r) => r.breakEvenPerOpenDay, format: m },
  ];

  const data = proj.years.map((r) => ({
    name: `An ${r.year}`,
    "CA prévu": Math.round(r.revenue),
    "Seuil de rentabilité": Number.isFinite(r.breakEvenRevenue) ? Math.round(r.breakEvenRevenue) : 0,
  }));
  const axis = { stroke: c.muted, fontSize: 12 };
  const sc = plan.params.scenario;

  return (
    <>
      <ScenarioBar plan={plan} update={update} />
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Point mort — année</h2>
          <select style={{ width: "auto" }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {proj.years.map((r) => <option key={r.year} value={r.year}>Année {r.year}</option>)}
          </select>
        </div>
        <div className="grid grid-kpi">
          <Kpi label="Seuil de rentabilité" value={m(y.breakEvenRevenue)} hint={`CA prévu : ${m(y.revenue)}`} />
          <Kpi label="Point mort" value={reached ? `${num(y.breakEvenDays!)} jours` : "Non atteint"} hint={reached ? `Atteint vers ${dateLabel}` : undefined} tone={reached ? "pos" : "neg"} />
          <Kpi label="Marge de sécurité" value={pct(y.safetyMarginPct)} hint="Baisse de CA supportable avant perte" tone={y.safetyMarginPct < 0 ? "neg" : y.safetyMarginPct < 15 ? "warn" : "pos"} />
          <Kpi label="Activité nécessaire" value={Number.isFinite(ratio) ? pct(ratio * 100, 0) : "—"} hint="de l'activité prévue" />
        </div>
      </div>

      <div className="card">
        <h2>Volumes nécessaires pour couvrir les charges (année {y.year})</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ligne de revenu</th><th>Prévu / jour (croisière)</th><th>Nécessaire / jour</th></tr></thead>
            <tbody>
              {plan.params.revenueStreams.map((s) => {
                const planned = s.unitsPerDay * Math.pow(1 + s.growthPct / 100, y.year - 1) * (sc.volumePct / 100);
                return (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td>{num(planned, 1)} {s.unitLabel}</td>
                    <td className={ratio > 1 ? "neg" : ""}>{Number.isFinite(ratio) ? `${num(planned * ratio, 1)} ${s.unitLabel}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          À mix de ventes constant. Le seuil intègre les charges fixes, le personnel, les amortissements et les intérêts.
        </p>
      </div>

      <div className="card">
        <h2>CA prévu vs seuil de rentabilité</h2>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke={c.border} vertical={false} />
              <XAxis dataKey="name" tick={axis} stroke={c.border} />
              <YAxis tick={axis} stroke={c.border} tickFormatter={(v) => fmt(v, true)} width={70} />
              <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, color: c.text }} formatter={(v) => m(Number(v))} />
              <Legend />
              <Bar dataKey="CA prévu" fill={c.c2} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Seuil de rentabilité" fill={c.c1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Détail par année</h2>
          <button className="btn sm no-print" onClick={() => askClaude("Comment abaisser mon point mort ? Propose des leviers concrets (prix, coûts fixes, mix produit, personnel) avec leur impact chiffré estimé.")}>
            Leviers avec Claude
          </button>
        </div>
        <FinTable columns={proj.years} headers={proj.years.map((r) => `Année ${r.year}`)} lines={lines} />
      </div>
    </>
  );
}
