"use client";

import { useEffect } from "react";

// Après une mise à jour de l'app, une page ouverte avant la publication peut réclamer des fichiers
// qui n'existent plus : on recharge alors automatiquement (une fois) pour obtenir la nouvelle version.
function isStaleBuild(error: Error): boolean {
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(
    `${error.name} ${error.message}`,
  );
}

export default function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleBuild(error);

  useEffect(() => {
    console.error(error);
    if (!stale) return;
    try {
      if (sessionStorage.getItem("bp-sim:reloaded") === location.href) return;
      sessionStorage.setItem("bp-sim:reloaded", location.href);
    } catch {}
    location.reload();
  }, [error, stale]);

  return (
    <main className="container">
      <div className="card">
        <h2>{stale ? "Mise à jour de l'application…" : "Une erreur est survenue"}</h2>
        {!stale && (
          <>
            <p className="muted small">Vos plans enregistrés ne sont pas perdus. Envoyez ce message pour le diagnostic :</p>
            <pre className="small" style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 8, borderRadius: 6 }}>
              {error.name}: {error.message}
              {error.stack ? `\n${error.stack.split("\n").slice(1, 4).join("\n")}` : ""}
            </pre>
          </>
        )}
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Recharger</button>
          <button className="btn" onClick={reset}>Réessayer</button>
          <a className="btn" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}>Accueil</a>
        </div>
      </div>
    </main>
  );
}
