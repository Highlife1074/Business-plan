"use client";

import { useEffect, useState } from "react";
import { getApiKey, setApiKey } from "@/lib/claude";
import { useCloud } from "./CloudProvider";
import { clearDiagnostics, readDiagnostics } from "@/lib/effect-guard";

// Réglages : compte Google (synchronisation entre appareils) et clé API Claude.
export default function KeySettings() {
  const cloud = useCloud();
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<string[]>([]);

  useEffect(() => {
    setDiag(readDiagnostics());
  }, []);

  useEffect(() => {
    const k = getApiKey();
    setSaved(k);
    setOpen(!k);
  }, [cloud.version, cloud.user]);

  const masked = saved ? `${saved.slice(0, 10)}…${saved.slice(-4)}` : "";

  function save() {
    setApiKey(draft).catch((err) => alert(`Clé enregistrée sur cet appareil, mais pas en ligne : ${err}`));
    setSaved(draft.trim());
    setDraft("");
    setOpen(false);
  }

  function remove() {
    if (!confirm("Supprimer la clé de ce navigateur ?")) return;
    setApiKey("").catch(() => {});
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
      {cloud.enabled && (
        <div className="row" style={{ marginTop: 10 }}>
          {!cloud.ready ? (
            <span className="muted small">Connexion…</span>
          ) : cloud.user ? (
            <>
              <span className="small">
                Connecté : <strong>{cloud.user.email}</strong>{" "}
                <span className="muted">{cloud.syncing ? "· synchronisation…" : "· plans et clé synchronisés"}</span>
              </span>
              <button className="btn sm" onClick={cloud.signOut}>Se déconnecter</button>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={cloud.signIn}>Se connecter avec Google</button>
              <span className="muted small">pour retrouver vos plans et votre clé sur tous vos appareils</span>
            </>
          )}
        </div>
      )}
      {cloud.error && <p className="neg small" style={{ marginTop: 8 }}>{cloud.error}</p>}
      {diag.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="warn small">Diagnostic technique disponible (à transmettre)</summary>
          <pre className="small" style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 8, borderRadius: 6 }}>{diag.join("\n\n")}</pre>
          <button className="btn sm" onClick={() => { clearDiagnostics(); setDiag([]); }}>Effacer</button>
        </details>
      )}
      {open && (
        <>
          <p className="muted small" style={{ marginTop: 8 }}>
            Pour utiliser Claude, collez votre clé API (créée sur console.anthropic.com, rubrique API Keys).
            Elle est enregistrée dans ce navigateur{cloud.user ? " et dans votre espace privé en ligne" : ""}, jamais sur GitHub.
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
