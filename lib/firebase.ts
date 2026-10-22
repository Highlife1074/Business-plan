"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";
import type { Plan } from "./types";

// Stockage dans Firestore :
//   users/{uid}/plans/{planId}   un document par business plan
//   users/{uid}/settings/main    réglages (clé API Claude)

export const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function firebaseApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

function firestore(): Firestore {
  if (!db) db = initializeFirestore(firebaseApp(), { ignoreUndefinedProperties: true });
  return db;
}

export type { User };

export function watchUser(cb: (user: User | null) => void): () => void {
  if (!cloudEnabled) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(getAuth(firebaseApp()), cb);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(getAuth(firebaseApp()), new GoogleAuthProvider());
}

// Jeton d'accès Gmail (envoi + lecture), valable 1 heure, demandé via une fenêtre Google.
// À appeler depuis un clic (les navigateurs bloquent les fenêtres ouvertes sans geste).
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];
const TOKEN_KEY = "bp-sim:gmail-token";

export function cachedGmailToken(): string | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null") as { token: string; exp: number } | null;
    return t && t.exp > Date.now() ? t.token : null;
  } catch {
    return null;
  }
}

export function clearGmailToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function requestGmailToken(): Promise<string> {
  const auth = getAuth(firebaseApp());
  const provider = new GoogleAuthProvider();
  GMAIL_SCOPES.forEach((s) => provider.addScope(s));
  if (auth.currentUser?.email) provider.setCustomParameters({ login_hint: auth.currentUser.email });
  const result = auth.currentUser
    ? await reauthenticateWithPopup(auth.currentUser, provider)
    : await signInWithPopup(auth, provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error("Google n'a pas fourni l'accès à Gmail.");
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60 * 1000 }));
  } catch {}
  return token;
}

export async function signOutUser(): Promise<void> {
  clearGmailToken();
  await signOut(getAuth(firebaseApp()));
}

export async function cloudListPlans(uid: string): Promise<Plan[]> {
  const snap = await getDocs(collection(firestore(), "users", uid, "plans"));
  return snap.docs.map((d) => d.data() as Plan);
}

export async function cloudSavePlan(uid: string, plan: Plan): Promise<void> {
  await setDoc(doc(firestore(), "users", uid, "plans", plan.id), plan);
}

export async function cloudDeletePlan(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "users", uid, "plans", id));
}

export interface CloudSettings {
  apiKey?: string;
}

export async function cloudGetSettings(uid: string): Promise<CloudSettings> {
  const snap = await getDoc(doc(firestore(), "users", uid, "settings", "main"));
  return (snap.data() as CloudSettings | undefined) ?? {};
}

export async function cloudSaveSettings(uid: string, settings: CloudSettings): Promise<void> {
  await setDoc(doc(firestore(), "users", uid, "settings", "main"), settings, { merge: true });
}
