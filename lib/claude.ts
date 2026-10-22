"use client";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  ASK_SYSTEM,
  FiguresSchema,
  GENERATE_SYSTEM,
  TextsSchema,
  figuresPrompt,
  textsPrompt,
  toPlan,
  type GenerateRequest,
} from "./ai";
import type { ChatMessage, Plan } from "./types";
import { cloudSaveSettings } from "./firebase";
import { currentUid } from "./storage";

// L'app est hébergée en pages statiques (GitHub Pages) : Claude est appelé directement
// depuis le navigateur, avec la clé API saisie par l'utilisateur. La clé est conservée dans
// le navigateur et, une fois connecté avec Google, dans l'espace Firestore privé de l'utilisateur
// pour être retrouvée sur ses autres appareils. Elle n'est jamais écrite dans le code ni sur GitHub.

const MODEL = "claude-opus-5-5";
const KEY_STORAGE = "bp-sim:apiKey";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

// Met à jour la clé dans ce navigateur uniquement (utilisé lors de la synchronisation)
export function setLocalApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {}
}

export async function setApiKey(key: string): Promise<void> {
  setLocalApiKey(key);
  const uid = currentUid();
  if (uid) await cloudSaveSettings(uid, { apiKey: key.trim() });
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

// Appel avec sortie JSON validée par un schéma Zod. Utilise les sorties structurées de l'API ;
// si le schéma est refusé (grammaire trop volumineuse), redemande le JSON dans la consigne
// et le valide côté navigateur.
async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  effort: "low" | "medium" | "high";
  onText?: (delta: string) => void;
}): Promise<z.infer<S>> {
  const base = {
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    thinking: { type: "adaptive" as const },
  };
  const run = async (constrained: boolean) => {
    const stream = client().beta.messages.stream({
      ...base,
      output_config: constrained
        ? { effort: opts.effort, format: betaZodOutputFormat(opts.schema) }
        : { effort: opts.effort },
      system: constrained
        ? opts.system
        : `${opts.system}\n\nRéponds uniquement avec un objet JSON valide (sans texte autour) conforme à ce schéma JSON :\n${JSON.stringify(z.toJSONSchema(opts.schema))}`,
      messages: [{ role: "user", content: opts.prompt }],
    });
    if (opts.onText) stream.on("text", opts.onText);
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error("Claude a refusé cette demande.");
    if (message.stop_reason === "max_tokens") throw new Error("Réponse incomplète de Claude, réessayez.");
    if (constrained) {
      if (!message.parsed_output) throw new Error("Réponse illisible de Claude, réessayez.");
      return message.parsed_output as z.infer<S>;
    }
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    let json: unknown = null;
    try {
      json = JSON.parse(text.slice(start, end + 1));
    } catch {}
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) throw new Error("Réponse de Claude non conforme, réessayez.");
    return parsed.data;
  };
  try {
    return await run(true);
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError && /grammar|schema/i.test(err.message)) return run(false);
    throw err;
  }
}

// Génère un business plan complet en deux temps : hypothèses chiffrées, puis textes cohérents
// avec ces chiffres. onProgress reçoit le nombre de caractères rédigés.
export async function generatePlan(req: GenerateRequest, onProgress: (chars: number) => void): Promise<Plan> {
  let chars = 0;
  const onText = (delta: string) => {
    chars += delta.length;
    onProgress(chars);
  };
  try {
    const figures = await structured({
      schema: FiguresSchema,
      system: GENERATE_SYSTEM,
      prompt: figuresPrompt(req),
      effort: "high",
      onText,
    });
    const texts = await structured({
      schema: TextsSchema,
      system: GENERATE_SYSTEM,
      prompt: textsPrompt(req, figures),
      effort: "medium",
      onText,
    });
    return toPlan({ ...figures, ...texts }, req);
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
