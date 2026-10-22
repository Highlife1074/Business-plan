"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/types";
import { deletePlan, listPlans, savePlan } from "@/lib/storage";
import { demoPlan } from "@/lib/demo";
import { uid } from "@/lib/uid";
import { readNdjson } from "@/lib/ndjson";

type GenEvent =
  | { type: "progress"; chars: number }
  | { type: "done"; plan: Plan }
  | { type: "error"; error: string };

const EXAMPLES = ["Lavage auto", "Pizzeria", "Boulangerie", "Salle de sport", "Food truck", "Coworking"];

export default function Home() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({ businessType: "", country: "", city: "", budget: "", details: "" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => setPlans(listPlans()), []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      let created: Plan | null = null;
      await readNdjson<GenEvent>(res, (ev) => {
        if (ev.type === "progress") setProgress(ev.chars);
        else if (ev.type === "error") throw new Error(ev.error);
        else if (ev.type === "done") created = ev.plan;
      });
      if (!created) throw new Error("Aucun plan reçu.");
      savePlan(created);
      router.push(`/plan/${(created as Plan).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function openDemo() {
    const plan = demoPlan(uid());
    savePlan(plan);
    router.push(`/plan/${plan.id}`);
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      try {
        const plan = JSON.parse(txt) as Plan;
        if (!plan.params || !plan.meta) throw new Error();
        plan.id = uid();
        plan.updatedAt = new Date().toISOString();
        savePlan(plan);
        router.push(`/plan/${plan.id}`);
      } catch {
        setError("Fichier invalide : exportez un plan depuis l'application.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Supprimer ce business plan ?")) return;
    deletePlan(id);
    setPlans(listPlans());
  }

  return (
    <main className="container">
      <div className="header">
        <div className="grow">
          <h1>Simulateur de business plan</h1>
          <p className="muted">
            Décrivez une activité et un pays : Claude construit les hypothèses, vous les ajustez et tout le plan se recalcule.
          </p>
        </div>
      </div>

      <form className="card" onSubmit={generate}>
        <h2>Nouveau business plan avec Claude</h2>
        <div className="grid grid-2">
          <label className="field">
            Type d&apos;activité *
            <input required value={form.businessType} onChange={set("businessType")} placeholder="ex. Pizzeria à emporter" list="examples" />
            <datalist id="examples">
              {EXAMPLES.map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>
          <label className="field">
            Pays *
            <input required value={form.country} onChange={set("country")} placeholder="ex. Pologne, France, Maroc…" />
          </label>
          <label className="field">
            Ville / région
            <input value={form.city} onChange={set("city")} placeholder="ex. Cracovie" />
          </label>
          <label className="field">
            Budget / apport envisagé
            <input value={form.budget} onChange={set("budget")} placeholder="ex. 150 000 € d'apport" />
          </label>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          Précisions (concept, taille, emplacement, contraintes…)
          <textarea value={form.details} onChange={set("details")} placeholder="ex. 40 couverts, four à bois, livraison via applis, local de 120 m² en centre-ville" />
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy}>
            {busy ? <><span className="spinner" /> Claude rédige le plan…</> : "Générer avec Claude"}
          </button>
          {busy && <span className="muted small">{progress > 0 ? `${Math.round(progress / 1000)} k caractères rédigés` : "Analyse du marché et des coûts locaux (1 à 3 min)…"}</span>}
        </div>
        {error && <p className="neg" style={{ marginTop: 8 }}>{error}</p>}
      </form>

      <div className="row no-print" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={openDemo}>Ouvrir l&apos;exemple : lavage auto en Pologne</button>
        <label className="btn">
          Importer un plan (.json)
          <input type="file" accept="application/json" onChange={importFile} hidden />
        </label>
      </div>

      <h2>Mes business plans</h2>
      {plans.length === 0 ? (
        <p className="muted">Aucun plan pour l&apos;instant.</p>
      ) : (
        <div className="plan-list">
          {plans.map((p) => (
            <div key={p.id} className="card plan-item">
              <strong>{p.meta.name}</strong>
              <span className="muted small">
                {p.meta.businessType} · {[p.meta.city, p.meta.country].filter(Boolean).join(", ")} · {p.meta.currency}
              </span>
              <span className="muted small">Modifié le {new Date(p.updatedAt).toLocaleDateString("fr-FR")}</span>
              <div className="row">
                <a className="btn sm primary" href={`/plan/${p.id}`}>Ouvrir</a>
                <button className="btn sm danger" onClick={() => remove(p.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
