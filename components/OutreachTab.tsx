"use client";

import { useEffect, useState } from "react";
import { AutoText, Num } from "./ui";
import { useMoney } from "./CurrencyProvider";
import type { TabProps } from "./tab";
import type { Outreach, OutreachMessage, Plan, QuoteNeed, Sender, Supplier } from "@/lib/types";
import { analyzeReply, draftEmail, findSuppliers } from "@/lib/agent";
import { getMessageIdHeader, getThread, sendEmail } from "@/lib/gmail";
import { cachedGmailToken } from "@/lib/firebase";
import { daysSince, followUpDue, newReplies } from "@/lib/outreach";
import { uid } from "@/lib/uid";

const BLANK_SUPPLIER = { name: "", email: "", website: "", phone: "", city: "", notes: "" };

export function newOutreach(supplier: Supplier): Outreach {
  return {
    id: uid(),
    supplierId: supplier.id,
    status: "brouillon",
    to: supplier.email,
    subject: "",
    draft: "",
    draftKind: "demande",
    threadId: null,
    lastSentAt: null,
    followUps: 0,
    messages: [],
    analysis: null,
    quoteId: null,
  };
}

export default function OutreachTab({ plan, update }: TabProps) {
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_SUPPLIER);
  const { fmt } = useMoney();

  const setOutreach = (id: string, fn: (o: Outreach) => Outreach) =>
    update((p) => ({ ...p, outreach: p.outreach.map((o) => (o.id === id ? fn(o) : o)) }));
  const setSender = (patch: Partial<Sender>) => update((p) => ({ ...p, sender: { ...p.sender, ...patch } }));

  async function run(key: string, label: string, fn: () => Promise<void>) {
    setBusy((b) => ({ ...b, [key]: label }));
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy((b) => {
        const { [key]: _, ...rest } = b;
        return rest;
      });
    }
  }

  // --- Fournisseurs ---

  const search = (need: QuoteNeed) =>
    run(`search-${need.id}`, "Claude cherche des fournisseurs…", async () => {
      const found = await findSuppliers(plan, need);
      update((p) => {
        const existing = new Set(p.suppliers.filter((s) => s.needId === need.id).map((s) => s.name.toLowerCase()));
        const added = found
          .filter((f) => !existing.has(f.name.toLowerCase()))
          .map((f) => ({ ...f, id: uid(), needId: need.id, source: "claude" as const }));
        return { ...p, suppliers: [...p.suppliers, ...added] };
      });
      setInfo(`${found.length} fournisseur(s) proposé(s) pour « ${need.item} ».`);
    });

  function addManual(needId: string) {
    if (!form.name.trim()) return;
    update((p) => ({ ...p, suppliers: [...p.suppliers, { ...form, id: uid(), needId, source: "manuel" }] }));
    setForm(BLANK_SUPPLIER);
    setAdding(null);
  }

  function removeSupplier(s: Supplier) {
    if (!confirm(`Retirer ${s.name} ?`)) return;
    update((p) => ({
      ...p,
      suppliers: p.suppliers.filter((x) => x.id !== s.id),
      outreach: p.outreach.filter((o) => o.supplierId !== s.id),
    }));
  }

  const setSupplier = (id: string, patch: Partial<Supplier>) =>
    update((p) => ({ ...p, suppliers: p.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  // --- E-mails ---

  const prepare = (need: QuoteNeed, supplier: Supplier, existing: Outreach | null, kind: "demande" | "relance") =>
    run(`draft-${supplier.id}`, kind === "demande" ? "Claude rédige l'e-mail…" : "Claude rédige la relance…", async () => {
      const email = await draftEmail(plan, need, supplier, existing, kind);
      if (existing) {
        setOutreach(existing.id, (o) => ({ ...o, subject: email.subject, draft: email.body, draftKind: kind, to: o.to || supplier.email }));
      } else {
        const o = { ...newOutreach(supplier), subject: email.subject, draft: email.body };
        update((p) => ({ ...p, outreach: [...p.outreach, o] }));
      }
    });

  const send = (o: Outreach, supplier: Supplier) => {
    if (!o.to.includes("@")) return setError("Adresse e-mail du destinataire manquante.");
    if (!o.draft.trim()) return setError("Le message est vide.");
    if (!confirm(`Envoyer cet e-mail depuis votre Gmail à ${supplier.name} (${o.to}) ?`)) return;
    return run(`send-${o.id}`, "Envoi via Gmail…", async () => {
      const lastSent = [...o.messages].reverse().find((m) => m.direction === "envoyé" && m.gmailId);
      const inReplyTo = o.threadId && lastSent?.gmailId ? await getMessageIdHeader(lastSent.gmailId) : undefined;
      const res = await sendEmail({ to: o.to, subject: o.subject, body: o.draft, threadId: o.threadId, inReplyTo });
      const now = new Date().toISOString();
      const msg: OutreachMessage = {
        id: `out-${res.id}`,
        direction: "envoyé",
        kind: o.draftKind,
        from: plan.sender.email || "moi",
        subject: o.subject,
        body: o.draft,
        date: now,
        gmailId: res.id,
      };
      setOutreach(o.id, (x) => ({
        ...x,
        threadId: res.threadId,
        lastSentAt: now,
        status: x.draftKind === "relance" ? "relancé" : "envoyé",
        followUps: x.draftKind === "relance" ? x.followUps + 1 : x.followUps,
        messages: [...x.messages, msg],
        draft: "",
      }));
      setInfo(`E-mail envoyé à ${supplier.name}.`);
    });
  };

  // --- Réponses ---

  const checkReplies = () =>
    run("check", "Vérification des réponses Gmail…", async () => {
      const active = plan.outreach.filter((o) => o.threadId && o.status !== "clos");
      let found = 0;
      for (const o of active) {
        const replies = newReplies(o, await getThread(o.threadId!));
        if (replies.length === 0) continue;
        found += replies.length;
        setOutreach(o.id, (x) => ({
          ...x,
          messages: [...x.messages, ...replies],
          status: x.status === "devis enregistré" ? x.status : "réponse reçue",
          analysis: null,
        }));
        // Analyse automatique de la dernière réponse
        const supplier = plan.suppliers.find((s) => s.id === o.supplierId);
        const need = plan.quoteNeeds.find((n) => n.id === supplier?.needId);
        if (supplier && need) {
          const analysis = await analyzeReply(plan, need, supplier, replies[replies.length - 1].body);
          setOutreach(o.id, (x) => ({ ...x, analysis }));
        }
      }
      setInfo(found ? `${found} nouvelle(s) réponse(s) reçue(s).` : "Aucune nouvelle réponse.");
    });

  // Vérification automatique à l'ouverture si l'accès Gmail est encore valide
  useEffect(() => {
    if (cachedGmailToken() && plan.outreach.some((o) => o.threadId && (o.status === "envoyé" || o.status === "relancé"))) {
      checkReplies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = (o: Outreach, need: QuoteNeed, supplier: Supplier) =>
    run(`analyze-${o.id}`, "Claude analyse la réponse…", async () => {
      const last = [...o.messages].reverse().find((m) => m.direction === "reçu");
      if (!last) throw new Error("Aucune réponse à analyser.");
      const analysis = await analyzeReply(plan, need, supplier, last.body);
      setOutreach(o.id, (x) => ({ ...x, analysis }));
    });

  function saveQuote(o: Outreach, need: QuoteNeed, supplier: Supplier) {
    const a = o.analysis!;
    const quoteId = uid();
    update((p) => ({
      ...p,
      quotes: [
        ...p.quotes,
        {
          id: quoteId,
          supplier: supplier.name,
          label: need.item,
          amount: a.amount,
          kind: a.kind,
          linkedId: a.linkedId,
          status: "reçu",
          date: new Date().toISOString().slice(0, 10),
          validUntil: "",
          contact: [o.to, supplier.phone].filter(Boolean).join(" · "),
          notes: [a.summary, a.conditions].filter(Boolean).join("\n"),
        },
      ],
      quoteNeeds: p.quoteNeeds.map((n) => (n.id === need.id ? { ...n, done: true } : n)),
      outreach: p.outreach.map((x) => (x.id === o.id ? { ...x, status: "devis enregistré", quoteId } : x)),
    }));
    setInfo(`Devis de ${supplier.name} enregistré dans l'onglet Devis (statut « reçu »).`);
  }

  // --- Affichage ---

  const counts = {
    aPreparer: plan.suppliers.filter((s) => !plan.outreach.some((o) => o.supplierId === s.id && o.status !== "brouillon")).length,
    envoyes: plan.outreach.filter((o) => o.status === "envoyé" || o.status === "relancé").length,
    reponses: plan.outreach.filter((o) => o.status === "réponse reçue").length,
    relances: plan.outreach.filter((o) => followUpDue(o, plan.sender)).length,
  };
  const anyBusy = Object.values(busy)[0];

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Démarches fournisseurs</h2>
          <button className="btn primary" disabled={Boolean(busy.check)} onClick={checkReplies}>
            {busy.check ? <><span className="spinner" /> Vérification…</> : "Vérifier les réponses Gmail"}
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          Claude trouve des fournisseurs et rédige les e-mails ; vous relisez et validez chaque envoi, fait depuis votre Gmail.
          Les réponses sont analysées et peuvent être enregistrées comme devis.
        </p>
        <div className="grid grid-kpi">
          <div className="kpi"><div className="label">Fournisseurs à contacter</div><div className="value">{counts.aPreparer}</div></div>
          <div className="kpi"><div className="label">En attente de réponse</div><div className="value">{counts.envoyes}</div></div>
          <div className="kpi"><div className="label">Réponses à traiter</div><div className={`value ${counts.reponses ? "pos" : ""}`}>{counts.reponses}</div></div>
          <div className="kpi"><div className="label">Relances à faire</div><div className={`value ${counts.relances ? "warn" : ""}`}>{counts.relances}</div></div>
        </div>
        {anyBusy && !busy.check && <p className="small" style={{ marginTop: 8 }}><span className="spinner" /> {anyBusy}</p>}
        {info && <p className="pos small" style={{ marginTop: 8 }}>{info}</p>}
        {error && <p className="neg small" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      <details className="card">
        <summary><strong>Expéditeur et relances</strong> <span className="muted small">— signature des e-mails</span></summary>
        <div className="grid grid-kpi" style={{ marginTop: 12 }}>
          <label className="field">Nom<input value={plan.sender.name} onChange={(e) => setSender({ name: e.target.value })} /></label>
          <label className="field">Société<input value={plan.sender.company} onChange={(e) => setSender({ company: e.target.value })} /></label>
          <label className="field">Téléphone<input value={plan.sender.phone} onChange={(e) => setSender({ phone: e.target.value })} /></label>
          <label className="field">E-mail (signature)<input value={plan.sender.email} onChange={(e) => setSender({ email: e.target.value })} /></label>
          <label className="field">Relancer après (jours)<Num value={plan.sender.followUpDays} onChange={(v) => setSender({ followUpDays: v })} /></label>
          <label className="field">Relances maximum<Num value={plan.sender.maxFollowUps} onChange={(v) => setSender({ maxFollowUps: v })} /></label>
        </div>
      </details>

      {plan.quoteNeeds.length === 0 && (
        <div className="card muted">Ajoutez d&apos;abord des « devis à obtenir » dans l&apos;onglet Devis.</div>
      )}

      {plan.quoteNeeds.map((need) => {
        const suppliers = plan.suppliers.filter((s) => s.needId === need.id);
        return (
          <div className="card" key={need.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0 }}>{need.item} {need.done && <span className="badge retenu">devis obtenu</span>}</h2>
                <span className="muted small">{need.category} · estimation {fmt(need.estimatedAmount)}</span>
              </div>
              <div className="row">
                <button className="btn sm" disabled={Boolean(busy[`search-${need.id}`])} onClick={() => search(need)}>
                  {busy[`search-${need.id}`] ? <><span className="spinner" /> Recherche…</> : "Chercher des fournisseurs (Claude)"}
                </button>
                <button className="btn sm" onClick={() => { setAdding(need.id); setForm(BLANK_SUPPLIER); }}>+ Ajouter un fournisseur</button>
              </div>
            </div>

            {adding === need.id && (
              <div className="card" style={{ marginTop: 12, background: "var(--surface-2)" }}>
                <div className="grid grid-kpi">
                  {(["name", "email", "phone", "city", "website"] as const).map((k) => (
                    <label className="field" key={k}>
                      {{ name: "Nom *", email: "E-mail", phone: "Téléphone", city: "Ville", website: "Site web" }[k]}
                      <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    </label>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn primary sm" disabled={!form.name.trim()} onClick={() => addManual(need.id)}>Ajouter</button>
                  <button className="btn sm" onClick={() => setAdding(null)}>Annuler</button>
                </div>
              </div>
            )}

            {suppliers.length === 0 && <p className="muted small" style={{ marginTop: 8 }}>Aucun fournisseur pour l&apos;instant.</p>}
            {suppliers.map((s) => (
              <SupplierRow
                key={s.id}
                plan={plan}
                need={need}
                supplier={s}
                outreach={plan.outreach.find((o) => o.supplierId === s.id) ?? null}
                busy={busy}
                onSupplier={(patch) => setSupplier(s.id, patch)}
                onRemove={() => removeSupplier(s)}
                onOutreach={(fn) => {
                  const o = plan.outreach.find((x) => x.supplierId === s.id);
                  if (o) setOutreach(o.id, fn);
                }}
                onPrepare={(existing, kind) => prepare(need, s, existing, kind)}
                onSend={(o) => send(o, s)}
                onAnalyze={(o) => analyze(o, need, s)}
                onSaveQuote={(o) => saveQuote(o, need, s)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function SupplierRow({
  plan,
  supplier: s,
  outreach: o,
  busy,
  onSupplier,
  onRemove,
  onOutreach,
  onPrepare,
  onSend,
  onAnalyze,
  onSaveQuote,
}: {
  plan: Plan;
  need: QuoteNeed;
  supplier: Supplier;
  outreach: Outreach | null;
  busy: Record<string, string>;
  onSupplier: (patch: Partial<Supplier>) => void;
  onRemove: () => void;
  onOutreach: (fn: (o: Outreach) => Outreach) => void;
  onPrepare: (existing: Outreach | null, kind: "demande" | "relance") => void;
  onSend: (o: Outreach) => void;
  onAnalyze: (o: Outreach) => void;
  onSaveQuote: (o: Outreach) => void;
}) {
  const { fmt, ct } = useMoney();
  const due = o ? followUpDue(o, plan.sender) : false;
  const editing = o && o.draft.trim() !== "";
  const drafting = Boolean(busy[`draft-${s.id}`]);
  const status = !o ? "à contacter" : due ? "relance à faire" : o.status;
  const statusClass = status === "devis enregistré" || status === "réponse reçue" ? "retenu" : status === "relance à faire" ? "refusé" : o && o.status !== "brouillon" ? "reçu" : "";
  const site = s.website && !/^https?:\/\//.test(s.website) ? `https://${s.website}` : s.website;

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>{s.name}</strong> <span className={`badge ${statusClass}`}>{status}</span>{" "}
          {s.source === "claude" && <span className="badge">trouvé par Claude</span>}
          <div className="muted small">
            {[s.city, s.phone].filter(Boolean).join(" · ")}
            {site && <> · <a href={site} target="_blank" rel="noreferrer">site</a></>}
          </div>
          {s.notes && <div className="small">{ct(s.notes)}</div>}
        </div>
        <button className="btn sm" title="Retirer" onClick={onRemove}>✕</button>
      </div>

      <label className="field" style={{ marginTop: 8, maxWidth: 420 }}>
        E-mail du fournisseur
        <input
          value={o?.to ?? s.email}
          placeholder="à compléter si Claude ne l'a pas trouvé"
          onChange={(e) => (o ? onOutreach((x) => ({ ...x, to: e.target.value })) : onSupplier({ email: e.target.value }))}
        />
      </label>

      {o && o.messages.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="small">
            Historique ({o.messages.length} message{o.messages.length > 1 ? "s" : ""})
            {o.lastSentAt && <span className="muted"> · dernier envoi il y a {daysSince(o.lastSentAt)} j</span>}
          </summary>
          {o.messages.map((m) => (
            <div key={m.id} className={`msg ${m.direction === "envoyé" ? "user" : "assistant"}`} style={{ marginTop: 8, maxWidth: "100%" }}>
              <div className="muted small">
                {m.direction === "envoyé" ? `Envoyé (${m.kind})` : `Reçu de ${m.from}`} · {new Date(m.date).toLocaleString("fr-FR")}
              </div>
              <strong className="small">{m.subject}</strong>
              {"\n"}
              {m.body}
            </div>
          ))}
        </details>
      )}

      {o?.analysis && (
        <div className="alert good" style={{ marginTop: 8 }}>
          <strong>Analyse de la réponse</strong>
          <p className="small" style={{ margin: "4px 0" }}>{ct(o.analysis.summary)}</p>
          {o.analysis.hasQuote && (
            <p className="small" style={{ margin: "4px 0" }}>
              Montant : <strong>{fmt(o.analysis.amount)}</strong> HT ({o.analysis.kind})
              {o.analysis.linkedId && <> · ligne : {[...plan.params.investments, ...plan.params.fixedCosts].find((l) => l.id === o.analysis!.linkedId)?.label}</>}
            </p>
          )}
          {o.analysis.conditions && <p className="small muted" style={{ margin: "4px 0" }}>{ct(o.analysis.conditions)}</p>}
          <p className="small" style={{ margin: "4px 0" }}>➜ {ct(o.analysis.nextStep)}</p>
          {o.analysis.hasQuote && o.status !== "devis enregistré" && (
            <button className="btn sm primary" onClick={() => onSaveQuote(o)}>Enregistrer comme devis</button>
          )}
        </div>
      )}

      {editing ? (
        <div style={{ marginTop: 8 }}>
          <label className="field">
            Objet
            <AutoText singleLine value={o!.subject} onChange={(v) => onOutreach((x) => ({ ...x, subject: v }))} />
          </label>
          <label className="field" style={{ marginTop: 6 }}>
            Message ({o!.draftKind === "relance" ? "relance" : "demande de devis"}) — relisez et modifiez avant l&apos;envoi
            <AutoText minRows={8} value={o!.draft} onChange={(v) => onOutreach((x) => ({ ...x, draft: v }))} />
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={Boolean(busy[`send-${o!.id}`])} onClick={() => onSend(o!)}>
              {busy[`send-${o!.id}`] ? <><span className="spinner" /> Envoi…</> : "Envoyer via Gmail"}
            </button>
            <button className="btn sm" disabled={drafting} onClick={() => onPrepare(o, o!.draftKind)}>Régénérer</button>
            <button className="btn sm" onClick={() => onOutreach((x) => ({ ...x, draft: "" }))}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 8 }}>
          {(!o || o.status === "brouillon") && (
            <button className="btn sm primary" disabled={drafting} onClick={() => onPrepare(o, "demande")}>
              {drafting ? <><span className="spinner" /> Rédaction…</> : "Préparer l'e-mail"}
            </button>
          )}
          {o && (o.status === "envoyé" || o.status === "relancé" || o.status === "réponse reçue") && (
            <button className={`btn sm ${due ? "primary" : ""}`} disabled={drafting} onClick={() => onPrepare(o, "relance")}>
              {drafting ? <><span className="spinner" /> Rédaction…</> : o.status === "réponse reçue" ? "Répondre / relancer" : "Préparer la relance"}
            </button>
          )}
          {o && o.messages.some((m) => m.direction === "reçu") && !o.analysis && (
            <button className="btn sm" disabled={Boolean(busy[`analyze-${o.id}`])} onClick={() => onAnalyze(o)}>Analyser la réponse</button>
          )}
          {o && o.status !== "clos" && o.status !== "brouillon" && (
            <button className="btn sm" onClick={() => onOutreach((x) => ({ ...x, status: "clos" }))}>Clore</button>
          )}
        </div>
      )}
    </div>
  );
}
