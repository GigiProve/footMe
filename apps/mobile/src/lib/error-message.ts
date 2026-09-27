/**
 * Messaggio leggibile da un errore di origine sconosciuta.
 *
 * Serve perché gli errori di Supabase non sono istanze di `Error`: PostgREST
 * restituisce un oggetto semplice `{ message, details, hint, code }` e un
 * controllo `error instanceof Error` lo scarta, mostrando all'utente un
 * fallback generico al posto della causa vera.
 *
 * Restituisce `null` quando non c'è nulla di leggibile: chi chiama decide il
 * testo di ripiego.
 */
export function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message.trim() || null;
  }

  if (typeof error === "string") {
    return error.trim() || null;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };

  // `hint` porta spesso la correzione suggerita da Postgres: va mostrato.
  const parts = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);

  if (parts.length === 0) {
    return null;
  }

  const code = typeof candidate.code === "string" ? candidate.code.trim() : "";

  return code ? `${parts.join(" · ")} [${code}]` : parts.join(" · ");
}
