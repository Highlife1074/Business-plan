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
