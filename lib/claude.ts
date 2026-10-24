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
import { SECTIONS, type PlanChange } from "./plan-edit";

// L'app est hébergée en pages statiques (GitHub Pages) : Claude est appelé directement
// depuis le navigateur, avec la clé API saisie par l'utilisateur. La clé est conservée dans
// le navigateur et, une fois connecté avec Google, dans l'espace Firestore privé de l'utilisateur
// pour être retrouvée sur ses autres appareils. Elle n'est jamais écrite dans le code ni sur GitHub.

export const MODEL = "claude-opus-5-5";
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

export function client(): Anthropic {
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
export async function structured<S extends z.ZodType>(opts: {
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

// Outil donné à l'assistant pour modifier directement le plan
const EDIT_TOOL: Anthropic.Beta.BetaTool = {
  name: "modifier_plan",
  description: `Modifie directement le business plan dans l'application (hypothèses, lignes de CA, charges, personnel, investissements, prêts, financement, saisonnalité, scénario, textes, juridique, risques, devis à obtenir). Tous les calculs sont mis à jour automatiquement.
Sections et champs :
- general (modifier) : startDate "AAAA-MM", horizonYears, vatRatePct, corporateTaxPct, employerChargesPct, inflationPct, discountRatePct, rampUpMonths, rampUpStartPct
- projet (modifier) : name, description, city
- saisonnalite (modifier) : clés "1" à "12" (mois) → coefficient
- financement (modifier) : equity, subsidies
- scenario (modifier) : volumePct, pricePct, costPct
- textes (modifier) : summary, market, strengths[], weaknesses[], opportunities[], threats[], keyAssumptions[]
- revenus (ajouter/modifier/supprimer) : label, unitLabel, unitPrice, unitsPerDay, openDaysPerMonth, variableCostPct, growthPct, note
- charges_fixes : label, monthly, note
- personnel : role, count, grossMonthly, startMonth
- investissements : label, amount, depreciationYears, note
- prets : label, amount, ratePct, years, deferralMonths
- juridique : title, content
- risques : risk, probability, impact ("faible"|"moyen"|"élevé"), mitigation
- devis_a_obtenir : item, category, estimatedAmount
Pour modifier ou supprimer une ligne, indique son "id" (fourni dans les données du plan). Les montants sont dans la devise du plan, hors taxes.`,
  input_schema: {
    type: "object",
    required: ["changes"],
    properties: {
      changes: {
        type: "array",
        items: {
          type: "object",
          required: ["action", "section"],
          properties: {
            action: { type: "string", enum: ["modifier", "ajouter", "supprimer"] },
            section: { type: "string", enum: Object.keys(SECTIONS) },
            id: { type: "string", description: "Identifiant de la ligne (sections en liste)" },
            valeurs: { type: "object", description: "Champs à écrire et leurs nouvelles valeurs" },
          },
        },
      },
    },
  },
};

const EditInput = z.object({
  changes: z.array(
    z.object({
      action: z.enum(["modifier", "ajouter", "supprimer"]),
      section: z.string(),
      id: z.string().optional(),
      valeurs: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

// Assistant : répond aux questions sur le plan et peut le modifier avec l'outil modifier_plan.
// onEdit applique les modifications et renvoie le journal (et les erreurs) transmis à Claude.
export async function askClaude(
  context: string,
  messages: ChatMessage[],
  onText: (delta: string) => void,
  onEdit: (changes: PlanChange[]) => { log: string[]; errors: string[] },
): Promise<void> {
  const history: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  try {
    for (let turn = 0; turn < 6; turn++) {
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
        tools: [EDIT_TOOL],
        messages: history,
      });
      if (turn > 0) onText("\n\n");
      stream.on("text", onText);
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new Error("Claude a refusé de répondre à cette demande.");
      const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (message.stop_reason !== "tool_use" || calls.length === 0) return;
      history.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = calls.map((call) => {
        const parsed = EditInput.safeParse(call.input);
        if (call.name !== EDIT_TOOL.name || !parsed.success) {
          return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "Paramètres de l'outil invalides." };
        }
        const { log, errors } = onEdit(parsed.data.changes);
        const content = [
          log.length ? `Modifications appliquées :\n- ${log.join("\n- ")}` : "Aucune modification appliquée.",
          errors.length ? `Erreurs :\n- ${errors.join("\n- ")}` : "",
        ].filter(Boolean).join("\n\n");
        return { type: "tool_result", tool_use_id: call.id, is_error: log.length === 0 && errors.length > 0, content };
      });
      history.push({ role: "user", content: results });
    }
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}
