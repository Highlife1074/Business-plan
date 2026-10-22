import Anthropic from "@anthropic-ai/sdk";
import { ASK_SYSTEM } from "@/lib/ai";
import type { ChatMessage } from "@/lib/types";
import { MODEL, apiErrorMessage, ndjsonResponse } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Assistant conversationnel : répond aux questions sur le plan en cours.
// Le client envoie le contexte du plan (hypothèses + résultats calculés) et l'historique.
export async function POST(request: Request) {
  const body = (await request.json()) as { context?: string; messages?: ChatMessage[] };
  const messages: Anthropic.Beta.BetaMessageParam[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Question manquante." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json(
      { error: "Clé API absente : définissez ANTHROPIC_API_KEY côté serveur (voir README)." },
      { status: 500 },
    );
  }

  return ndjsonResponse(async (send) => {
    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: ASK_SYSTEM },
        { type: "text", text: `Données du business plan :\n${body.context ?? ""}` },
      ],
      messages,
    });
    stream.on("text", (delta) => send({ type: "text", delta }));
    try {
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        send({ type: "error", error: "Claude a refusé de répondre à cette demande." });
        return;
      }
      send({ type: "done" });
    } catch (err) {
      send({ type: "error", error: apiErrorMessage(err) });
    }
  });
}
