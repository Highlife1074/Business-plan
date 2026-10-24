import type { Plan } from "./types";

// Modifications du plan demandées par l'assistant Claude (outil « modifier_plan »).
// Chaque modification cible une section ; les montants sont dans la devise du plan.

export type EditAction = "modifier" | "ajouter" | "supprimer";

export interface PlanChange {
  action: EditAction;
  section: string;
  id?: string; // identifiant de la ligne (ou son libellé)
  valeurs?: Record<string, unknown>;
}

type FieldType = "number" | "string" | "level" | "stringList";

interface ListSection {
  kind: "list";
  label: string;
  fields: Record<string, FieldType>;
  nameField: string;
  get: (p: Plan) => { id: string }[];
  set: (p: Plan, rows: { id: string }[]) => Plan;
  blank: Record<string, unknown>;
}

interface ObjectSection {
  kind: "object";
  label: string;
  fields: Record<string, FieldType>;
  get: (p: Plan) => Record<string, unknown>;
  set: (p: Plan, values: Record<string, unknown>) => Plan;
}

const withParams = (p: Plan, patch: Partial<Plan["params"]>): Plan => ({ ...p, params: { ...p.params, ...patch } });
const withTexts = (p: Plan, patch: Partial<Plan["texts"]>): Plan => ({ ...p, texts: { ...p.texts, ...patch } });

export const SECTIONS: Record<string, ListSection | ObjectSection> = {
  general: {
    kind: "object",
    label: "Paramètres généraux",
    fields: {
      startDate: "string", horizonYears: "number", vatRatePct: "number", corporateTaxPct: "number",
      employerChargesPct: "number", inflationPct: "number", discountRatePct: "number",
      rampUpMonths: "number", rampUpStartPct: "number",
    },
    get: (p) => p.params as unknown as Record<string, unknown>,
    set: (p, v) => withParams(p, v),
  },
  projet: {
    kind: "object",
    label: "Projet",
    fields: { name: "string", description: "string", city: "string" },
    get: (p) => p.meta as unknown as Record<string, unknown>,
    set: (p, v) => ({ ...p, meta: { ...p.meta, ...v } }),
  },
  saisonnalite: {
    kind: "object",
    label: "Saisonnalité",
    fields: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), "number"])) as Record<string, FieldType>,
    get: (p) => Object.fromEntries(p.params.seasonality.map((v, i) => [String(i + 1), v])),
    set: (p, v) => withParams(p, { seasonality: p.params.seasonality.map((x, i) => (v[String(i + 1)] as number) ?? x) }),
  },
  financement: {
    kind: "object",
    label: "Financement",
    fields: { equity: "number", subsidies: "number" },
    get: (p) => p.params.financing as unknown as Record<string, unknown>,
    set: (p, v) => withParams(p, { financing: { ...p.params.financing, ...v } }),
  },
  scenario: {
    kind: "object",
    label: "Scénario",
    fields: { volumePct: "number", pricePct: "number", costPct: "number" },
    get: (p) => p.params.scenario as unknown as Record<string, unknown>,
    set: (p, v) => withParams(p, { scenario: { ...p.params.scenario, ...v } }),
  },
  textes: {
    kind: "object",
    label: "Textes",
    fields: {
      summary: "string", market: "string", strengths: "stringList", weaknesses: "stringList",
      opportunities: "stringList", threats: "stringList", keyAssumptions: "stringList",
    },
    get: (p) => p.texts as unknown as Record<string, unknown>,
    set: (p, v) => withTexts(p, v),
  },
  revenus: {
    kind: "list",
    label: "Chiffre d'affaires",
    nameField: "label",
    fields: {
      label: "string", unitLabel: "string", unitPrice: "number", unitsPerDay: "number",
      openDaysPerMonth: "number", variableCostPct: "number", growthPct: "number", note: "string",
    },
    get: (p) => p.params.revenueStreams,
    set: (p, rows) => withParams(p, { revenueStreams: rows as Plan["params"]["revenueStreams"] }),
    blank: { label: "Nouvelle ligne", unitLabel: "unité", unitPrice: 0, unitsPerDay: 0, openDaysPerMonth: 26, variableCostPct: 30, growthPct: 0, note: "" },
  },
  charges_fixes: {
    kind: "list",
    label: "Charges fixes",
    nameField: "label",
    fields: { label: "string", monthly: "number", note: "string" },
    get: (p) => p.params.fixedCosts,
    set: (p, rows) => withParams(p, { fixedCosts: rows as Plan["params"]["fixedCosts"] }),
    blank: { label: "Nouvelle charge", monthly: 0, note: "" },
  },
  personnel: {
    kind: "list",
    label: "Personnel",
    nameField: "role",
    fields: { role: "string", count: "number", grossMonthly: "number", startMonth: "number" },
    get: (p) => p.params.staff,
    set: (p, rows) => withParams(p, { staff: rows as Plan["params"]["staff"] }),
    blank: { role: "Nouveau poste", count: 1, grossMonthly: 0, startMonth: 1 },
  },
  investissements: {
    kind: "list",
    label: "Investissements",
    nameField: "label",
    fields: { label: "string", amount: "number", depreciationYears: "number", note: "string" },
    get: (p) => p.params.investments,
    set: (p, rows) => withParams(p, { investments: rows as Plan["params"]["investments"] }),
    blank: { label: "Nouvel investissement", amount: 0, depreciationYears: 5, note: "" },
  },
  prets: {
    kind: "list",
    label: "Prêts",
    nameField: "label",
    fields: { label: "string", amount: "number", ratePct: "number", years: "number", deferralMonths: "number" },
    get: (p) => p.params.financing.loans,
    set: (p, rows) => withParams(p, { financing: { ...p.params.financing, loans: rows as Plan["params"]["financing"]["loans"] } }),
    blank: { label: "Prêt bancaire", amount: 0, ratePct: 5, years: 7, deferralMonths: 0 },
  },
  juridique: {
    kind: "list",
    label: "Juridique",
    nameField: "title",
    fields: { title: "string", content: "string" },
    get: (p) => p.texts.legal,
    set: (p, rows) => withTexts(p, { legal: rows as Plan["texts"]["legal"] }),
    blank: { title: "Nouveau point", content: "" },
  },
  risques: {
    kind: "list",
    label: "Risques",
    nameField: "risk",
    fields: { risk: "string", probability: "level", impact: "level", mitigation: "string" },
    get: (p) => p.texts.risks,
    set: (p, rows) => withTexts(p, { risks: rows as Plan["texts"]["risks"] }),
    blank: { risk: "Nouveau risque", probability: "moyen", impact: "moyen", mitigation: "" },
  },
  devis_a_obtenir: {
    kind: "list",
    label: "Devis à obtenir",
    nameField: "item",
    fields: { item: "string", category: "string", estimatedAmount: "number", done: "number" },
    get: (p) => p.quoteNeeds,
    set: (p, rows) => ({ ...p, quoteNeeds: rows as Plan["quoteNeeds"] }),
    blank: { item: "Nouveau devis", category: "", estimatedAmount: 0, done: false },
  },
};

