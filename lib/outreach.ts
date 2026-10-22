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
