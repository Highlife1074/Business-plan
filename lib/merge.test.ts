import { test } from "node:test";
import assert from "node:assert/strict";
import { mergePlans } from "./merge.ts";
import { demoPlan } from "./demo.ts";
import type { Plan } from "./types";

const plan = (id: string, updatedAt: string, name = id): Plan => {
  const p = demoPlan(id);
  return { ...p, updatedAt, meta: { ...p.meta, name } };
};

test("la version la plus récente gagne, dans les deux sens", () => {
  const local = { a: plan("a", "2027-01-02", "local"), b: plan("b", "2027-01-01", "local") };
  const remote = [plan("a", "2027-01-01", "cloud"), plan("b", "2027-01-03", "cloud")];
  const { merged, toUpload } = mergePlans(local, remote, new Set(["a", "b"]));
  assert.equal(merged.a.meta.name, "local");
  assert.equal(merged.b.meta.name, "cloud");
  assert.deepEqual(toUpload.map((p) => p.id), ["a"]);
});

test("un plan créé hors ligne est envoyé dans le cloud", () => {
  const { merged, toUpload } = mergePlans({ n: plan("n", "2027-01-01") }, [], new Set());
  assert.ok(merged.n);
  assert.deepEqual(toUpload.map((p) => p.id), ["n"]);
});

test("un plan supprimé sur un autre appareil disparaît localement", () => {
  const { merged, toUpload } = mergePlans({ d: plan("d", "2027-01-01") }, [], new Set(["d"]));
  assert.equal(merged.d, undefined);
  assert.equal(toUpload.length, 0);
});

test("les plans du cloud absents localement sont récupérés", () => {
  const { merged } = mergePlans({}, [plan("r", "2027-01-01")], new Set());
  assert.ok(merged.r);
});
