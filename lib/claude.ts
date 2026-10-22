"use client";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  ASK_SYSTEM,
  GENERATE_SYSTEM,
  GeneratedPlanSchema,
  generatePrompt,
  toPlan,
  type GenerateRequest,
} from "./ai";
import type { ChatMessage, Plan } from "./types";

// L'app est hébergée en pages statiques (GitHub Pages) : Claude est appelé directement
// depuis le navigateur, avec la clé API saisie par l'utilisateur et conservée uniquement
// dans ce navigateur (localStorage). La clé n'est jamais écrite dans le code ni sur GitHub.

const MODEL = "claude-opus-5-5";
const KEY_STORAGE = "bp-sim:apiKey";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {}
}

function client(): Anthropic {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Clé API Claude manquante : renseignez-la dans « Réglages » sur la page d'accueil.");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Clé API Claude invalide : vérifiez-la dans « Réglages » sur la page d'accueil.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "Accès refusé par l'API Claude (crédits ou droits de la clé).";
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

// Génère un business plan complet ; onProgress reçoit le nombre de caractères rédigés.
export async function generatePlan(req: GenerateRequest, onProgress: (chars: number) => void): Promise<Plan> {
  const stream = client().beta.messages.stream({
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
  stream.on("text", (delta) => {
    chars += delta.length;
    onProgress(chars);
  });
  try {
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error("Claude a refusé cette demande.");
    if (message.stop_reason === "max_tokens" || !message.parsed_output) {
      throw new Error("Réponse incomplète de Claude, réessayez.");
    }
    return toPlan(message.parsed_output, req);
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

// Assistant : répond à une question en tenant compte du contexte du plan.
export async function askClaude(
  context: string,
  messages: ChatMessage[],
  onText: (delta: string) => void,
): Promise<void> {
  const stream = client().beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: ASK_SYSTEM },
      { type: "text", text: `Données du business plan :\n${context}` },
    ],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  stream.on("text", onText);
  try {
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error("Claude a refusé de répondre à cette demande.");
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}
