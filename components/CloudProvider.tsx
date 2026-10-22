"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cloudEnabled, cloudGetSettings, cloudSaveSettings, signInWithGoogle, signOutUser, watchUser, type User } from "@/lib/firebase";
import { flushPending, onCloudError, setCloudUser, syncWithCloud } from "@/lib/storage";
import { getApiKey, setLocalApiKey } from "@/lib/claude";

interface CloudState {
  enabled: boolean;
  user: User | null;
  ready: boolean; // état de connexion connu
  syncing: boolean;
  version: number; // incrémenté après chaque synchro : les pages relisent alors leurs données
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<CloudState | null>(null);

export function useCloud(): CloudState {
  const c = useContext(Ctx);
  if (!c) throw new Error("CloudProvider manquant");
  return c;
}

export default function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);
  const [syncing, setSyncing] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const lastSync = useRef(0);

  const sync = useCallback(async (u: User) => {
    setSyncing(true);
    try {
      await syncWithCloud(u.uid);
      // Clé API : le cloud fait foi ; sinon on y envoie celle de ce navigateur
      const settings = await cloudGetSettings(u.uid);
      if (settings.apiKey) setLocalApiKey(settings.apiKey);
      else if (getApiKey()) await cloudSaveSettings(u.uid, { apiKey: getApiKey() });
      lastSync.current = Date.now();
      setError("");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(`Synchronisation impossible : ${err instanceof Error ? err.message : err}`);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    onCloudError(setError);
    return watchUser((u) => {
      setCloudUser(u?.uid ?? null);
      setUser(u);
      setReady(true);
      if (u) sync(u);
    });
  }, [sync]);

  // Envoie les modifications en attente quand l'app passe en arrière-plan,
  // et récupère celles des autres appareils quand elle revient au premier plan.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPending();
      else if (user && Date.now() - lastSync.current > 30_000) sync(user);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushPending);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushPending);
    };
  }, [user, sync]);

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(`Connexion impossible : ${err instanceof Error ? err.message : err}`);
    }
  }, []);

  const signOut = useCallback(async () => {
    flushPending();
    await signOutUser();
  }, []);

  return (
    <Ctx.Provider value={{ enabled: cloudEnabled, user, ready, syncing, version, error, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
