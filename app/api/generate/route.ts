import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  GENERATE_SYSTEM,
  GeneratedPlanSchema,
  generatePrompt,
  toPlan,
  type GenerateRequest,
} from "@/lib/ai";
import { MODEL, apiErrorMessage, ndjsonResponse } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Génère un business plan complet. La réponse est un flux NDJSON :
// des événements "progress" pendant la rédaction, puis "done" (le plan) ou "error".
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<GenerateRequest>;
  const req: GenerateRequest = {
    businessType: String(body.businessType ?? "").trim(),
    country: String(body.country ?? "").trim(),
    city: String(body.city ?? "").trim(),
    budget: String(body.budget ?? "").trim(),
    details: String(body.details ?? "").trim(),
  };
  if (!req.businessType || !req.country) {
    return Response.json({ error: "Type d'activité et pays obligatoires." }, { status: 400 });
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
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(GeneratedPlanSchema) },
      system: GENERATE_SYSTEM,
      messages: [{ role: "user", content: generatePrompt(req) }],
    });

    let chars = 0;
    let reported = 0;
    stream.on("text", (delta) => {
      chars += delta.length;
      if (chars - reported >= 200) {
        reported = chars;
        send({ type: "progress", chars });
      }
    });

    try {
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        send({ type: "error", error: "Claude a refusé cette demande." });
        return;
      }
      if (message.stop_reason === "max_tokens" || !message.parsed_output) {
        send({ type: "error", error: "Réponse incomplète de Claude, réessayez." });
        return;
      }
      send({ type: "done", plan: toPlan(message.parsed_output, req) });
    } catch (err) {
      send({ type: "error", error: apiErrorMessage(err) });
    }
  });
}
