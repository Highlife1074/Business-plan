import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPlanChanges } from "./plan-edit.ts";
import { demoPlan } from "./demo.ts";
import { project } from "./finance.ts";

let n = 0;
const newId = () => `new-${++n}`;

test("modifie une charge fixe par identifiant et le résultat change", () => {
  const plan = demoPlan("x");
  const { plan: p, log, errors } = applyPlanChanges(plan, [
    { action: "modifier", section: "charges_fixes", id: "fc-terrain", valeurs: { monthly: 6000 } },
  ], newId);
  assert.deepEqual(errors, []);
  assert.equal(p.params.fixedCosts.find((c) => c.id === "fc-terrain")!.monthly, 6000);
  assert.ok(log[0].includes("8000 → 6000"), log[0]);
  assert.ok(project(p.params).years[0].netIncome > project(plan.params).years[0].netIncome);
  assert.equal(plan.params.fixedCosts[0].monthly, 8000, "le plan d'origine n'est pas modifié");
});

test("retrouve une ligne par son libellé, ajoute et supprime", () => {
  const plan = demoPlan("x");
  const { plan: p, errors } = applyPlanChanges(plan, [
    { action: "modifier", section: "revenus", id: "portique", valeurs: { unitPrice: "35", unitsPerDay: 50 } },
    { action: "ajouter", section: "personnel", valeurs: { role: "Agent d'accueil", count: 1, grossMonthly: 5000, startMonth: 6 } },
    { action: "supprimer", section: "charges_fixes", id: "marketing" },
  ], newId);
  assert.deepEqual(errors, []);
  const portique = p.params.revenueStreams.find((s) => s.id === "rs-portique")!;
  assert.equal(portique.unitPrice, 35);
  assert.equal(portique.unitsPerDay, 50);
  assert.equal(p.params.staff.length, plan.params.staff.length + 1);
  assert.equal(p.params.staff.at(-1)!.role, "Agent d'accueil");
  assert.ok(!p.params.fixedCosts.some((c) => c.label.toLowerCase().includes("marketing")));
});

test("paramètres généraux, financement, saisonnalité et textes", () => {
  const plan = demoPlan("x");
  const { plan: p, errors } = applyPlanChanges(plan, [
    { action: "modifier", section: "general", valeurs: { vatRatePct: 8, inflationPct: 2 } },
    { action: "modifier", section: "financement", valeurs: { equity: 700000 } },
    { action: "modifier", section: "saisonnalite", valeurs: { "7": 0.7 } },
    { action: "modifier", section: "textes", valeurs: { strengths: ["A", "B"] } },
  ], newId);
  assert.deepEqual(errors, []);
  assert.equal(p.params.vatRatePct, 8);
  assert.equal(p.params.financing.equity, 700000);
  assert.equal(p.params.seasonality[6], 0.7);
  assert.deepEqual(p.texts.strengths, ["A", "B"]);
});

test("les erreurs sont signalées sans bloquer les autres modifications", () => {
  const plan = demoPlan("x");
  const { plan: p, errors } = applyPlanChanges(plan, [
    { action: "modifier", section: "charges_fixes", id: "inexistant", valeurs: { monthly: 1 } },
    { action: "modifier", section: "general", valeurs: { tva: 5, vatRatePct: "abc" } },
    { action: "modifier", section: "inconnue", valeurs: {} },
    { action: "modifier", section: "general", valeurs: { horizonYears: 7 } },
  ], newId);
  assert.equal(errors.length, 4);
  assert.equal(p.params.horizonYears, 7);
});

test("charges variables : ajout en % sur une ligne de CA (par libellé) et modification", () => {
  const plan = demoPlan("x");
  const base = project(plan.params).years[1];
  const { plan: p, errors, log } = applyPlanChanges(plan, [
    { action: "ajouter", section: "charges_variables", valeurs: { label: "Commission application", mode: "pct", value: 3, streamId: "portique" } },
    { action: "modifier", section: "charges_variables", id: "vc-energie", valeurs: { value: 6 } },
  ], newId);
  assert.deepEqual(errors, []);
  const added = p.params.variableCosts.at(-1)!;
  assert.equal(added.streamId, "rs-portique");
  assert.equal(p.params.variableCosts.find((v) => v.id === "vc-energie")!.value, 6);
  assert.ok(project(p.params).years[1].variableCosts > base.variableCosts);
  assert.equal(log.length, 2);
});

import { migrateVariableCosts } from "./plan.ts";

test("anciens plans : le % de coût variable des lignes de CA devient une charge variable, sans changer les résultats", () => {
  const plan = demoPlan("x");
  const legacy = {
    ...plan.params,
    variableCosts: undefined as unknown as typeof plan.params.variableCosts,
    revenueStreams: plan.params.revenueStreams.map((s, i) => ({ ...s, variableCostPct: [12, 15, 5][i] })),
  };
  const before = project({ ...legacy, variableCosts: [] }).years[2];
  const migrated = migrateVariableCosts(legacy);
  assert.equal(migrated.variableCosts.length, 3);
  assert.ok(migrated.revenueStreams.every((s) => s.variableCostPct === 0));
  assert.equal(migrated.variableCosts[0].streamId, "rs-boxes");
  assert.ok(Math.abs(project(migrated).years[2].netIncome - before.netIncome) < 1);
  assert.equal(migrateVariableCosts(migrated), migrated, "migration idempotente");
});
