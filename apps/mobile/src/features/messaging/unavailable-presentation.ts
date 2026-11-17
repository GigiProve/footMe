/**
 * Fallback focalizzato «conversazione non disponibile» (DAS-REV-34 §21, §22;
 * PNG 11 e 12). Derivazioni pure: copy per motivo, lettura del parametro di
 * route, destinazione di ritorno.
 *
 * Tre motivi, tre testi esatti: accesso revocato (11), gruppo eliminato (12) e
 * il caso neutro dei link storici e delle Push che il resolver respinge. Mai un
 * nome, una foto o un body della conversazione: il motivo basta (§22), e un
 * errore di rete non è mai un motivo (§21) perché non arriva qui. Nessun
 * «Riprova»: sulla risorsa eliminata sarebbe un tentativo senza prospettiva.
 */

export type UnavailableReason = "deleted" | "revoked" | "unavailable";

export const UNAVAILABLE_COPY: Record<
  UnavailableReason,
  { body: string | null; title: string }
> = {
  deleted: {
    body: "Questa conversazione non è più disponibile.",
    title: "Il gruppo è stato eliminato",
  },
  revoked: {
    body: "Non puoi più accedere alla conversazione.",
    title: "Non fai più parte di questo gruppo",
  },
  unavailable: {
    body: null,
    title: "Questa conversazione non è più disponibile.",
  },
};

export const UNAVAILABLE_BACK_LABEL = "Torna ai messaggi";

/** Parametro di route → motivo. Qualunque valore sconosciuto è il caso neutro: non rivela nulla. */
export function unavailableReasonOf(param: string | string[] | undefined): UnavailableReason {
  const value = Array.isArray(param) ? param[0] : param;

  return value === "revoked" || value === "deleted" ? value : "unavailable";
}

/** Motivo del fallback per una revoca osservata dalla chat aperta (use-group-chat-access). */
export function unavailableReasonForRevocation(reason: "deleted" | "ended"): UnavailableReason {
  return reason === "deleted" ? "deleted" : "revoked";
}
