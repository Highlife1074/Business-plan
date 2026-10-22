"use client";

import { useEffect, useRef, useState } from "react";
import type { TabProps } from "./tab";
import type { ChatMessage } from "@/lib/types";
import { planContext } from "@/lib/context";
import { readNdjson } from "@/lib/ndjson";

type AskEvent = { type: "text"; delta: string } | { type: "done" } | { type: "error"; error: string };

const SUGGESTIONS = [
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

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...plan.chat, { role: "user", content: q }];
    update((p) => ({ ...p, chat: history }));
    setInput("");
    setBusy(true);
    setError("");
    setStreaming("");
    let answer = "";
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: planContext(plan, proj), messages: history }),
      });
      await readNdjson<AskEvent>(res, (ev) => {
        if (ev.type === "text") {
          answer += ev.delta;
          setStreaming(answer);
        } else if (ev.type === "error") throw new Error(ev.error);
      });
      update((p) => ({ ...p, chat: [...p.chat, { role: "assistant", content: answer }] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [plan.chat.length, streaming]);

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
        {plan.chat.map((msg, i) => <div key={i} className={`msg ${msg.role}`}>{msg.content}</div>)}
        {busy && <div className="msg assistant">{streaming || <span className="spinner" />}</div>}
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
