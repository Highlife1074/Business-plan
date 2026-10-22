import type { Plan } from "./types";

// Les plans sont enregistrés dans le navigateur (localStorage).
// Export/import JSON disponibles pour sauvegarder ou partager un plan.
const KEY = "bp-sim:plans";

function readAll(): Record<string, Plan> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Plan>;
  } catch {
    return {};
  }
}

function writeAll(plans: Record<string, Plan>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plans));
  } catch {
    // stockage indisponible (navigation privée…) : on ignore
  }
}

export function listPlans(): Plan[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPlan(id: string): Plan | null {
  return readAll()[id] ?? null;
}

export function savePlan(plan: Plan) {
  const all = readAll();
  all[plan.id] = plan;
  writeAll(all);
}

export function deletePlan(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}
