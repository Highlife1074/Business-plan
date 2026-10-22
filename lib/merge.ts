import type { Plan } from "./types";

// Fusion navigateur ↔ cloud : pour chaque plan, la version la plus récente (updatedAt) gagne.
// Un plan local absent du cloud est envoyé, sauf s'il avait déjà été synchronisé :
// il a alors été supprimé depuis un autre appareil et disparaît aussi localement.
export function mergePlans(
  local: Record<string, Plan>,
  remote: Plan[],
  syncedIds: Set<string>,
): { merged: Record<string, Plan>; toUpload: Plan[] } {
  const merged: Record<string, Plan> = {};
  const toUpload: Plan[] = [];
  const remoteIds = new Set<string>();
  for (const r of remote) {
    remoteIds.add(r.id);
    const l = local[r.id];
    if (l && l.updatedAt > r.updatedAt) {
      merged[r.id] = l;
      toUpload.push(l);
    } else {
      merged[r.id] = r;
    }
  }
  for (const l of Object.values(local)) {
    if (remoteIds.has(l.id) || syncedIds.has(l.id)) continue;
    merged[l.id] = l;
    toUpload.push(l);
  }
  return { merged, toUpload };
}
