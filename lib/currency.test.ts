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

import { convertText } from "./currency.ts";

const fmt = (v: number, compact: boolean) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: compact ? 1 : 0, notation: compact ? "compact" : "standard" }).format(v);
const norm = (s: string) => s.replace(/[  ]/g, " ");

test("convertit les montants écrits dans un texte", () => {
  const t = "L'investissement est d'environ 1,88 M PLN, financé par 620 k PLN d'apport et un prêt de 1 200 000 PLN ; capital minimum 5 000 zł.";
  const out = norm(convertText(t, "PLN", "EUR", 0.25, fmt));
  assert.ok(out.includes("470 k €") || out.includes("0,5 M €"), out);
  assert.ok(out.includes("155 k €"), out);
  assert.ok(out.includes("300 k €"), out);
  assert.ok(out.includes("1 250 €"), out);
  assert.ok(!/PLN|zł/.test(out), out);
});

test("ne touche pas aux nombres sans devise ni aux autres devises", () => {
  const t = "4 boxes, 30 lavages par jour, 23 % de TVA, prix de 10 EUR.";
  assert.equal(convertText(t, "PLN", "EUR", 0.25, fmt), t);
});

test("montant avec la devise avant et en toutes lettres", () => {
  const out = norm(convertText("Budget PLN 8 000, soit 2 millions de PLN sur 5 ans.", "PLN", "EUR", 0.25, fmt));
  assert.ok(out.includes("2 000 €"), out);
  assert.ok(out.includes("500 k €"), out);
});

test("même devise : texte inchangé", () => {
  assert.equal(convertText("620 k PLN", "PLN", "PLN", 1, fmt), "620 k PLN");
});
