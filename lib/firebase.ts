"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
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

export async function signOutUser(): Promise<void> {
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
