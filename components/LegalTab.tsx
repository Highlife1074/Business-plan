"use client";

import type { TabProps } from "./tab";
import type { LegalItem } from "@/lib/types";
import { uid } from "@/lib/uid";

export default function LegalTab({ plan, update, askClaude }: TabProps) {
  const items = plan.texts.legal;
  const setItems = (legal: LegalItem[]) => update((p) => ({ ...p, texts: { ...p.texts, legal } }));
  const place = [plan.meta.city, plan.meta.country].filter(Boolean).join(", ");

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Cadre juridique, fiscal et réglementaire</h2>
          <div className="row no-print">
            <button className="btn sm" onClick={() => askClaude(`Quelle forme juridique me conseilles-tu pour ce projet (${plan.meta.businessType}, ${place}) ? Compare les options locales : responsabilité, fiscalité, charges sociales du dirigeant, coût et délais de création.`)}>
              Comparer les statuts
            </button>
            <button className="btn sm" onClick={() => askClaude(`Établis la check-list complète des démarches, licences, autorisations et normes à respecter pour ouvrir ce projet (${plan.meta.businessType}) à ${place}, dans l'ordre chronologique, avec les organismes concernés et les délais habituels.`)}>
              Check-list des démarches
            </button>
          </div>
        </div>
        <p className="muted small">
          Informations indicatives à faire valider par un avocat ou un expert-comptable local.
        </p>
      </div>
      {items.map((it) => (
        <div className="card" key={it.id}>
          <div className="row" style={{ flexWrap: "nowrap", marginBottom: 8 }}>
            <input
              style={{ fontWeight: 600 }}
              value={it.title}
              onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
            />
            <button className="btn sm no-print" onClick={() => askClaude(`Détaille le point juridique « ${it.title} » pour mon projet à ${place} : obligations précises, coûts, délais et pièges à éviter.`)}>
              Approfondir
            </button>
            <button className="btn sm no-print" title="Supprimer" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>✕</button>
          </div>
          <textarea
            rows={4}
            value={it.content}
            onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, content: e.target.value } : x)))}
          />
        </div>
      ))}
      <button className="btn no-print" onClick={() => setItems([...items, { id: uid(), title: "Nouveau point", content: "" }])}>
        + Ajouter un point juridique
      </button>
    </>
  );
}
