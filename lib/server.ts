import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Clé API Anthropic invalide ou absente (variable ANTHROPIC_API_KEY).";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Limite de requêtes atteinte, réessayez dans un instant.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `Requête refusée par l'API : ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `Erreur de l'API Claude (${err.status ?? "réseau"}) : ${err.message}`;
  }
  return err instanceof Error ? err.message : "Erreur inconnue";
}

// Réponse en flux NDJSON (un objet JSON par ligne) : garde la connexion active
// pendant les générations longues et permet d'afficher la progression.
export function ndjsonResponse(run: (send: (event: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await run(send);
      } catch (err) {
        send({ type: "error", error: apiErrorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
