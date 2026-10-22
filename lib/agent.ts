"use client";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODEL, apiErrorMessage, client, structured } from "./claude";
import type { Outreach, Plan, QuoteNeed, ReplyAnalysis, Supplier } from "./types";

// Agent « démarches » : recherche de fournisseurs, rédaction des e-mails, analyse des réponses.
// Rien n'est envoyé sans validation : ces fonctions ne font que proposer.

const AGENT_SYSTEM = `Tu es l'assistant d'un porteur de projet qui prépare son business plan.
Tu l'aides à obtenir des devis auprès de fournisseurs : tu trouves des fournisseurs, tu rédiges des e-mails professionnels, courts et précis, et tu analyses leurs réponses.
Écris les e-mails dans la langue du pays du fournisseur (par exemple en polonais pour la Pologne), sauf indication contraire.
N'invente jamais de coordonnées : si tu ne trouves pas d'adresse e-mail fiable, laisse le champ vide.`;

function projectBrief(plan: Plan, need: QuoteNeed): string {
  return [
    `Projet : ${plan.meta.name} — ${plan.meta.businessType}`,
    `Lieu : ${[plan.meta.city, plan.meta.country].filter(Boolean).join(", ")}`,
    `Description : ${plan.meta.description}`,
    `Devis recherché : ${need.item} (catégorie : ${need.category || "—"}, budget estimé : ${need.estimatedAmount} ${plan.meta.currency} HT)`,
    `Date de démarrage prévue : ${plan.params.startDate}`,
  ].join("\n");
}

const SuppliersInput = z.object({
  suppliers: z.array(
    z.object({
      name: z.string(),
      email: z.string(),
      website: z.string(),
      phone: z.string(),
      city: z.string(),
      notes: z.string(),
    }),
  ),
});

const SAVE_TOOL: Anthropic.Beta.BetaTool = {
  name: "enregistrer_fournisseurs",
  description: "Enregistre la liste finale des fournisseurs trouvés (à appeler une seule fois, à la fin de la recherche).",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["suppliers"],
    properties: {
      suppliers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "email", "website", "phone", "city", "notes"],
          properties: {
            name: { type: "string" },
            email: { type: "string", description: "Adresse e-mail de contact trouvée sur une source fiable, sinon chaîne vide" },
            website: { type: "string" },
            phone: { type: "string" },
            city: { type: "string" },
            notes: { type: "string", description: "Pourquoi ce fournisseur est pertinent (spécialité, taille, références)" },
          },
        },
      },
    },
  },
};

// Recherche web de fournisseurs (outil web_search de l'API), résultat via un outil structuré.
export async function findSuppliers(plan: Plan, need: QuoteNeed): Promise<Omit<Supplier, "id" | "needId" | "source">[]> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `${projectBrief(plan, need)}\n\nTrouve 3 à 6 fournisseurs sérieux, de préférence proches du lieu du projet, capables de fournir un devis pour ce besoin. Cherche leurs coordonnées (e-mail de contact en priorité) sur leur site officiel. Termine en appelant l'outil enregistrer_fournisseurs.`,
    },
  ];
  try {
    for (let turn = 0; turn < 4; turn++) {
      const response = await client().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: AGENT_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }, SAVE_TOOL],
        messages,
      });
      if (response.stop_reason === "refusal") throw new Error("Claude a refusé cette recherche.");
      const call = response.content.find(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === SAVE_TOOL.name,
      );
      if (call) {
        const parsed = SuppliersInput.safeParse(call.input);
        if (!parsed.success) throw new Error("Liste de fournisseurs illisible, réessayez.");
        return parsed.data.suppliers;
      }
      // Recherche longue mise en pause par l'API, ou réponse sans l'outil : on poursuit
      messages.push({ role: "assistant", content: response.content });
      if (response.stop_reason !== "pause_turn") {
        messages.push({ role: "user", content: "Appelle maintenant l'outil enregistrer_fournisseurs avec les fournisseurs trouvés." });
      }
    }
    throw new Error("La recherche n'a pas abouti, réessayez.");
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

const EmailSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Corps de l'e-mail en texte brut, signature comprise"),
});

export async function draftEmail(
  plan: Plan,
  need: QuoteNeed,
  supplier: Supplier,
  outreach: Outreach | null,
  kind: "demande" | "relance",
): Promise<{ subject: string; body: string }> {
  const s = plan.sender;
  const signature = [s.name, s.company, s.phone, s.email].filter(Boolean).join("\n");
  const history = (outreach?.messages ?? [])
    .map((m) => `--- ${m.direction === "envoyé" ? "Envoyé" : "Reçu"} le ${m.date.slice(0, 10)} ---\n${m.body}`)
    .join("\n\n");
  const prompt =
    kind === "demande"
      ? `${projectBrief(plan, need)}\n\nFournisseur : ${supplier.name} (${supplier.city || "ville inconnue"}). ${supplier.notes}\n\nRédige un e-mail de demande de devis : présentation brève du projet, besoin précis, informations utiles pour chiffrer (quantités, caractéristiques, lieu, calendrier), questions sur prix HT, délais, garantie, maintenance et conditions de paiement. Ne mentionne pas notre budget estimé.\n\nSignature :\n${signature || "(aucune : termine par une formule de politesse)"}`
      : `${projectBrief(plan, need)}\n\nFournisseur : ${supplier.name}.\nÉchanges précédents :\n${history}\n\nRédige une relance courte et courtoise (sans répéter toute la demande) pour obtenir le devis. Le sujet doit reprendre celui de l'e-mail initial précédé de « Re: » ou équivalent local.\n\nSignature :\n${signature || "(aucune)"}`;
  try {
    return await structured({ schema: EmailSchema, system: AGENT_SYSTEM, prompt, effort: "medium" });
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

const AnalysisSchema = z.object({
  summary: z.string().describe("Résumé en français de la réponse, 2-3 phrases"),
  hasQuote: z.boolean().describe("La réponse contient-elle un prix exploitable ?"),
  amount: z.number().describe("Montant total HT proposé dans la devise du projet, 0 si aucun"),
  kind: z.enum(["investissement", "charge mensuelle"]),
  linkedId: z.string().describe("Identifiant de la ligne du plan concernée, ou chaîne vide"),
  conditions: z.string().describe("Délais, garanties, conditions de paiement, validité"),
  nextStep: z.string().describe("Action recommandée (relancer, demander une précision, comparer, accepter…)"),
});

export async function analyzeReply(plan: Plan, need: QuoteNeed, supplier: Supplier, replyBody: string): Promise<ReplyAnalysis> {
  const lines = [
    ...plan.params.investments.map((i) => `${i.id} — investissement — ${i.label} (${i.amount})`),
    ...plan.params.fixedCosts.map((c) => `${c.id} — charge mensuelle — ${c.label} (${c.monthly}/mois)`),
  ].join("\n");
  const prompt = `${projectBrief(plan, need)}\n\nRéponse du fournisseur ${supplier.name} :\n"""\n${replyBody}\n"""\n\nLignes du business plan (identifiant — type — libellé (montant actuel)) :\n${lines}\n\nAnalyse cette réponse. Si un prix est donné, convertis-le en montant HT dans la devise du projet (${plan.meta.currency}) et indique la ligne du plan qu'il concerne.`;
  try {
    const a = await structured({ schema: AnalysisSchema, system: AGENT_SYSTEM, prompt, effort: "medium" });
    const valid = [...plan.params.investments, ...plan.params.fixedCosts].some((l) => l.id === a.linkedId);
    return { ...a, linkedId: valid ? a.linkedId : null };
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}
