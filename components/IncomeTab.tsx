"use client";

import { useState } from "react";
import FinTable, { type FinLine } from "./FinTable";
import ScenarioBar from "./ScenarioBar";
import { useMoney } from "./CurrencyProvider";
import type { TabProps } from "./tab";
import type { MonthRow, YearRow } from "@/lib/finance";
import { pct } from "@/lib/format";

export default function IncomeTab({ plan, proj, update, askClaude }: TabProps) {
  const { fmt } = useMoney();
  const m = (v: number) => fmt(v);
  const p = (v: number) => pct(v);
  const [detailYear, setDetailYear] = useState(1);

  const yearLines: FinLine<YearRow>[] = [
    { label: "Chiffre d'affaires HT", value: (y) => y.revenue, format: m, kind: "total" },
    { label: "Coûts variables", value: (y) => -y.variableCosts, format: m },
    { label: "Marge brute", value: (y) => y.grossMargin, format: m, kind: "total", signColor: true },
    { label: "Taux de marge brute", value: (y) => y.grossMarginPct, format: p, kind: "sub" },
    { label: "Charges fixes", value: (y) => -y.fixedCosts, format: m },
    { label: "Salaires et charges sociales", value: (y) => -y.staffCosts, format: m },
    { label: "Excédent brut d'exploitation (EBE)", value: (y) => y.ebitda, format: m, kind: "total", signColor: true },
    { label: "EBE / CA", value: (y) => y.ebitdaPct, format: p, kind: "sub" },
    { label: "Dotations aux amortissements", value: (y) => -y.depreciation, format: m },
    { label: "Résultat d'exploitation", value: (y) => y.operatingIncome, format: m, kind: "total", signColor: true },
    { label: "Charges financières (intérêts)", value: (y) => -y.interest, format: m },
    { label: "Résultat avant impôt", value: (y) => y.ebt, format: m, signColor: true },
    { label: "Impôt sur les sociétés", value: (y) => -y.tax, format: m },
    { label: "Résultat net", value: (y) => y.netIncome, format: m, kind: "total", signColor: true },
    { label: "Marge nette", value: (y) => y.netMarginPct, format: p, kind: "sub" },
    { label: "Capacité d'autofinancement (CAF)", value: (y) => y.cashFlowFromOps, format: m, signColor: true },
  ];

  const monthLines: FinLine<MonthRow>[] = [
    { label: "Chiffre d'affaires HT", value: (r) => r.revenue, format: m, kind: "total" },
    { label: "Coûts variables", value: (r) => -r.variableCosts, format: m },
    { label: "Marge brute", value: (r) => r.grossMargin, format: m, kind: "total" },
    { label: "Charges fixes", value: (r) => -r.fixedCosts, format: m },
    { label: "Personnel", value: (r) => -r.staffCosts, format: m },
    { label: "EBE", value: (r) => r.ebitda, format: m, kind: "total", signColor: true },
    { label: "Amortissements", value: (r) => -r.depreciation, format: m },
    { label: "Intérêts", value: (r) => -r.interest, format: m },
    { label: "Résultat avant impôt", value: (r) => r.ebt, format: m, kind: "total", signColor: true },
  ];
  const months = proj.months.filter((r) => r.year === detailYear);

  return (
    <>
      <ScenarioBar plan={plan} update={update} />
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Compte de résultat prévisionnel</h2>
          <button className="btn sm no-print" onClick={() => askClaude("Commente le compte de résultat prévisionnel : quels postes pèsent le plus, quels ratios sont hors normes pour ce secteur, et comment améliorer la rentabilité ?")}>
            Analyser avec Claude
          </button>
        </div>
        <FinTable columns={proj.years} headers={proj.years.map((y) => `Année ${y.year}`)} lines={yearLines} />
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Détail mensuel</h2>
          <select style={{ width: "auto" }} value={detailYear} onChange={(e) => setDetailYear(Number(e.target.value))}>
            {proj.years.map((y) => <option key={y.year} value={y.year}>Année {y.year}</option>)}
          </select>
        </div>
        <FinTable columns={months} headers={months.map((r) => r.label)} lines={monthLines} />
      </div>
    </>
  );
}
