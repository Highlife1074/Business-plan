import { test } from "node:test";
import assert from "node:assert/strict";
import { followUpDue, logEvent, newReplies, removeEvent, summarize } from "./outreach.ts";
import type { Outreach, Sender } from "./types";

const sender: Sender = { name: "", company: "", phone: "", email: "", followUpDays: 5, maxFollowUps: 2 };
const base: Outreach = {
  id: "o", supplierId: "s", status: "envoyé", to: "a@b.c", subject: "Devis", draft: "", draftKind: "demande",
  threadId: "t", lastSentAt: "2027-01-01T10:00:00Z", followUps: 0, messages: [], analysis: null, quoteId: null,
};
const at = (d: string) => new Date(d).getTime();

test("relance due après le délai, sans réponse", () => {
  assert.equal(followUpDue(base, sender, at("2027-01-05T10:00:00Z")), false);
  assert.equal(followUpDue(base, sender, at("2027-01-06T10:00:00Z")), true);
});

test("pas de relance après une réponse ou au-delà du maximum", () => {
  const later = at("2027-02-01T00:00:00Z");
  assert.equal(followUpDue({ ...base, status: "réponse reçue" }, sender, later), false);
  assert.equal(followUpDue({ ...base, status: "relancé", followUps: 2 }, sender, later), false);
  assert.equal(followUpDue({ ...base, status: "relancé", followUps: 1 }, sender, later), true);
});

test("seules les nouvelles réponses du fournisseur sont retenues", () => {
  const o = { ...base, messages: [{ id: "x", direction: "reçu" as const, kind: "réponse" as const, from: "", subject: "", body: "", date: "", gmailId: "g2" }] };
  const thread = [
    { id: "g1", from: "moi", subject: "Devis", date: "2027-01-01", body: "demande", mine: true },
    { id: "g2", from: "fournisseur", subject: "Re: Devis", date: "2027-01-02", body: "déjà vu", mine: false },
    { id: "g3", from: "fournisseur", subject: "Re: Devis", date: "2027-01-03", body: "prix : 1000", mine: false },
  ];
  const r = newReplies(o, thread);
  assert.deepEqual(r.map((m) => m.gmailId), ["g3"]);
  assert.equal(r[0].direction, "reçu");
});

test("échanges notés à la main : demande, relance puis retour", () => {
  const draft = { ...base, status: "brouillon" as const, threadId: null, lastSentAt: null };
  let o = logEvent(draft, { kind: "demande", date: "2027-01-01T12:00:00Z", channel: "téléphone", note: "appel" }, "1");
  assert.equal(o.status, "envoyé");
  assert.equal(o.lastSentAt, "2027-01-01T12:00:00Z");
  assert.equal(summarize(o, sender).nextFollowUpAt, "2027-01-06T12:00:00.000Z");
  o = logEvent(o, { kind: "relance", date: "2027-01-07T12:00:00Z", channel: "e-mail", note: "" }, "2");
  assert.equal(o.status, "relancé");
  assert.equal(o.followUps, 1);
  o = logEvent(o, { kind: "réponse", date: "2027-01-10T12:00:00Z", channel: "e-mail", note: "offre à 900" }, "3");
  assert.equal(o.status, "réponse reçue");
  const s = summarize(o, sender);
  assert.equal(s.requestedAt, "2027-01-01T12:00:00Z");
  assert.deepEqual(s.followUpDates, ["2027-01-07T12:00:00Z"]);
  assert.equal(s.replyDelayDays, 9);
  assert.equal(s.nextFollowUpAt, null);
  // Suppression du retour : la consultation repasse en attente
  o = removeEvent(o, "log-3");
  assert.equal(o.status, "relancé");
});

test("un retour négatif clôt la consultation", () => {
  const o = logEvent(base, { kind: "réponse", date: "2027-01-03T12:00:00Z", channel: "téléphone", note: "", declined: true }, "x");
  assert.equal(o.status, "clos");
});
