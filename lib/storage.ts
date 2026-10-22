"use client";

import type { Plan } from "./types";
import { cloudDeletePlan, cloudListPlans, cloudSavePlan } from "./firebase";
import { mergePlans } from "./merge";

// Les plans sont toujours enregistrés dans le navigateur (localStorage), qui sert de cache.
// Une fois connecté avec Google, ils sont aussi synchronisés dans Firestore pour être
// retrouvés sur tous les appareils (PC, téléphone…).
const KEY = "bp-sim:plans";
const SYNCED = "bp-sim:synced-ids"; // plans déjà présents dans le cloud lors de la dernière synchro

let uid: string | null = null;
const pending = new Map<string, ReturnType<typeof setTimeout>>();
let onError: (message: string) => void = () => {};

export function setCloudUser(id: string | null) {
  uid = id;
}

export function currentUid(): string | null {
  return uid;
}

export function onCloudError(cb: (message: string) => void) {
  onError = cb;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privée…) : on ignore
  }
}

const readAll = () => readJson<Record<string, Plan>>(KEY, {});
const writeAll = (plans: Record<string, Plan>) => writeJson(KEY, plans);

export function listPlans(): Plan[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPlan(id: string): Plan | null {
  return readAll()[id] ?? null;
}

function pushToCloud(plan: Plan) {
  if (!uid) return;
  const user = uid;
  cloudSavePlan(user, plan)
    .then(() => {
      const synced = new Set(readJson<string[]>(SYNCED, []));
      synced.add(plan.id);
      writeJson(SYNCED, [...synced]);
    })
    .catch((err) => onError(`Sauvegarde en ligne impossible : ${err instanceof Error ? err.message : err}`));
}

export function savePlan(plan: Plan) {
  const all = readAll();
  all[plan.id] = plan;
  writeAll(all);
  if (!uid) return;
  // Regroupe les modifications rapides (saisie) en une seule écriture cloud
  clearTimeout(pending.get(plan.id));
  pending.set(
    plan.id,
    setTimeout(() => {
      pending.delete(plan.id);
      const latest = getPlan(plan.id);
      if (latest) pushToCloud(latest);
    }, 1200),
  );
}

// Envoie immédiatement les sauvegardes en attente (fermeture de l'onglet, mise en arrière-plan…)
export function flushPending() {
  for (const [id, t] of pending) {
    clearTimeout(t);
    const plan = getPlan(id);
    if (plan) pushToCloud(plan);
  }
  pending.clear();
}

export function deletePlan(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
  clearTimeout(pending.get(id));
  pending.delete(id);
  if (uid) {
    cloudDeletePlan(uid, id).catch((err) => onError(`Suppression en ligne impossible : ${err instanceof Error ? err.message : err}`));
    writeJson(SYNCED, readJson<string[]>(SYNCED, []).filter((x) => x !== id));
  }
}

// Synchronise le navigateur avec le cloud (voir mergePlans pour les règles de fusion).
export async function syncWithCloud(user: string): Promise<void> {
  flushPending();
  const remote = await cloudListPlans(user);
  const { merged, toUpload } = mergePlans(readAll(), remote, new Set(readJson<string[]>(SYNCED, [])));
  await Promise.all(toUpload.map((p) => cloudSavePlan(user, p)));
  // Conserve les modifications locales faites pendant la synchronisation
  for (const p of Object.values(readAll())) {
    if (merged[p.id] && p.updatedAt > merged[p.id].updatedAt) merged[p.id] = p;
  }
  writeAll(merged);
  writeJson(SYNCED, Object.keys(merged));
}
