"use client";

import { useState } from "react";
import { AutoText, Kpi } from "./ui";
import { ActivityChart, CashChart, PaybackChart, RevenueCostsChart } from "./Charts";
import ScenarioBar from "./ScenarioBar";
import { useMoney } from "./CurrencyProvider";
import type { TabProps } from "./tab";
import { monthName, num } from "@/lib/format";

export default function SummaryTab({ plan, proj, update, askClaude }: TabProps) {
  const { fmt, ct, converted, base } = useMoney();
  const m = (v: number) => fmt(v);
  const mc = (v: number) => fmt(v, true);
  const ind = proj.indicators;
  const y1 = proj.years[0];
  const yN = proj.years[proj.years.length - 1];
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

  return (
    <>
      <div className="card">
        <p>{ct(plan.meta.description)}</p>
        {alerts.map((a, i) => <div key={i} className={`alert ${a.tone}`}>{a.text}</div>)}
      </div>

      <ScenarioBar plan={plan} update={update} />

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="CA année 1" value={m(y1.revenue)} hint={`An ${yN.year} : ${m(yN.revenue)}`} />
        <Kpi label="Résultat net année 1" value={m(y1.netIncome)} hint={`Cumulé sur ${proj.years.length} ans : ${mc(cumulNet)}`} tone={y1.netIncome < 0 ? "neg" : "pos"} />
        <Kpi label="Trésorerie minimale" value={m(ind.minCash)} hint={monthName(ind.minCashMonth)} tone={ind.minCash < 0 ? "neg" : undefined} />
        <Kpi label="Investissement remboursé" value={monthName(ind.paybackMonth)} hint={ind.paybackMonth ? `Investissement : ${mc(ind.totalInvestment)}` : "Au-delà de l'horizon"} tone={ind.paybackMonth ? undefined : "warn"} />
      </div>

      <div className="grid grid-charts">
        <div className="card">
          <h2>Activité et rentabilité</h2>
          <ActivityChart proj={proj} />
        </div>
        <div className="card">
          <h2>Chiffre d&apos;affaires et charges par mois</h2>
          <RevenueCostsChart proj={proj} />
        </div>
        <div className="card">
          <h2>Trésorerie fin de mois</h2>
          <CashChart proj={proj} />
        </div>
        <div className="card">
          <h2>Retour sur investissement</h2>
          <PaybackChart proj={proj} />
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Synthèse</h2>
          <div className="row no-print">
            <button className="btn sm" disabled={converted && !editing} title={converted ? `Repassez en ${base} pour modifier le texte` : undefined} onClick={() => setEditing(!editing)}>{editing ? "Terminer" : "Modifier"}</button>
            <button className="btn sm" onClick={() => askClaude("Relis le plan avec les chiffres actuels et propose une synthèse exécutive mise à jour, prête à être présentée à une banque.")}>
              Réécrire avec Claude
            </button>
          </div>
        </div>
        {editing ? (
          <AutoText
            minRows={8}
            value={plan.texts.summary}
            onChange={(v) => update((p) => ({ ...p, texts: { ...p.texts, summary: v } }))}
          />
        ) : (
          ct(plan.texts.summary).split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)
        )}
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
            <ul>{b.items.slice(0, 4).map((x, i) => <li key={i}>{ct(x)}</li>)}</ul>
          </div>
        ))}
      </div>
    </>
  );
}
