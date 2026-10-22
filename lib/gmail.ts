"use client";

import { cachedGmailToken, clearGmailToken, requestGmailToken } from "./firebase";

// Accès à Gmail depuis le navigateur (API REST Gmail) avec le compte Google de l'utilisateur.
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string; // ISO
  body: string;
  mine: boolean; // envoyé depuis cette boîte
}

export async function gmailToken(): Promise<string> {
  return cachedGmailToken() ?? (await requestGmailToken());
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await gmailToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    if (res.status === 401) {
      clearGmailToken();
      throw new Error("Accès Gmail expiré : relancez l'action pour vous reconnecter.");
    }
    if (res.status === 403 && /has not been used|is disabled/i.test(message)) {
      throw new Error("L'API Gmail n'est pas activée dans le projet Google Cloud (voir README).");
    }
    throw new Error(`Gmail : ${message}`);
  }
  return (await res.json()) as T;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const b64 = (s: string) => bytesToBase64(new TextEncoder().encode(s));
const b64url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function decodeB64url(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

// Message MIME en texte brut UTF-8 (sujet encodé RFC 2047, corps en base64)
export function buildMime(opts: { to: string; subject: string; body: string; inReplyTo?: string }): string {
  const headers = [
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${b64(opts.subject)}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
  const body = b64(opts.body).replace(/.{76}/g, "$&\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyTo?: string;
}): Promise<{ id: string; threadId: string }> {
  return call("/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: b64url(buildMime(opts)), ...(opts.threadId ? { threadId: opts.threadId } : {}) }),
  });
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

interface RawMessage {
  id: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
}

function findText(part: GmailPart | undefined, mime: string): string {
  if (!part) return "";
  if (part.mimeType === mime && part.body?.data) return decodeB64url(part.body.data);
  for (const p of part.parts ?? []) {
    const t = findText(p, mime);
    if (t) return t;
  }
  return "";
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n"), "text/html");
  return doc.body.textContent ?? "";
}

const header = (m: RawMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

export async function getMessageIdHeader(gmailId: string): Promise<string> {
  const m = await call<RawMessage>(`/messages/${gmailId}?format=metadata&metadataHeaders=Message-ID`);
  return header(m, "Message-ID");
}

export async function getThread(threadId: string): Promise<GmailMessage[]> {
  const t = await call<{ messages?: RawMessage[] }>(`/threads/${threadId}?format=full`);
  return (t.messages ?? []).map((m) => ({
    id: m.id,
    from: header(m, "From"),
    subject: header(m, "Subject"),
    date: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    body: (findText(m.payload, "text/plain") || htmlToText(findText(m.payload, "text/html"))).slice(0, 8000),
    mine: (m.labelIds ?? []).includes("SENT"),
  }));
}
