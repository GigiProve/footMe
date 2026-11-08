/**
 * Derivazioni pure del centro Partecipanti (DAS-REV-30 §21–§25, §29).
 *
 * Etichette, count contestuali, empty per filtro e copy delle conferme.
 * Qui sta ciò che la matrice QA verifica senza montare la schermata: quale
 * etichetta corrisponde a quale stato (Revocato ≠ Rifiutato, Rimosso ≠
 * Ritirato), quale empty compare, quale riga sparisce dal filtro dopo un
 * comando. Nessuna capability è dedotta qui: arrivano dal server.
 */
import { formatPosition, formatRole } from "../../../profiles/profile-display-helpers";
import { formatLongDate } from "../../invites/invites-presentation";
import type { ParticipationStatus } from "../detail/event-detail-types";
import type { ParticipantRow, ParticipantsFilter } from "./participants-types";

export const PARTICIPANTS_COPY = {
  title: "Partecipanti",
  search: "Cerca partecipante",
  filterTitle: "Mostra",
  filterA11y: (label: string) => `Filtro: ${label}`,
  loadError: "Impossibile caricare i partecipanti.",
  retry: "Riprova",
  noResults: "Nessun partecipante trovato",
  noResultsBody: "Prova a cercare con un altro nome.",
  manage: (name: string) => `Gestisci ${name}`,
  openProfile: (name: string) => `Apri il profilo di ${name}`,
  viewProfile: "Visualizza profilo",
  profileUnavailable: "Profilo non più disponibile",
  readOnly: "Le partecipazioni sono in sola lettura.",
  invitedOn: (date: string) => `Invito inviato · ${date}`,
  messageSent: "Messaggio inviato",
  revoke: "Revoca invito",
  revokeTitle: "Revocare l’invito?",
  revokeBody: (name: string) => `${name} non potrà più accettare questo invito.`,
  remove: "Rimuovi dall’evento",
  removeConfirm: "Rimuovi partecipante",
  removeTitle: (firstName: string) => `Rimuovere ${firstName} dall’evento?`,
  removeBody: (name: string) => `${name} non risulterà più tra i partecipanti confermati.`,
  removeMessageLabel: (firstName: string) => `Messaggio per ${firstName} — opzionale`,
  removePlaceholder: "Aggiungi un breve messaggio…",
  removeHelper: "Il messaggio verrà inviato insieme all’aggiornamento della partecipazione.",
  messageTooLong: (limit: number) => `Il messaggio può contenere al massimo ${limit} caratteri.`,
  cancel: "Annulla",
  updateError: "Impossibile aggiornare la partecipazione. Riprova.",
  invitationError: "Impossibile aggiornare l’invito. Riprova.",
  revoked: "Invito revocato.",
  removed: "Partecipante rimosso.",
  confirmed: "Partecipazione confermata.",
  rejected: "Richiesta non accettata.",
  changed: "La partecipazione è stata aggiornata. Controlla lo stato corrente.",
} as const;

/** §21: sette opzioni, in quest'ordine, a selezione singola. */
export const PARTICIPANTS_FILTERS: readonly { id: ParticipantsFilter; label: string }[] = [
  { id: "confirmed", label: "Confermati" },
  { id: "pending", label: "Richieste in attesa" },
  { id: "invited", label: "Inviti inviati" },
  { id: "rejected", label: "Non accettate" },
  { id: "declined", label: "Inviti rifiutati" },
  { id: "withdrawn", label: "Ritirati" },
  { id: "all", label: "Tutti" },
];

export function filterLabel(filter: ParticipantsFilter): string {
  return PARTICIPANTS_FILTERS.find((option) => option.id === filter)?.label ?? "Confermati";
}

/**
 * §22: «Mapping label». Otto stati, otto etichette: Revocato non è
 * Rifiutato, Rimosso non è Ritirato (§21).
 */
