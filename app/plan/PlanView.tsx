"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Plan } from "@/lib/types";
import { getPlan, savePlan } from "@/lib/storage";
import { projectPlan } from "@/lib/finance";
import SummaryTab from "@/components/SummaryTab";
import ParamsTab from "@/components/ParamsTab";
import IncomeTab from "@/components/IncomeTab";
import CashTab from "@/components/CashTab";
import BreakEvenTab from "@/components/BreakEvenTab";
import LegalTab from "@/components/LegalTab";
import SwotTab from "@/components/SwotTab";
import QuotesTab from "@/components/QuotesTab";
import AssistantTab from "@/components/AssistantTab";
import type { TabProps } from "@/components/tab";

const TABS = [
  { id: "summary", label: "Sommaire", C: SummaryTab },
  { id: "params", label: "Paramètres", C: ParamsTab },
  { id: "income", label: "Résultats d'exploitation", C: IncomeTab },
  { id: "cash", label: "Trésorerie", C: CashTab },
  { id: "breakeven", label: "Point mort", C: BreakEvenTab },
  { id: "legal", label: "Juridique", C: LegalTab },
  { id: "swot", label: "SWOT & risques", C: SwotTab },
  { id: "quotes", label: "Devis", C: QuotesTab },
  { id: "assistant", label: "Assistant Claude", C: AssistantTab },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PlanView({ id }: { id: string }) {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [tab, setTab] = useState<TabId>("summary");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    setPlan(getPlan(id));
    try {
      const saved = sessionStorage.getItem(`bp-sim:tab:${id}`) as TabId | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {}
  }, [id]);

  const update = useCallback((fn: (p: Plan) => Plan) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = { ...fn(prev), updatedAt: new Date().toISOString() };
      savePlan(next);
      return next;
    });
  }, []);

  const proj = useMemo(() => (plan ? projectPlan(plan) : null), [plan]);

  const go = (t: TabId) => {
    setTab(t);
    try {
      sessionStorage.setItem(`bp-sim:tab:${id}`, t);
    } catch {}
  };

  const askClaude = useCallback((question: string) => {
    setPendingQuestion(question);
    go("assistant");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (plan === undefined) return <main className="container muted">Chargement…</main>;
  if (plan === null || !proj)
    return (
      <main className="container">
        <p>Business plan introuvable dans ce navigateur.</p>
        <Link className="btn" href="/">← Retour</Link>
      </main>
    );

  function exportJson() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${plan!.meta.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const props: TabProps = {
    plan,
    proj,
    update,
    askClaude,
    pendingQuestion,
    clearPendingQuestion: () => setPendingQuestion(null),
  };
  const Current = TABS.find((t) => t.id === tab)!.C;

  return (
    <main className="container">
      <div className="header">
        <Link className="btn sm no-print" href="/">← Mes plans</Link>
        <div className="grow">
          <h1 style={{ marginBottom: 2 }}>{plan.meta.name}</h1>
          <div className="muted small">
            {plan.meta.businessType} · {[plan.meta.city, plan.meta.country].filter(Boolean).join(", ")} · montants HT en {plan.meta.currency}
          </div>
        </div>
        <div className="row no-print">
          <button className="btn sm" onClick={exportJson}>Exporter (.json)</button>
          <button className="btn sm" onClick={() => window.print()}>Imprimer / PDF</button>
        </div>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${t.id === tab ? "active" : ""}`} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <Current {...props} />
    </main>
  );
}
