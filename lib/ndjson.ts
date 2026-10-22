// Lit un flux NDJSON renvoyé par les routes /api/* et appelle onEvent pour chaque ligne.
export async function readNdjson<T>(response: Response, onEvent: (event: T) => void) {
  if (!response.ok || !response.body) {
    let message = `Erreur ${response.status}`;
    try {
      message = ((await response.json()) as { error?: string }).error ?? message;
    } catch {}
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as T);
    }
  }
}