export const PARTICIPANT_STATUS_LABELS: Record<ParticipationStatus, string> = {
  confirmed: "Confermato",
  pending: "Richiesta in attesa",
  invited: "Invito inviato",
  rejected: "Non accettata",
  declined: "Invito rifiutato",
  withdrawn: "Ritirato",
  revoked: "Invito revocato",
  removed: "Rimosso dall’evento",
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** §21: «Count leggero contestuale: “32 partecipanti”, “8 richieste”, “12 inviti”». */
export function countLabel(filter: ParticipantsFilter, total: number): string {
  switch (filter) {
    case "confirmed":
      return plural(total, "partecipante", "partecipanti");
    case "pending":
      return plural(total, "richiesta", "richieste");
    case "invited":
      return plural(total, "invito", "inviti");
    case "rejected":
      return plural(total, "richiesta non accettata", "richieste non accettate");
    case "declined":
      return plural(total, "invito rifiutato", "inviti rifiutati");
    case "withdrawn":
      return plural(total, "ritirato", "ritirati");
    case "all":
    default:
      return plural(total, "profilo", "profili");
  }
}

/**
 * §29: empty valido, distinto dall'errore. Con una ricerca attiva il vuoto
 * dice che la ricerca non trova, non che l'evento è senza partecipanti.
 */
export function emptyCopy(filter: ParticipantsFilter, hasQuery: boolean): { body: string | null; title: string } {
  if (hasQuery) {
    return { body: PARTICIPANTS_COPY.noResultsBody, title: PARTICIPANTS_COPY.noResults };
  }

  switch (filter) {
    case "confirmed":
      return { body: "I profili confermati compariranno qui.", title: "Nessun partecipante confermato" };
    case "pending":
      return { body: "Le nuove richieste di partecipazione compariranno qui.", title: "Nessuna richiesta in attesa" };
    case "invited":
      return { body: "Gli inviti in attesa di risposta compariranno qui.", title: "Nessun invito inviato" };
    case "rejected":
      return { body: null, title: "Nessuna richiesta non accettata" };
    case "declined":
      return { body: null, title: "Nessun invito rifiutato" };
    case "withdrawn":
      return { body: null, title: "Nessun ritiro" };
    case "all":
    default:
      return { body: null, title: "Nessun profilo collegato all’evento" };
  }
}

/**
 * Screen 23, §19: lo stato dell'evento prevale sulle azioni. Concluso,
 * annullato o iniziato: storico leggibile, nessuna mutation.
 */
export function readOnlyNotice(
  status: "draft" | "published" | "completed" | "cancelled",
): { body: string; title: string } {
  if (status === "completed") {
    return { body: "L’evento non è più aperto.", title: "Evento concluso" };
  }

  if (status === "cancelled") {
    return { body: "L’evento è stato annullato.", title: "Evento annullato" };
  }

  return { body: PARTICIPANTS_COPY.readOnly, title: "Evento iniziato" };
}

/** «Attaccante» per un Calciatore, altrimenti il ruolo (§22: contesto mostrabile). */
export function participantSubtitle(row: Pick<ParticipantRow, "primaryPosition" | "role">): string | null {
  if (row.primaryPosition) {
    return formatPosition(row.primaryPosition);
  }

  return row.role ? formatRole(row.role) : null;
}

/**
 * La riga dopo un comando riuscito: se ha cambiato stato non appartiene più
 * al filtro corrente e va tolta subito (§21: «mutation aggiorna lista/count
 * e toglie l'elemento dal filtro se ha cambiato stato»). Il refetch
 * successivo riallinea i count dal server.
 */
export function belongsToFilter(status: ParticipationStatus, filter: ParticipantsFilter): boolean {
  return filter === "all" || status === filter;
}

/** «Invito inviato · 24 settembre 2026» (screen 14). */
export function invitedOnLine(invitedAt: string | null): string | null {
  const date = formatLongDate(invitedAt);

  return date ? PARTICIPANTS_COPY.invitedOn(date) : null;
}

/** Solo spazi → null; il server applica la stessa regola. */
export function normalizeMessage(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function messageError(value: string, limit: number): string | null {
  const normalized = normalizeMessage(value);

  return normalized && normalized.length > limit ? PARTICIPANTS_COPY.messageTooLong(limit) : null;
}
