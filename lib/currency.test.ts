import { test } from "node:test";
import assert from "node:assert/strict";
import { convertPlan } from "./currency.ts";
import { project } from "./finance.ts";
import { demoPlan } from "./demo.ts";

test("convertir le plan multiplie tous les montants par le taux", () => {
  const plan = demoPlan("x");
  const eur = convertPlan(plan, "EUR", 0.25);
  assert.equal(eur.meta.currency, "EUR");
  assert.equal(eur.params.investments[0].amount, plan.params.investments[0].amount * 0.25);
  assert.equal(eur.params.financing.equity, plan.params.financing.equity * 0.25);
  assert.equal(eur.params.revenueStreams[0].unitPrice, 3.25);
  // les pourcentages et volumes ne bougent pas
  assert.equal(eur.params.vatRatePct, plan.params.vatRatePct);
  assert.equal(eur.params.revenueStreams[0].unitsPerDay, plan.params.revenueStreams[0].unitsPerDay);
});

test("les résultats convertis valent les résultats d'origine × taux", () => {
  const plan = demoPlan("x");
  const a = project(plan.params);
  const b = project(convertPlan(plan, "EUR", 0.25).params);
  for (let i = 0; i < a.years.length; i++) {
    assert.ok(Math.abs(b.years[i].revenue - a.years[i].revenue * 0.25) < 1);
    assert.ok(Math.abs(b.years[i].netIncome - a.years[i].netIncome * 0.25) < 1);
  }
});
