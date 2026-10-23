"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Kpi, useChartColors } from "./ui";
import ScenarioBar from "./ScenarioBar";
import { useMoney } from "./CurrencyProvider";
import type { TabProps } from "./tab";
import { monthName, num, pct } from "@/lib/format";

export default function SummaryTab({ plan, proj, update, askClaude }: TabProps) {
  const cur = plan.meta.currency;
  const { fmt } = useMoney();
  const m = (v: number) => fmt(v);
  const mc = (v: number) => fmt(v, true);
  const ind = proj.indicators;
  const y1 = proj.years[0];
  const yN = proj.years[proj.years.length - 1];
  const c = useChartColors();
  const [editing, setEditing] = useState(false);
  const cumulNet = proj.years.reduce((a, y) => a + y.netIncome, 0);

  const alerts: { tone: "bad" | "warn" | "good"; text: string }[] = [];
  if (ind.financingGap < 0)
    alerts.push({ tone: "bad", text: `Financement insuffisant : il manque ${m(-ind.financingGap)} pour couvrir les investissements.` });
  if (ind.minCash < 0)
    alerts.push({ tone: "bad", text: `Trésorerie négative au plus bas (${m(ind.minCash)} en ${monthName(ind.minCashMonth)}) : augmenter l'apport, le BFR ou négocier un différé.` });
  if (y1.breakEvenDays === null || y1.breakEvenDays > 365)
    alerts.push({ tone: "warn", text: "Le seuil de rentabilité n'est pas atteint la première année." });
  if (ind.avgDscr !== null && ind.avgDscr < 1.2)
    alerts.push({ tone: "warn", text: `Couverture de la dette faible (DSCR moyen ${num(ind.avgDscr, 2)}) : les banques attendent souvent ≥ 1,2.` });
  if (alerts.length === 0) alerts.push({ tone: "good", text: "Plan équilibré : financement couvert, trésorerie positive et seuil de rentabilité atteint dès la première année." });

  const yearData = proj.years.map((y) => ({
    name: `An ${y.year}`,
    "Chiffre d'affaires": Math.round(y.revenue),
    EBE: Math.round(y.ebitda),
    "Résultat net": Math.round(y.netIncome),
  }));
  const cashData = proj.months.map((r) => ({ name: r.label, Trésorerie: Math.round(r.cashBalance) }));
  const axis = { stroke: c.muted, fontSize: 12 };
  const tooltip = { contentStyle: { background: c.surface, border: `1px solid ${c.border}`, color: c.text }, formatter: (v: unknown) => m(Number(v)) };

  return (
    <>
      <div className="card">
        <p>{plan.meta.description}</p>
        {alerts.map((a, i) => <div key={i} className={`alert ${a.tone}`}>{a.text}</div>)}
      </div>

      <ScenarioBar plan={plan} update={update} />

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Investissement total" value={m(ind.totalInvestment)} hint={`Financé à ${num(ind.totalInvestment ? (ind.totalFinancing / ind.totalInvestment) * 100 : 0)} %`} tone={ind.financingGap < 0 ? "neg" : undefined} />
        <Kpi label="Apport / Prêts / Subventions" value={mc(plan.params.financing.equity)} hint={`${mc(ind.totalLoans)} de prêts · ${mc(plan.params.financing.subsidies)} de subventions`} />
        <Kpi label="CA année 1" value={m(y1.revenue)} hint={`An ${yN.year} : ${m(yN.revenue)}`} />
        <Kpi label="EBE année 1" value={m(y1.ebitda)} hint={`${pct(y1.ebitdaPct)} du CA · an ${yN.year} : ${pct(yN.ebitdaPct)}`} tone={y1.ebitda < 0 ? "neg" : "pos"} />
        <Kpi label="Résultat net année 1" value={m(y1.netIncome)} hint={`Cumulé sur ${proj.years.length} ans : ${mc(cumulNet)}`} tone={y1.netIncome < 0 ? "neg" : "pos"} />
        <Kpi label="Point mort (an 1)" value={y1.breakEvenDays === null || y1.breakEvenDays > 365 ? "Non atteint" : `${num(y1.breakEvenDays)} jours`} hint={`Seuil de rentabilité : ${mc(y1.breakEvenRevenue)}`} tone={y1.breakEvenDays === null || y1.breakEvenDays > 365 ? "neg" : undefined} />
        <Kpi label="Trésorerie minimale" value={m(ind.minCash)} hint={monthName(ind.minCashMonth)} tone={ind.minCash < 0 ? "neg" : undefined} />
        <Kpi label="Premier mois bénéficiaire" value={monthName(ind.firstProfitableMonth)} />
        <Kpi label="Retour sur investissement" value={monthName(ind.paybackMonth)} hint={ind.paybackMonth ? undefined : "Au-delà de l'horizon"} tone={ind.paybackMonth ? undefined : "warn"} />
        <Kpi label={`VAN (${num(plan.params.discountRatePct, 1)} %)`} value={mc(ind.npv)} hint={`TRI : ${ind.irr === null ? "—" : pct(ind.irr * 100)}`} tone={ind.npv < 0 ? "neg" : "pos"} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Activité et rentabilité</h2>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={yearData}>
                <CartesianGrid stroke={c.border} vertical={false} />
                <XAxis dataKey="name" tick={axis} stroke={c.border} />
                <YAxis tick={axis} stroke={c.border} tickFormatter={(v) => mc(v)} width={70} />
                <Tooltip {...tooltip} />
                <Legend />
                <ReferenceLine y={0} stroke={c.muted} />
                <Bar dataKey="Chiffre d'affaires" fill={c.c2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="EBE" fill={c.c1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Résultat net" fill={c.c3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Trésorerie fin de mois</h2>
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={cashData}>
                <CartesianGrid stroke={c.border} vertical={false} />
                <XAxis dataKey="name" tick={axis} stroke={c.border} interval={11} />
                <YAxis tick={axis} stroke={c.border} tickFormatter={(v) => mc(v)} width={70} />
                <Tooltip {...tooltip} />
                <ReferenceLine y={0} stroke={c.neg} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Trésorerie" stroke={c.c1} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Synthèse</h2>
          <div className="row no-print">
            <button className="btn sm" onClick={() => setEditing(!editing)}>{editing ? "Terminer" : "Modifier"}</button>
            <button className="btn sm" onClick={() => askClaude("Relis le plan avec les chiffres actuels et propose une synthèse exécutive mise à jour, prête à être présentée à une banque.")}>
              Réécrire avec Claude
            </button>
          </div>
        </div>
        {editing ? (
          <textarea
            rows={12}
            value={plan.texts.summary}
            onChange={(e) => update((p) => ({ ...p, texts: { ...p.texts, summary: e.target.value } }))}
          />
        ) : (
          plan.texts.summary.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)
        )}
      </div>

      <div className="card">
        <h2>Chiffres clés par année</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th></th>{proj.years.map((y) => <th key={y.year}>An {y.year}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td>Chiffre d&apos;affaires</td>{proj.years.map((y) => <td key={y.year}>{m(y.revenue)}</td>)}</tr>
              <tr><td>EBE</td>{proj.years.map((y) => <td key={y.year} className={y.ebitda < 0 ? "neg" : ""}>{m(y.ebitda)}</td>)}</tr>
              <tr><td>Résultat net</td>{proj.years.map((y) => <td key={y.year} className={y.netIncome < 0 ? "neg" : ""}>{m(y.netIncome)}</td>)}</tr>
              <tr><td>CAF</td>{proj.years.map((y) => <td key={y.year}>{m(y.cashFlowFromOps)}</td>)}</tr>
              <tr><td>Trésorerie fin d&apos;année</td>{proj.years.map((y) => <td key={y.year} className={y.endCash < 0 ? "neg" : ""}>{m(y.endCash)}</td>)}</tr>
              <tr><td>Point mort</td>{proj.years.map((y) => <td key={y.year}>{y.breakEvenDays === null || y.breakEvenDays > 365 ? "—" : `${num(y.breakEvenDays)} j`}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="swot">
        {[
          { t: "Points forts", items: plan.texts.strengths, cls: "pos" },
          { t: "Points faibles", items: plan.texts.weaknesses, cls: "neg" },
          { t: "Opportunités", items: plan.texts.opportunities, cls: "pos" },
          { t: "Menaces", items: plan.texts.threats, cls: "warn" },
        ].map((b) => (
          <div className="card" key={b.t}>
            <h3 className={b.cls}>{b.t}</h3>
            <ul>{b.items.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
    </>
  );
}
