"use client";

import EditTable from "./EditTable";
import { AutoText, Num } from "./ui";
import { MoneyNum, useMoney } from "./CurrencyProvider";
import type { TabProps } from "./tab";
import type { Quote, QuoteNeed, QuoteStatus } from "@/lib/types";
import { uid } from "@/lib/uid";

const STATUSES: QuoteStatus[] = ["à demander", "reçu", "retenu", "refusé"];

export default function QuotesTab({ plan, update, askClaude }: TabProps) {
  const cur = plan.meta.currency;
  const money_ = useMoney();
  const m = (v: number) => money_.fmt(v);
  const mt = m;
  const quotes = plan.quotes;
  const setQuotes = (q: Quote[]) => update((p) => ({ ...p, quotes: q }));
  const setQuote = (id: string, patch: Partial<Quote>) => setQuotes(quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const { investments, fixedCosts } = plan.params;

  const addQuote = (need?: QuoteNeed) =>
    setQuotes([
      ...quotes,
      {
        id: uid(),
        supplier: "",
        label: need?.item ?? "",
        amount: need?.estimatedAmount ?? 0,
        kind: "investissement",
        linkedId: null,
        status: "reçu",
        date: new Date().toISOString().slice(0, 10),
        validUntil: "",
        contact: "",
        notes: "",
      },
    ]);

  // Comparatif : pour chaque ligne du plan liée à au moins un devis
  const lines = [
    ...investments.map((i) => ({ id: i.id, label: i.label, base: i.amount, kind: "Investissement" })),
    ...fixedCosts.map((c) => ({ id: c.id, label: c.label, base: c.monthly, kind: "Charge / mois" })),
  ]
    .map((l) => {
      const linked = quotes.filter((q) => q.linkedId === l.id && q.status !== "refusé" && q.status !== "à demander");
      const retained = quotes.filter((q) => q.linkedId === l.id && q.status === "retenu");
      return {
        ...l,
        count: linked.length,
        best: linked.length ? Math.min(...linked.map((q) => q.amount)) : null,
        retained: retained.length ? retained.reduce((a, q) => a + q.amount, 0) : null,
      };
    })
    .filter((l) => l.count > 0);

  const totalRetained = quotes.filter((q) => q.status === "retenu" && q.kind === "investissement").reduce((a, q) => a + q.amount, 0);

  return (
    <>
      <div className="card">
        <h2>Devis et offres</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Enregistrez ici toutes les offres reçues. Un devis au statut <span className="badge retenu">retenu</span> lié à une ligne
          du plan remplace automatiquement son montant (investissement ou charge mensuelle) dans tous les calculs.
        </p>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Devis à obtenir</h2>
          <button className="btn sm no-print" onClick={() => askClaude("Quels types de fournisseurs dois-je consulter pour chaque devis à obtenir, quelles questions leur poser et quels points comparer entre les offres ?")}>
            Conseils de consultation
          </button>
        </div>
        <EditTable<QuoteNeed>
          rows={plan.quoteNeeds}
          onChange={(quoteNeeds) => update((p) => ({ ...p, quoteNeeds }))}
          blank={{ item: "Nouveau devis", category: "", estimatedAmount: 0, done: false }}
          columns={[
            { key: "item", label: "Objet", type: "text" },
            { key: "category", label: "Catégorie", type: "text", width: 120 },
            { key: "estimatedAmount", label: `Estimation (${money_.display})`, type: "money" },
          ]}
          rowExtra={(r) => (
            <>
              <label className="row small" style={{ gap: 4, flexWrap: "nowrap" }} title="Devis obtenu">
                <input type="checkbox" style={{ width: "auto" }} checked={r.done} onChange={(e) => update((p) => ({ ...p, quoteNeeds: p.quoteNeeds.map((n) => (n.id === r.id ? { ...n, done: e.target.checked } : n)) }))} />
                obtenu
              </label>
              <button className="btn sm no-print" onClick={() => addQuote(r)} title="Créer un devis à partir de cette ligne">+ devis</button>
            </>
          )}
        />
      </div>

      {lines.length > 0 && (
        <div className="card">
          <h2>Comparatif</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ligne du plan</th><th>Type</th><th>Estimation initiale</th><th>Devis reçus</th><th>Meilleure offre</th><th>Retenu</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.label}</td>
                    <td>{l.kind}</td>
                    <td>{m(l.base)}</td>
                    <td>{l.count}</td>
                    <td className={l.best !== null && l.best < l.base ? "pos" : "neg"}>{l.best === null ? "—" : m(l.best)}</td>
                    <td>{l.retained === null ? "—" : m(l.retained)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>Total des investissements retenus sur devis : {mt(totalRetained)}</p>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Offres enregistrées ({quotes.length})</h2>
        <button className="btn primary no-print" onClick={() => addQuote()}>+ Nouveau devis</button>
      </div>
      {quotes.map((q) => {
        const targets = q.kind === "investissement" ? investments.map((i) => ({ id: i.id, label: i.label })) : fixedCosts.map((c) => ({ id: c.id, label: c.label }));
        return (
          <div className="card" key={q.id}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <strong>{q.supplier || "Fournisseur"} — {q.label || "objet"}</strong>
              <div className="row">
                <span className={`badge ${q.status}`}>{q.status}</span>
                <button className="btn sm danger no-print" onClick={() => confirm("Supprimer ce devis ?") && setQuotes(quotes.filter((x) => x.id !== q.id))}>Supprimer</button>
              </div>
            </div>
            <div className="grid grid-kpi">
              <label className="field">Fournisseur<AutoText singleLine value={q.supplier} onChange={(v) => setQuote(q.id, { supplier: v })} /></label>
              <label className="field">Objet<AutoText singleLine value={q.label} onChange={(v) => setQuote(q.id, { label: v })} /></label>
              <label className="field">
                Type
                <select value={q.kind} onChange={(e) => setQuote(q.id, { kind: e.target.value as Quote["kind"], linkedId: null })}>
                  <option value="investissement">Investissement</option>
                  <option value="charge mensuelle">Charge mensuelle</option>
                </select>
              </label>
              <label className="field">Montant HT{q.kind === "charge mensuelle" ? " / mois" : ""} ({money_.display})<MoneyNum value={q.amount} onChange={(v) => setQuote(q.id, { amount: v })} /></label>
              <label className="field">
                Ligne du plan alimentée
                <select value={q.linkedId ?? ""} onChange={(e) => setQuote(q.id, { linkedId: e.target.value || null })}>
                  <option value="">— aucune —</option>
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="field">
                Statut
                <select value={q.status} onChange={(e) => setQuote(q.id, { status: e.target.value as QuoteStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">Date<input type="date" value={q.date} onChange={(e) => setQuote(q.id, { date: e.target.value })} /></label>
              <label className="field">Valable jusqu&apos;au<input type="date" value={q.validUntil} onChange={(e) => setQuote(q.id, { validUntil: e.target.value })} /></label>
              <label className="field">Contact<AutoText singleLine value={q.contact} onChange={(v) => setQuote(q.id, { contact: v })} placeholder="nom, e-mail, téléphone" /></label>
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              Notes (conditions, délais, garanties, options…)
              <AutoText minRows={2} value={q.notes} onChange={(v) => setQuote(q.id, { notes: v })} />
            </label>
          </div>
        );
      })}
    </>
  );
}
