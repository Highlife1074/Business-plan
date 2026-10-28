"use client";

import { useState } from "react";
import { AutoText } from "./ui";
import { useMoney } from "./CurrencyProvider";
import { newOutreach } from "./OutreachTab";
import type { TabProps } from "./tab";
import type { Outreach, OutreachMessage } from "@/lib/types";
import { CHANNELS, channelOf, followUpDue, logEvent, removeEvent, summarize, type Channel } from "@/lib/outreach";
import { uid } from "@/lib/uid";

type EventType = "demande" | "relance" | "réponse" | "refus";
type Filter = "toutes" | "attente" | "relance" | "retour" | "closes";

const EVENT_LABELS: Record<EventType, string> = {
  demande: "Demande de prix envoyée",
  relance: "Relance",
  réponse: "Retour du fournisseur (offre, question…)",
  refus: "Retour négatif (ne donne pas suite)",
};
const FILTERS: Record<Filter, string> = {
  toutes: "Toutes",
  attente: "En attente de retour",
  relance: "Relance à faire",
  retour: "Retour reçu",
  closes: "Closes / devis enregistré",
};

const today = () => new Date().toISOString().slice(0, 10);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");
const kindLabel = (m: OutreachMessage) => (m.direction === "reçu" ? "Retour" : m.kind === "relance" ? "Relance" : "Demande de prix");

