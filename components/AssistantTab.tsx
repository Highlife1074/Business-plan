"use client";

import { useEffect, useRef, useState } from "react";
import type { TabProps } from "./tab";
import type { ChatMessage, Plan } from "@/lib/types";
import { applyPlanChanges, type PlanChange } from "@/lib/plan-edit";
import { uid } from "@/lib/uid";
import { planContext } from "@/lib/context";
import { askClaude } from "@/lib/claude";
import { useMoney } from "./CurrencyProvider";
import { num } from "@/lib/format";

const SUGGESTIONS = [
  "Baisse le loyer de 10 % et ajoute un salarié à mi-temps à partir du mois 6",
  "Quels sont les 3 points faibles de ce plan aux yeux d'un banquier ?",
  "Mes hypothèses de prix et de volumes sont-elles réalistes pour ce pays ?",
  "Comment réduire le besoin de financement initial ?",
  "Quelles aides et subventions existent pour ce type de projet ?",
];

export default function AssistantTab({ plan, proj, update, pendingQuestion, clearPendingQuestion }: TabProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const handled = useRef<string | null>(null);
  // Plan le plus récent (les modifications de Claude s'appliquent dessus, même pendant la réponse)
  const planRef = useRef(plan);
  planRef.current = plan;
  const [undo, setUndo] = useState<{ before: Plan; count: number } | null>(null);

  const { ct, converted, base, display, rate } = useMoney();
  // Devise d'affichage choisie : Claude donne alors ses montants dans cette devise
  const currencyNote = converted
    ? `\n\nL'utilisateur affiche les montants en ${display} (1 ${base} = ${num(rate, 4)} ${display}) : exprime les montants en ${display}, avec l'équivalent en ${base} entre parenthèses.`
    : "";

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...plan.chat, { role: "user", content: q }];
    update((p) => ({ ...p, chat: history }));
    setInput("");
    setUndo(null);
    setBusy(true);
    setError("");
    setStreaming("");
    let answer = "";
    const applied: string[] = [];
    let before: Plan | null = null;
    const onEdit = (changes: PlanChange[]) => {
      const result = applyPlanChanges(planRef.current, changes, uid);
      if (result.log.length) {
        before ??= planRef.current;
        planRef.current = result.plan;
        applied.push(...result.log);
        // la conversation est conservée telle quelle : seules les données du plan changent
        update((p) => ({ ...result.plan, chat: p.chat }));
      }
      return result;
    };
    try {
      await askClaude(planContext(plan, proj) + currencyNote, history, (delta) => {
        answer += delta;
        setStreaming(answer);
      }, onEdit);
      if (applied.length) {
        answer += `\n\n🔧 Modifications appliquées au plan :\n- ${applied.join("\n- ")}`;
        setUndo({ before: before!, count: applied.length });
      }
      update((p) => ({ ...p, chat: [...p.chat, { role: "assistant", content: answer }] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (applied.length) {
        answer += `\n\n🔧 Modifications appliquées au plan :\n- ${applied.join("\n- ")}`;
        setUndo({ before: before!, count: applied.length });
      }
      if (answer) update((p) => ({ ...p, chat: [...p.chat, { role: "assistant", content: answer }] }));
    } finally {
      setStreaming("");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (pendingQuestion && handled.current !== pendingQuestion) {
      handled.current = pendingQuestion;
      clearPendingQuestion();
      send(pendingQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  // Corps en bloc : scrollIntoView renvoie une Promise sur les navigateurs récents, et React
  // planterait au démontage en la prenant pour une fonction de nettoyage.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [plan.chat.length, streaming]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Assistant Claude</h2>
        {plan.chat.length > 0 && (
          <button className="btn sm no-print" disabled={busy} onClick={() => confirm("Effacer la conversation ?") && update((p) => ({ ...p, chat: [] }))}>
            Effacer
          </button>
        )}
      </div>
      <p className="muted small">
        Claude voit toutes les hypothèses et les résultats calculés du plan (scénario en cours compris). Appliquez ses suggestions
        dans l&apos;onglet Paramètres pour mettre à jour le plan.
      </p>
      <div className="chat">
        {plan.chat.map((msg, i) => <div key={i} className={`msg ${msg.role}`}>{ct(msg.content)}</div>)}
        {busy && <div className="msg assistant">{ct(streaming) || <span className="spinner" />}</div>}
        {undo && !busy && (
          <div className="alert good row" style={{ justifyContent: "space-between" }}>
            <span className="small">Claude a modifié {undo.count} valeur{undo.count > 1 ? "s" : ""} du plan : tous les onglets sont recalculés.</span>
            <button
              className="btn sm"
              onClick={() => {
                const before = undo.before;
                update((p) => ({ ...before, chat: [...p.chat, { role: "assistant", content: "↩️ Modifications annulées : le plan est revenu à son état précédent." }] }));
                setUndo(null);
              }}
            >
              Annuler ces modifications
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {error && <p className="neg">{error}</p>}
      {plan.chat.length === 0 && !busy && (
        <div className="row" style={{ marginTop: 12 }}>
          {SUGGESTIONS.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form className="row no-print" style={{ marginTop: 12, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea
          rows={2}
          style={{ minHeight: 44 }}
          value={input}
          placeholder="Posez une question sur votre business plan…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="btn primary" disabled={busy || !input.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
