import { test } from "node:test";
import assert from "node:assert/strict";
import { applyQuotes, irr, loanSchedule, monthLabel, project } from "./finance.ts";
import { demoPlan } from "./demo.ts";

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("monthLabel avance correctement à travers les années", () => {
  assert.equal(monthLabel("2027-11", 0), "2027-11");
  assert.equal(monthLabel("2027-11", 2), "2028-01");
});

test("le prêt est intégralement remboursé sur sa durée", () => {
  const s = loanSchedule(120000, 6, 5, 6, 60);
  close(s.principal.reduce((a, b) => a + b, 0), 120000, 1e-4);
  assert.equal(s.principal.slice(0, 6).every((p) => p === 0), true);
  close(s.interest[0], 600);
});

test("prêt à taux zéro", () => {
  const s = loanSchedule(1200, 0, 1, 0, 12);
  assert.ok(s.principal.every((p) => Math.abs(p - 100) < 1e-9));
});

test("TRI d'un flux simple", () => {
  close(irr([-100, 110])!, 0.1, 1e-6);
});

test("projection : cohérence trésorerie et compte de résultat", () => {
  const plan = demoPlan("t");
  const p = project(plan.params);
  assert.equal(p.months.length, 60);
  assert.equal(p.years.length, 5);
  const last = p.months[p.months.length - 1];
  const totalFlows = p.months.reduce((a, r) => a + r.netCashFlow, 0);
  close(last.cashBalance, totalFlows, 1e-3);
  // Trésorerie = financements - investissements + EBE - intérêts - capital - IS
  const f = plan.params.financing;
  const expected =
    f.equity + f.subsidies + p.indicators.totalLoans - p.indicators.totalInvestment +
    p.months.reduce((a, r) => a + r.ebitda - r.interest - r.principalOut - r.tax, 0);
  close(last.cashBalance, expected, 1e-3);
  for (const y of p.years) close(y.netIncome, y.ebt - y.tax, 1e-6);
  assert.ok(p.years[1].revenue > p.years[0].revenue, "la montée en charge augmente le CA en année 2");
});

test("scénario pessimiste dégrade le résultat", () => {
  const plan = demoPlan("t");
  const base = project(plan.params);
  const pess = project({ ...plan.params, scenario: { volumePct: 80, pricePct: 100, costPct: 110 } });
  assert.ok(pess.years[2].netIncome < base.years[2].netIncome);
});

test("un devis retenu remplace le montant de la ligne liée", () => {
  const plan = demoPlan("t");
  const params = applyQuotes(plan.params, [
    {
      id: "q1", supplier: "X", label: "Portique", amount: 400000, kind: "investissement",
      linkedId: "inv-portique", status: "retenu", date: "", validUntil: "", contact: "", notes: "",
    },
    {
      id: "q2", supplier: "Y", label: "Portique", amount: 999999, kind: "investissement",
      linkedId: "inv-portique", status: "refusé", date: "", validUntil: "", contact: "", notes: "",
    },
  ]);
  assert.equal(params.investments.find((i) => i.id === "inv-portique")!.amount, 400000);
});