export default function ConsultationsTab({ plan, update }: TabProps) {
  const { fmt, ct } = useMoney();
  const [filter, setFilter] = useState<Filter>("toutes");
  const [form, setForm] = useState({ supplierId: "", needId: plan.quoteNeeds[0]?.id ?? "", newName: "", type: "demande" as EventType, date: today(), channel: "e-mail" as Channel, note: "" });

  const supplierOf = (o: Outreach) => plan.suppliers.find((s) => s.id === o.supplierId);
  const needOf = (o: Outreach) => plan.quoteNeeds.find((n) => n.id === supplierOf(o)?.needId);

  const rows = plan.outreach
    .filter((o) => o.messages.length > 0)
    .map((o) => {
      const sum = summarize(o, plan.sender);
      const due = followUpDue(o, plan.sender);
      const quote = plan.quotes.find((q) => q.id === o.quoteId);
      const offer = quote ? quote.amount : o.analysis?.hasQuote ? o.analysis.amount : null;
      return { o, sum, due, offer, supplier: supplierOf(o), need: needOf(o) };
    })
    .sort((a, b) => (b.sum.requestedAt ?? "").localeCompare(a.sum.requestedAt ?? ""));

  const visible = rows.filter(({ o, due }) => {
    if (filter === "attente") return o.status === "envoyé" || o.status === "relancé";
    if (filter === "relance") return due;
    if (filter === "retour") return o.status === "réponse reçue";
    if (filter === "closes") return o.status === "clos" || o.status === "devis enregistré";
    return true;
  });

  const answered = rows.filter((r) => r.sum.firstReplyAt);
  const delays = answered.map((r) => r.sum.replyDelayDays!).filter((d) => d !== null);
  const kpis = {
    demandes: rows.length,
    attente: rows.filter((r) => r.o.status === "envoyé" || r.o.status === "relancé").length,
    relances: rows.reduce((a, r) => a + r.sum.followUpDates.length, 0),
    retours: answered.length,
    delai: delays.length ? Math.round(delays.reduce((a, d) => a + d, 0) / delays.length) : null,
    aRelancer: rows.filter((r) => r.due).length,
  };

  const events = plan.outreach
    .flatMap((o) => o.messages.map((m) => ({ m, o })))
    .sort((a, b) => new Date(b.m.date).getTime() - new Date(a.m.date).getTime());

  const setOutreach = (id: string, fn: (o: Outreach) => Outreach) =>
    update((p) => ({ ...p, outreach: p.outreach.map((o) => (o.id === id ? fn(o) : o)) }));

  const creating = form.supplierId === "new";
  const canLog = creating ? form.newName.trim() !== "" && form.needId !== "" : form.supplierId !== "";

  function log() {
    if (!canLog) return;
    const event = {
      kind: form.type === "refus" ? ("réponse" as const) : form.type,
      declined: form.type === "refus",
      date: new Date(`${form.date || today()}T12:00:00`).toISOString(),
      channel: form.channel,
      note: form.note.trim(),
    };
    update((p) => {
      let suppliers = p.suppliers;
      let supplier = suppliers.find((s) => s.id === form.supplierId);
      if (creating) {
        supplier = { id: uid(), needId: form.needId, name: form.newName.trim(), email: "", website: "", phone: "", city: "", notes: "", source: "manuel" };
        suppliers = [...suppliers, supplier];
      }
      if (!supplier) return p;
      const existing = p.outreach.find((o) => o.supplierId === supplier.id);
      const updated = logEvent(existing ?? newOutreach(supplier), event, uid());
      return {
        ...p,
        suppliers,
        outreach: existing ? p.outreach.map((o) => (o.id === existing.id ? updated : o)) : [...p.outreach, updated],
      };
    });
    setForm((f) => ({ ...f, supplierId: creating ? "" : f.supplierId, newName: "", note: "", date: today() }));
  }

  function statusOf(o: Outreach, due: boolean) {
    if (due) return { label: "relance à faire", cls: "refusé" };
    if (o.status === "envoyé" || o.status === "relancé") return { label: o.status === "relancé" ? "relancé, en attente" : "en attente", cls: "reçu" };
    if (o.status === "réponse reçue" || o.status === "devis enregistré") return { label: o.status, cls: "retenu" };
    return { label: o.status, cls: "" };
  }

  return (
    <>
      <div className="card">
        <h2>Suivi des consultations</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Chronologie de vos demandes de prix : date d&apos;envoi, relances, retours des fournisseurs et délais de réponse.
          Les e-mails envoyés et reçus via Gmail (onglet Démarches) apparaissent automatiquement ; notez ici les échanges faits
          par téléphone, en rendez-vous ou depuis une autre messagerie.
        </p>
        <div className="grid grid-kpi">
          <div className="kpi"><div className="label">Consultations lancées</div><div className="value">{kpis.demandes}</div></div>
          <div className="kpi"><div className="label">En attente de retour</div><div className="value">{kpis.attente}</div></div>
          <div className="kpi"><div className="label">Relances envoyées</div><div className="value">{kpis.relances}</div></div>
          <div className="kpi">
            <div className="label">Retours reçus</div>
            <div className="value">{kpis.retours}</div>
            {kpis.demandes > 0 && <div className="hint">{Math.round((kpis.retours / kpis.demandes) * 100)} % de réponse</div>}
          </div>
          <div className="kpi"><div className="label">Délai moyen de retour</div><div className="value">{kpis.delai === null ? "—" : `${kpis.delai} j`}</div></div>
          <div className="kpi"><div className="label">Relances à faire</div><div className={`value ${kpis.aRelancer ? "warn" : ""}`}>{kpis.aRelancer}</div></div>
        </div>
      </div>

      <div className="card no-print">
        <h2>Noter un échange</h2>
        <div className="grid grid-kpi">
          <label className="field">
            Fournisseur
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">— choisir —</option>
              {plan.quoteNeeds.map((n) => {
                const list = plan.suppliers.filter((s) => s.needId === n.id);
                return list.length ? (
                  <optgroup key={n.id} label={n.item}>
                    {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ) : null;
              })}
              {plan.quoteNeeds.length > 0 && <option value="new">+ Nouveau fournisseur…</option>}
            </select>
          </label>
          {creating && (
            <>
              <label className="field">Nom du fournisseur<input value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} /></label>
              <label className="field">
                Devis concerné
                <select value={form.needId} onChange={(e) => setForm({ ...form, needId: e.target.value })}>
                  {plan.quoteNeeds.map((n) => <option key={n.id} value={n.id}>{n.item}</option>)}
                </select>
              </label>
            </>
          )}
          <label className="field">
            Type d&apos;échange
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EventType })}>
              {(Object.keys(EVENT_LABELS) as EventType[]).map((k) => <option key={k} value={k}>{EVENT_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="field">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="field">
            Canal
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="field" style={{ marginTop: 8 }}>
          Note (interlocuteur, prix annoncé, délai promis…)
          <AutoText minRows={2} value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
        </label>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={!canLog} onClick={log}>Enregistrer l&apos;échange</button>
          {plan.quoteNeeds.length === 0 && <span className="muted small">Ajoutez d&apos;abord des « devis à obtenir » dans l&apos;onglet Devis.</span>}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Tableau de suivi</h2>
          <select className="no-print" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {(Object.keys(FILTERS) as Filter[]).map((k) => <option key={k} value={k}>{FILTERS[k]}</option>)}
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="muted small" style={{ marginTop: 8 }}>{rows.length ? "Aucune consultation pour ce filtre." : "Aucune demande de prix envoyée pour l'instant."}</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr><th>Objet</th><th>Fournisseur</th><th>Demande envoyée</th><th>Relances</th><th>Retour</th><th>Délai</th><th>Statut</th><th>Prochaine relance</th><th>Offre HT</th></tr>
              </thead>
              <tbody>
                {visible.map(({ o, sum, due, offer, supplier, need }) => {
                  const st = statusOf(o, due);
                  return (
                    <tr key={o.id}>
                      <td>{need?.item ?? "—"}</td>
                      <td>{supplier?.name ?? "—"}</td>
                      <td>{day(sum.requestedAt)}</td>
                      <td>{sum.followUpDates.length ? `${sum.followUpDates.length} (${sum.followUpDates.map(day).join(", ")})` : "—"}</td>
                      <td>{day(sum.lastReplyAt)}</td>
                      <td>{sum.replyDelayDays === null ? "—" : `${sum.replyDelayDays} j`}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className={due ? "warn" : ""}>{sum.nextFollowUpAt ? day(sum.nextFollowUpAt) : "—"}</td>
                      <td>{offer === null ? "—" : fmt(offer)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Chronologie des échanges ({events.length})</h2>
        {events.length === 0 && <p className="muted small" style={{ margin: 0 }}>Aucun échange enregistré.</p>}
        {events.map(({ m, o }) => (
          <div key={`${o.id}-${m.id}`} className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", borderTop: "1px solid var(--border)", padding: "8px 0", flexWrap: "nowrap" }}>
            <div style={{ minWidth: 0 }}>
              <div className="small">
                <strong>{new Date(m.date).toLocaleDateString("fr-FR")}</strong> ·{" "}
                <span className={`badge ${m.direction === "reçu" ? "retenu" : m.kind === "relance" ? "refusé" : "reçu"}`}>{kindLabel(m)}</span>{" "}
                {supplierOf(o)?.name ?? "?"} <span className="muted">— {needOf(o)?.item ?? ""} · {channelOf(m)}</span>
              </div>
              {(m.subject || m.body) && (
                <div className="muted small" style={{ overflowWrap: "anywhere" }}>
                  {m.subject && <>{m.subject} — </>}
                  {ct(m.body.length > 220 ? `${m.body.slice(0, 220)}…` : m.body)}
                </div>
              )}
            </div>
            {!m.gmailId && (
              <button className="btn sm no-print" title="Supprimer cet échange" onClick={() => confirm("Supprimer cet échange ?") && setOutreach(o.id, (x) => removeEvent(x, m.id))}>✕</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
