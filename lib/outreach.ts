import type { Outreach, OutreachMessage, Sender } from "./types";

const DAY = 24 * 60 * 60 * 1000;

// Relance due : e-mail envoyé, pas de réponse, délai écoulé et nombre maximal de relances non atteint.
export function followUpDue(o: Outreach, sender: Sender, now = Date.now()): boolean {
  if (o.status !== "envoyé" && o.status !== "relancé") return false;
  if (!o.lastSentAt || o.followUps >= sender.maxFollowUps) return false;
  return now - new Date(o.lastSentAt).getTime() >= sender.followUpDays * DAY;
}

export function daysSince(iso: string | null, now = Date.now()): number | null {
  return iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null;
}

export interface ThreadMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  mine: boolean;
}

// Messages reçus dans le fil Gmail qui ne sont pas encore enregistrés dans la démarche.
export function newReplies(o: Outreach, thread: ThreadMessage[]): OutreachMessage[] {
  const known = new Set(o.messages.map((m) => m.gmailId).filter(Boolean));
  return thread
    .filter((m) => !m.mine && !known.has(m.id))
    .map((m) => ({
      id: `in-${m.id}`,
      direction: "reçu" as const,
      kind: "réponse" as const,
      from: m.from,
      subject: m.subject,
      body: m.body,
      date: m.date,
      gmailId: m.id,
    }));
}

// --- Suivi des consultations : demandes de prix, relances et retours ---

export const CHANNELS = ["e-mail", "téléphone", "rendez-vous", "courrier", "site web", "autre"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface LoggedEvent {
  kind: "demande" | "relance" | "réponse";
  date: string; // ISO
  channel: Channel;
  note: string;
  declined?: boolean; // retour négatif : le fournisseur ne donne pas suite
}

const sent = (m: OutreachMessage) => m.direction === "envoyé";
const byDate = (a: OutreachMessage, b: OutreachMessage) => new Date(a.date).getTime() - new Date(b.date).getTime();

// Recalcule la date du dernier envoi, le nombre de relances et le statut à partir de l'historique.
// Les statuts posés par l'utilisateur (devis enregistré, clos) sont conservés.
function refresh(o: Outreach, messages: OutreachMessage[]): Outreach {
  const sorted = [...messages].sort(byDate);
  const out = sorted.filter(sent);
  const lastOut = out[out.length - 1];
  const lastIn = [...sorted].reverse().find((m) => !sent(m));
  const replied = lastIn !== undefined && (!lastOut || new Date(lastIn.date) >= new Date(lastOut.date));
  const status: Outreach["status"] =
    o.status === "devis enregistré" || o.status === "clos"
      ? o.status
      : replied
        ? "réponse reçue"
        : !lastOut
          ? "brouillon"
          : lastOut.kind === "relance"
            ? "relancé"
            : "envoyé";
  return {
    ...o,
    messages: sorted,
    lastSentAt: lastOut?.date ?? null,
    followUps: out.filter((m) => m.kind === "relance").length,
    status,
  };
}

// Enregistre un échange fait hors Gmail (téléphone, rendez-vous, autre messagerie…).
export function logEvent(o: Outreach, e: LoggedEvent, id: string): Outreach {
  const msg: OutreachMessage = {
    id: `log-${id}`,
    direction: e.kind === "réponse" ? "reçu" : "envoyé",
    kind: e.kind,
    from: e.kind === "réponse" ? "fournisseur" : "moi",
    subject: "",
    body: e.note,
    date: e.date,
    gmailId: null,
    channel: e.channel,
  };
  const next = refresh(o, [...o.messages, msg]);
  return e.declined ? { ...next, status: "clos" } : next;
}

export function removeEvent(o: Outreach, messageId: string): Outreach {
  return refresh(o, o.messages.filter((m) => m.id !== messageId));
}

export function channelOf(m: OutreachMessage): string {
  return m.gmailId ? "Gmail" : (m.channel ?? "e-mail");
}

export interface ConsultationSummary {
  requestedAt: string | null; // première demande de prix
  followUpDates: string[];
  firstReplyAt: string | null;
  lastReplyAt: string | null;
  replyDelayDays: number | null; // délai entre la demande et le premier retour
  nextFollowUpAt: string | null; // date prévue de la prochaine relance
}

export function summarize(o: Outreach, sender: Sender): ConsultationSummary {
  const sorted = [...o.messages].sort(byDate);
  const requests = sorted.filter((m) => sent(m) && m.kind === "demande");
  const replies = sorted.filter((m) => !sent(m));
  const requestedAt = requests[0]?.date ?? sorted.find(sent)?.date ?? null;
  const firstReplyAt = replies[0]?.date ?? null;
  const waiting = (o.status === "envoyé" || o.status === "relancé") && o.lastSentAt && o.followUps < sender.maxFollowUps;
  return {
    requestedAt,
    followUpDates: sorted.filter((m) => sent(m) && m.kind === "relance").map((m) => m.date),
    firstReplyAt,
    lastReplyAt: replies[replies.length - 1]?.date ?? null,
    replyDelayDays:
      requestedAt && firstReplyAt ? Math.max(0, Math.round((new Date(firstReplyAt).getTime() - new Date(requestedAt).getTime()) / DAY)) : null,
    nextFollowUpAt: waiting ? new Date(new Date(o.lastSentAt!).getTime() + sender.followUpDays * DAY).toISOString() : null,
  };
}