function coerce(type: FieldType, value: unknown): { ok: true; value: unknown } | { ok: false } {
  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).replace(/[\s  ]/g, "").replace(",", "."));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    case "string":
      return typeof value === "string" ? { ok: true, value } : { ok: false };
    case "level":
      return value === "faible" || value === "moyen" || value === "élevé" ? { ok: true, value } : { ok: false };
    case "stringList":
      return Array.isArray(value) && value.every((x) => typeof x === "string") ? { ok: true, value } : { ok: false };
  }
}

function cleanValues(
  fields: Record<string, FieldType>,
  values: Record<string, unknown> | undefined,
  errors: string[],
  where: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    const type = fields[k];
    if (!type) {
      errors.push(`${where} : champ inconnu « ${k} » (champs possibles : ${Object.keys(fields).join(", ")})`);
      continue;
    }
    const c = coerce(type, v);
    if (!c.ok) errors.push(`${where} : valeur invalide pour « ${k} » (${JSON.stringify(v)})`);
    else out[k] = k === "done" ? Boolean(c.value) : c.value;
  }
  return out;
}

const fmtVal = (v: unknown) => (Array.isArray(v) ? `[${v.length} éléments]` : typeof v === "string" && v.length > 60 ? `${v.slice(0, 57)}…` : String(v));

// Applique une liste de modifications ; renvoie le plan modifié, le journal lisible et les erreurs.
export function applyPlanChanges(
  plan: Plan,
  changes: PlanChange[],
  newId: () => string,
): { plan: Plan; log: string[]; errors: string[] } {
  let p = plan;
  const log: string[] = [];
  const errors: string[] = [];
  for (const ch of changes) {
    const section = SECTIONS[ch.section];
    if (!section) {
      errors.push(`Section inconnue « ${ch.section} » (sections : ${Object.keys(SECTIONS).join(", ")})`);
      continue;
    }
    if (section.kind === "object") {
      if (ch.action !== "modifier") {
        errors.push(`${section.label} : seule l'action « modifier » est possible`);
        continue;
      }
      const values = cleanValues(section.fields, ch.valeurs, errors, section.label);
      if (Object.keys(values).length === 0) continue;
      const before = section.get(p);
      p = section.set(p, values);
      for (const [k, v] of Object.entries(values)) log.push(`${section.label} · ${k} : ${fmtVal(before[k])} → ${fmtVal(v)}`);
      continue;
    }
    const rows = section.get(p);
    const find = () => {
      if (!ch.id) return -1;
      const byId = rows.findIndex((r) => r.id === ch.id);
      if (byId >= 0) return byId;
      const q = ch.id.toLowerCase();
      return rows.findIndex((r) => String((r as Record<string, unknown>)[section.nameField] ?? "").toLowerCase().includes(q));
    };
    const name = (r: unknown) => String((r as Record<string, unknown>)[section.nameField] ?? "");
    if (ch.action === "ajouter") {
      const values = cleanValues(section.fields, ch.valeurs, errors, section.label);
      const row = { ...section.blank, ...values, id: newId() };
      p = section.set(p, [...rows, row]);
      log.push(`${section.label} : ajout de « ${name(row)} »`);
    } else if (ch.action === "supprimer") {
      const i = find();
      if (i < 0) {
        errors.push(`${section.label} : ligne « ${ch.id ?? "?"} » introuvable`);
        continue;
      }
      log.push(`${section.label} : suppression de « ${name(rows[i])} »`);
      p = section.set(p, rows.filter((_, j) => j !== i));
    } else if (ch.action === "modifier") {
      const i = find();
      if (i < 0) {
        errors.push(`${section.label} : ligne « ${ch.id ?? "?"} » introuvable`);
        continue;
      }
      const values = cleanValues(section.fields, ch.valeurs, errors, `${section.label} « ${name(rows[i])} »`);
      if (Object.keys(values).length === 0) continue;
      const before = rows[i] as Record<string, unknown>;
      p = section.set(p, rows.map((r, j) => (j === i ? { ...r, ...values } : r)));
      for (const [k, v] of Object.entries(values)) log.push(`${section.label} « ${name(before)} » · ${k} : ${fmtVal(before[k])} → ${fmtVal(v)}`);
    } else {
      errors.push(`Action inconnue « ${ch.action} »`);
    }
  }
  return { plan: p, log, errors };
}
