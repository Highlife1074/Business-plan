"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PlanView from "./PlanView";

// Page statique /plan?id=… (compatible GitHub Pages, sans route dynamique côté serveur)
function PlanFromQuery() {
  const id = useSearchParams().get("id") ?? "";
  return <PlanView key={id} id={id} />;
}

export default function PlanPage() {
  return (
    <Suspense fallback={<main className="container muted">Chargement…</main>}>
      <PlanFromQuery />
    </Suspense>
  );
}
