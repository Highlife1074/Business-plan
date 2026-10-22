"use client";

import { useEffect, useState } from "react";
import { getApiKey, setApiKey } from "@/lib/claude";

// Saisie de la clé API Claude, enregistrée uniquement dans ce navigateur.
export default function KeySettings() {
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const k = getApiKey();
    setSaved(k);
    setOpen(!k);
  }, []);

  const masked = saved ? `${saved.slice(0, 10)}…${saved.slice(-4)}` : "";

  function save() {
    setApiKey(draft);
    setSaved(draft.trim());
    setDraft("");
    setOpen(false);
  }

  function remove() {
    if (!confirm("Supprimer la clé de ce navigateur ?")) return;
    setApiKey("");
    setSaved("");
    setOpen(true);
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Réglages</h2>
        {saved && !open && (
          <div className="row">
            <span className="muted small">Clé Claude : {masked}</span>
            <button className="btn sm" onClick={() => setOpen(true)}>Changer</button>
            <button className="btn sm danger" onClick={remove}>Supprimer</button>
          </div>
        )}
      </div>
      {open && (
        <>
          <p className="muted small" style={{ marginTop: 8 }}>
            Pour utiliser Claude, collez votre clé API (créée sur console.anthropic.com, rubrique API Keys).
            Elle est enregistrée uniquement dans ce navigateur, jamais sur GitHub.
          </p>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn primary" disabled={!draft.trim().startsWith("sk-")} onClick={save}>
              Enregistrer
            </button>
            {saved && <button className="btn" onClick={() => setOpen(false)}>Annuler</button>}
          </div>
        </>
      )}
    </div>
  );
}
