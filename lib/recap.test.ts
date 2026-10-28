import { test } from "node:test";
import assert from "node:assert/strict";
import { projectPlan } from "./finance.ts";
import { buildRecap } from "./recap.ts";
import { demoPlan } from "./demo.ts";

const money = (v: number) => String(Math.round(v));

test("fiche récap : six thèmes notés et une note sur 10", () => {
  const plan = demoPlan("t");
  const r = buildRecap(plan.params, projectPlan(plan), money);
  assert.equal(r.groups.length, 6);
  assert.ok(r.score >= 0 && r.score <= 10);
  for (const g of r.groups) assert.ok(g.items.length > 0);
});

test("fiche récap : un financement insuffisant passe le thème au rouge", () => {
  const plan = demoPlan("t");
  plan.params.financing = { equity: 0, subsidies: 0, loans: [] };
  const r = buildRecap(plan.params, projectPlan(plan), money);
  assert.equal(r.groups.find((g) => g.id === "financing")!.tone, "bad");
  assert.equal(r.tone, "bad");
  assert.match(r.verdict, /financement/);
});

import { detectSector, sectorFor } from "./sectors.ts";

test("secteur détecté d'après le type d'activité", () => {
  assert.equal(detectSector("Lavage auto (self-service + portique)").id, "equipment");
  assert.equal(detectSector("Pizzeria au feu de bois").id, "food");
  assert.equal(detectSector("Boulangerie-pâtisserie").id, "food");
  assert.equal(detectSector("Start-up SaaS de facturation").id, "startup");
  assert.equal(detectSector("Usine de fabrication de palettes").id, "industry");
  assert.equal(detectSector("Hôtel 3 étoiles").id, "lodging");
  assert.equal(detectSector("Cabinet de conseil RH").id, "services");
  assert.equal(detectSector("Épicerie fine").id, "retail");
  assert.equal(detectSector("Élevage d'escargots").id, "general");
  // "bar" en mot entier seulement
  assert.equal(detectSector("Barbier").id, "general");
});

test("le secteur choisi l'emporte sur la détection", () => {
  assert.equal(sectorFor({ businessType: "Pizzeria", sector: "industry" }).id, "industry");
  assert.equal(sectorFor({ businessType: "Pizzeria", sector: "inconnu" }).id, "food");
});

test("les seuils changent avec le secteur", () => {
  const plan = demoPlan("t");
  const proj = projectPlan(plan);
  const ebe = (id: string) =>
    buildRecap(plan.params, proj, money, sectorFor({ businessType: "", sector: id }))
      .groups.find((g) => g.id === "profitability")!.items[0];
  const pctEbe = proj.years[0].ebitdaPct;
  assert.ok(pctEbe > 12 && pctEbe < 75, `EBE an 1 du lavage auto : ${pctEbe}`);
  assert.equal(ebe("food").tone, "good"); // ≥ 12 %
  // un EBE juste sous 30 % serait orange pour un lavage auto, vert pour une pizzeria
  plan.params.fixedCosts = [...plan.params.fixedCosts, { id: "x", label: "x", monthly: (proj.years[0].ebitda - proj.years[0].revenue * 0.2) / 12, note: "" }];
  const proj2 = projectPlan(plan);
  const t = (id: string) =>
    buildRecap(plan.params, proj2, money, sectorFor({ businessType: "", sector: id })).groups.find((g) => g.id === "profitability")!.items[0].tone;
  assert.equal(t("equipment"), "warn");
  assert.equal(t("food"), "good");
});

test("start-up : une perte la première année n'est pas pénalisée si la croisière est rentable", () => {
  const plan = demoPlan("t");
  plan.params.scenario = { volumePct: 60, pricePct: 100, costPct: 100 }; // an 1 déficitaire
  const proj = projectPlan(plan);
  assert.ok(proj.years[0].netIncome < 0);
  const r = buildRecap(plan.params, proj, money, sectorFor({ businessType: "SaaS" }));
  assert.equal(r.sector.id, "startup");
  const items = r.groups.find((g) => g.id === "risk")!.items;
  assert.equal(items[0].label, "Seuil de rentabilité atteint");
  assert.equal(items[1].tone, undefined);
  const net = r.groups.find((g) => g.id === "profitability")!.items[1];
  assert.equal(net.tone, proj.years[proj.years.length - 1].netIncome >= 0 ? "good" : "bad");
});
