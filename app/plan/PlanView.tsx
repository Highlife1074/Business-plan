"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Plan } from "@/lib/types";
import { getPlan, savePlan } from "@/lib/storage";
import { projectPlan } from "@/lib/finance";
import RecapTab from "@/components/RecapTab";
import SummaryTab from "@/components/SummaryTab";
import ParamsTab from "@/components/ParamsTab";
import IncomeTab from "@/components/IncomeTab";
import CashTab from "@/components/CashTab";
import BreakEvenTab from "@/components/BreakEvenTab";
import LegalTab from "@/components/LegalTab";
import SwotTab from "@/components/SwotTab";
import QuotesTab from "@/components/QuotesTab";
import AssistantTab from "@/components/AssistantTab";
import OutreachTab from "@/components/OutreachTab";
import type { TabProps } from "@/components/tab";
import { useCloud } from "@/components/CloudProvider";
import CurrencyProvider, { CurrencyBar, DisplayCurrency } from "@/components/CurrencyProvider";

const TABS = [
  { id: "recap", label: "Fiche récap", short: "Récap", C: RecapTab },
  { id: "summary", label: "Sommaire", short: "Sommaire", C: SummaryTab },
  { id: "params", label: "Paramètres", short: "Paramètres", C: ParamsTab },
  { id: "income", label: "Résultats d'exploitation", short: "Résultats", C: IncomeTab },
  { id: "cash", label: "Trésorerie", short: "Trésorerie", C: CashTab },
  { id: "breakeven", label: "Point mort", short: "Point mort", C: BreakEvenTab },
  { id: "legal", label: "Juridique", short: "Juridique", C: LegalTab },
  { id: "swot", label: "SWOT & risques", short: "SWOT", C: SwotTab },
  { id: "quotes", label: "Devis", short: "Devis", C: QuotesTab },
  { id: "outreach", label: "Démarches", short: "Démarches", C: OutreachTab },
  { id: "assistant", label: "Assistant Claude", short: "Assistant", C: AssistantTab },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PlanView({ id }: { id: string }) {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [tab, setTab] = useState<TabId>("recap");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const { version, syncing, ready } = useCloud();
  const tabsRef = useRef<HTMLElement>(null);

  // Garde l'onglet actif visible dans la barre d'onglets défilante (téléphone)
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(".tab.active");
    if (el && tabsRef.current) {
      tabsRef.current.scrollTo({ left: el.offsetLeft - (tabsRef.current.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [tab, plan?.id]);

  // Relit le plan après chaque synchronisation (modifications faites sur un autre appareil)
  useEffect(() => {
    setPlan(getPlan(id));
  }, [id, version]);

  useEffect(() => {
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

  if (plan === undefined || (plan === null && (syncing || !ready))) return <main className="container muted">Chargement…</main>;
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
    <CurrencyProvider plan={plan} update={update}>
    <main className="container">
      <div className="header plan-header">
        <div className="top">
          <Link className="btn sm no-print" href="/">← Mes plans</Link>
          <div className="actions no-print">
            <button className="btn sm" onClick={exportJson} title="Exporter le plan (.json)">Exporter</button>
            <button className="btn sm" onClick={() => window.print()} title="Imprimer ou enregistrer en PDF">PDF</button>
          </div>
        </div>
        <div className="grow">
          <h1 style={{ marginBottom: 2 }}>{plan.meta.name}</h1>
          <div className="muted small">
            {plan.meta.businessType} · {[plan.meta.city, plan.meta.country].filter(Boolean).join(", ")} · montants HT en <DisplayCurrency />
          </div>
        </div>
      </div>
      <nav className="tabs" ref={tabsRef}>
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${t.id === tab ? "active" : ""}`} onClick={() => go(t.id)}>
            <span className="tab-long">{t.label}</span>
            <span className="tab-short">{t.short}</span>
          </button>
        ))}
      </nav>
      <CurrencyBar />
      <Current {...props} />
    </main>
    </CurrencyProvider>
  );
}
