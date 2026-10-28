"use client";

import { useState } from "react";
import FinTable, { type FinLine } from "./FinTable";
import ScenarioBar from "./ScenarioBar";
import { useMoney } from "./CurrencyProvider";
import { CashChart, CashFlowChart } from "./Charts";
import type { TabProps } from "./tab";
import type { MonthRow } from "@/lib/finance";
import { applyQuotes } from "@/lib/finance";
import { monthName } from "@/lib/format";

export default function CashTab({ plan, proj, update }: TabProps) {
  const { fmt } = useMoney();
  const m = (v: number) => fmt(v);
  const [detailYear, setDetailYear] = useState(1);
  const params = applyQuotes(plan.params, plan.quotes);

  const lines: FinLine<MonthRow>[] = [
    { label: "Encaissements d'exploitation (CA HT)", value: (r) => r.revenue, format: m },
    { label: "Apport en capital", value: (r) => r.equityIn, format: m },
    { label: "Emprunts", value: (r) => r.loansIn, format: m },
    { label: "Subventions", value: (r) => r.subsidiesIn, format: m },
    { label: "Total encaissements", value: (r) => r.cashIn, format: m, kind: "total" },
    { label: "Investissements", value: (r) => -r.investmentsOut, format: m },
    { label: "Charges variables", value: (r) => -r.variableCosts, format: m },
    { label: "Charges fixes", value: (r) => -r.fixedCosts, format: m },
    { label: "Salaires et charges", value: (r) => -r.staffCosts, format: m },
    { label: "Intérêts", value: (r) => -r.interest, format: m },
    { label: "Remboursement du capital", value: (r) => -r.principalOut, format: m },
    { label: "Impôt sur les sociétés", value: (r) => -r.tax, format: m },
    { label: "Total décaissements", value: (r) => -r.cashOut, format: m, kind: "total" },
    { label: "Flux net du mois", value: (r) => r.netCashFlow, format: m, signColor: true },
    { label: "Trésorerie fin de mois", value: (r) => r.cashBalance, format: m, kind: "total", signColor: true },
  ];

  // Agrégats annuels pour la vue synthétique
  const years = proj.years.map((y) => {
    const rows = proj.months.filter((r) => r.year === y.year);
    const s = (k: keyof MonthRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
    return {
      ...rows[rows.length - 1],
      revenue: s("revenue"), equityIn: s("equityIn"), loansIn: s("loansIn"), subsidiesIn: s("subsidiesIn"),
      cashIn: s("cashIn"), investmentsOut: s("investmentsOut"), variableCosts: s("variableCosts"),
      fixedCosts: s("fixedCosts"), staffCosts: s("staffCosts"), interest: s("interest"),
      principalOut: s("principalOut"), tax: s("tax"), cashOut: s("cashOut"), netCashFlow: s("netCashFlow"),
    } as MonthRow;
  });
  const months = proj.months.filter((r) => r.year === detailYear);

  const loans = params.financing.loans;
  const totalLoans = loans.reduce((a, l) => a + l.amount, 0);

  return (
    <>
      <ScenarioBar plan={plan} update={update} />
      <div className="grid grid-2">
        <div className="card">
          <h2>Plan de financement initial</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Besoins</th><th>Montant</th></tr></thead>
              <tbody>
                {params.investments.map((i) => <tr key={i.id}><td>{i.label}</td><td>{m(i.amount)}</td></tr>)}
                <tr className="total"><td>Total besoins</td><td>{m(proj.indicators.totalInvestment)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Ressources</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ressources</th><th>Montant</th></tr></thead>
              <tbody>
                <tr><td>Apport en capital</td><td>{m(params.financing.equity)}</td></tr>
                <tr><td>Subventions</td><td>{m(params.financing.subsidies)}</td></tr>
                {loans.map((l) => <tr key={l.id}><td>{l.label} ({l.ratePct} %, {l.years} ans)</td><td>{m(l.amount)}</td></tr>)}
                <tr className="total"><td>Total ressources</td><td>{m(proj.indicators.totalFinancing)}</td></tr>
                <tr className="sub"><td>Part de dette</td><td>{proj.indicators.totalFinancing ? Math.round((totalLoans / proj.indicators.totalFinancing) * 100) : 0} %</td></tr>
                <tr><td>Écart ressources − besoins</td><td className={proj.indicators.financingGap < 0 ? "neg" : "pos"}>{m(proj.indicators.financingGap)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Évolution de la trésorerie</h2>
        <p className="muted small">
          Point bas : <strong className={proj.indicators.minCash < 0 ? "neg" : ""}>{m(proj.indicators.minCash)}</strong> en {monthName(proj.indicators.minCashMonth)}.
          Montants HT : la TVA collectée est reversée et n&apos;est pas modélisée.
        </p>
        <CashChart proj={proj} />
      </div>

      <div className="card">
        <h2>Encaissements et décaissements d&apos;exploitation</h2>
        <p className="muted small">Par mois, hors apport, emprunts, subventions et investissement de départ.</p>
        <CashFlowChart proj={proj} />
      </div>

      <div className="card">
        <h2>Tableau de trésorerie annuel</h2>
        <FinTable columns={years} headers={years.map((y) => `Année ${y.year}`)} lines={lines.map((l) => l.label === "Trésorerie fin de mois" ? { ...l, label: "Trésorerie fin d'année" } : l.label === "Flux net du mois" ? { ...l, label: "Flux net de l'année" } : l)} />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Tableau de trésorerie mensuel</h2>
          <select style={{ width: "auto" }} value={detailYear} onChange={(e) => setDetailYear(Number(e.target.value))}>
            {proj.years.map((y) => <option key={y.year} value={y.year}>Année {y.year}</option>)}
          </select>
        </div>
        <FinTable columns={months} headers={months.map((r) => r.label)} lines={lines} />
      </div>
    </>
  );
}
