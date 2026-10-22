"use client";

import React from "react";

// Garde-fou : un effet React doit renvoyer une fonction de nettoyage ou rien. Si un effet renvoie
// autre chose, React plante au démontage du composant (« TypeError: i is not a function »).
// On neutralise la valeur et on mémorise l'effet fautif pour le diagnostic (affiché dans Réglages).
const DIAG_KEY = "bp-sim:diag";

type Effect = () => unknown;

function wrap(effect: Effect): () => void | (() => void) {
  return () => {
    const result = effect();
    if (result === undefined || typeof result === "function") return result as void | (() => void);
    try {
      const entry = `${new Date().toISOString()} — effet renvoyant ${Object.prototype.toString.call(result)} : ${effect.toString().slice(0, 300)}`;
      const list = JSON.parse(localStorage.getItem(DIAG_KEY) ?? "[]") as string[];
      if (!list.some((l) => l.endsWith(entry.split(" — ")[1]))) {
        localStorage.setItem(DIAG_KEY, JSON.stringify([...list, entry].slice(-5)));
      }
      console.warn(entry);
    } catch {}
    return undefined;
  };
}

type Hook = (effect: Effect, deps?: React.DependencyList) => void;
// Les modules compilés lisent React.useEffect au moment de l'appel : on remplace la propriété
// directement sur l'objet exporté par React.
const target = React as unknown as Record<string, Hook & { __guarded?: boolean }>;
for (const name of ["useEffect", "useLayoutEffect"]) {
  const original = target[name];
  if (typeof original === "function" && !original.__guarded) {
    const guarded = ((effect: Effect, deps?: React.DependencyList) => original(wrap(effect), deps)) as Hook & { __guarded?: boolean };
    guarded.__guarded = true;
    try {
      target[name] = guarded;
    } catch {
      // module en lecture seule : le garde-fou est simplement inactif
    }
  }
}

export function readDiagnostics(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DIAG_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function clearDiagnostics() {
  try {
    localStorage.removeItem(DIAG_KEY);
  } catch {}
}
