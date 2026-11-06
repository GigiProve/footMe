/**
 * Copy e funzioni pure del collegamento Persona–Società (§45).
 *
 * Tutta la copy sta qui, in un posto solo: lo stesso codice di errore compare
 * in schermate diverse con parole diverse, e §45 vieta di mostrare «stack
 * trace, HTTP 403/500, SQL o ID tecnici».
 *
 * Le funzioni sono pure e prendono `now` come parametro dove serve: la
 * verifica visuale di §54 fissa l'istante di test, e un formatter legato
 * all'orologio del dispositivo non sarebbe verificabile.
 */
import type { RoleLinkErrorCode } from "./role-link-service";
import type {
  RoleProfileType,
  RoleRequestStatus,
  RoleScopeType,
} from "./role-link-types";

export const ROLE_LINK_COPY = {
  // Screen 01 — blocco sul profilo Società
  blockTitle: "Fai parte di questa società?",
  blockAction: "Richiedi conferma del ruolo",
  blockPending: "Conferma in attesa",
  blockPendingMany: (count: number) => `${count} richieste in attesa`,
  blockManage: "Gestisci i tuoi ruoli",

  // Screen 02-05 — form
  requestTitle: "Richiedi conferma del ruolo",
  requestHelper: "Indica il ruolo che ricopri già nella società.",
  requestFooter: (club: string) => `${club} dovrà confermare il ruolo.`,
  profileFieldLabel: "Profilo",
  roleFieldLabel: "Ruolo",
  customRoleFieldLabel: "Specifica il ruolo",
  teamFieldLabel: "Squadra",
  scopeFieldLabel: "Ambito",
  roleTypeFieldLabel: "Tipo di ruolo",
  societyScope: "Intera società",
  teamScope: "Una squadra specifica",
  continueLabel: "Continua",

  // Screen 03 — selector
  teamSheetTitle: "Seleziona squadra",
  roleSheetTitle: "Seleziona ruolo",
  roleTypeSheetTitle: "Seleziona il tipo di ruolo",
  scopeSheetTitle: "Seleziona ambito",
  profileSheetTitle: "Seleziona profilo",
  confirmLabel: "Conferma",

  // Screen 06 — riepilogo
  reviewTitle: "Controlla la richiesta",
  reviewHelper: (club: string) =>
    `Il ruolo sarà attivo dopo la conferma di ${club}.`,
  reviewEdit: "Modifica",
  submit: "Invia richiesta",
  submitted: "Richiesta inviata",
  submittedBody: "Ti avviseremo quando la società avrà risposto.",

  // Screen 07-08 — la propria richiesta
  myRequestTitle: "Richiesta di conferma del ruolo",
  pendingState: "Conferma in attesa",
  pendingHelper: (club: string) => `${club} deve ancora rispondere.`,
  cancelRequest: "Annulla richiesta",
  cancelSheetTitle: "Annullare la richiesta?",
  cancelSheetBody: (club: string) =>
    `${club} non potrà più confermare questa richiesta.`,
  cancelBack: "Indietro",
  cancelled: "Richiesta annullata",
  cancelledState: "Richiesta annullata",
  declinedState: "Richiesta rifiutata",
  approvedState: "Richiesta approvata",
  supersededState: "Collegamento completato tramite un altro percorso",
  notApprovable: "Richiesta non più approvabile",
  notApprovableBody: "La squadra indicata nella richiesta non è più disponibile.",

  // Screen 09-12 — decisione societaria
  roleToConfirm: "Ruolo da confermare",
  viewProfile: "Visualizza profilo",
  approve: "Approva",
  decline: "Rifiuta",
  declineSheetTitle: "Rifiutare la richiesta?",
  declineSheetBody: (person: string, role: string, context: string | null) =>
    context
      ? `${person} non verrà confermato come ${role} della ${context}.`
      : `${person} non verrà confermato come ${role}.`,
  declineConfirm: "Rifiuta richiesta",
  cancelLabel: "Annulla",
  approvedTitle: "Richiesta approvata",
  approvedBody: (person: string, role: string, context: string | null) =>
    context === "Intera società"
      ? `${person} è collegato come ${role} per l'intera società.`
      : context
        ? `${person} è collegato come ${role} della ${context}.`
        : `${person} è collegato come ${role}.`,
  close: "Chiudi",

  // Screen 13-15 — Società e ruoli
  societiesTitle: "Società e ruoli",
  societiesHelper: "Gestisci i tuoi incarichi nelle società.",
  societiesEmpty: "Non hai società collegate",
  societiesEmptyBody:
    "Quando una società conferma un tuo ruolo, lo trovi qui.",
  searchClub: "Cerca una società",
  rolesHeading: "I tuoi ruoli",
  addRole: "Aggiungi un altro ruolo",
  leaveSociety: "Scollegati dalla società",
  assignmentHelper: "Le azioni riguardano questo incarico.",
  editRole: "Modifica ruolo",
  removeRole: "Rimuovi ruolo",

  // Screen 16-17 — form condiviso
  editTitle: "Modifica ruolo nella società",
  addTitle: "Aggiungi un altro ruolo",
  addTitleSociety: "Aggiungi ruolo",
  saveChanges: "Salva modifiche",
  addSubmit: "Aggiungi ruolo",
  editHelperPerson: (club: string) =>
    `La modifica sarà attiva subito. ${club} riceverà una notifica.`,
  editHelperSociety: (person: string) =>
    `La modifica sarà attiva subito. ${person} riceverà una notifica.`,
  addHelper: "Gli altri ruoli resteranno attivi.",
  roleUpdated: "Ruolo aggiornato",
  roleAdded: "Ruolo aggiunto",
  roleRemoved: "Ruolo rimosso",
  roleRestored: "Ruolo ripristinato",

  // Screen 19-20 — conferme personali
  removeRoleSheetTitle: "Rimuovere questo ruolo?",
  leaveSheetTitle: (club: string) => `Scollegarti da ${club}?`,
  leaveSheetBody: (club: string) =>
    `Tutti i tuoi ruoli attivi con ${club} verranno terminati.`,
  leaveSheetKeep: "Il tuo account, la carriera e i contenuti resteranno disponibili.",
  leaveConfirm: "Scollegati",

  // Screen 21-24 — lato Società
  societyRolesHeading: (club: string) => `Ruoli in ${club}`,
  addRoleSociety: "Aggiungi ruolo",
  removeFromSociety: "Rimuovi dalla società",
  removeSheetTitle: (person: string) => `Rimuovere ${person} dalla società?`,
  removeSheetBody: (club: string) =>
    `Tutti i suoi ruoli attivi con ${club} verranno terminati.`,
  removeSheetKeep: "Account, carriera e contenuti resteranno disponibili.",
  personUpdatedRole: (first: string) => `${first} ha aggiornato questo ruolo.`,
  restorePrevious: "Ripristina ruolo precedente",
  back: "Indietro",
  terminatedTitle: "Rapporto terminato",
  terminatedBody: (person: string, club: string) =>
    `${person} non ha più ruoli attivi con ${club}.`,
  terminatedHelper: "Il suo profilo resta disponibile.",
  terminatedSelf: (club: string) => `Non hai più ruoli attivi con ${club}.`,

  // Uscita da un form con modifiche
  exitTitle: "Uscire senza salvare?",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitKeep: "Continua a modificare",
  exitLeave: "Esci senza salvare",
} as const;

/** §45: l'elenco dei messaggi da localizzare, con i parametri reali. */
export function roleLinkErrorMessage(
  code: RoleLinkErrorCode,
  context?: { club?: string | null },
): string {
  const club = context?.club ?? "la società";

  switch (code) {
    case "ASSIGNMENT_TEAM_REQUIRED":
    case "ROLE_REQUEST_TEAM_REQUIRED":
      return "Seleziona una squadra.";
    case "ASSIGNMENT_ROLE_INVALID":
    case "ROLE_REQUEST_ROLE_INVALID":
      return "Seleziona un ruolo.";
    case "ASSIGNMENT_CUSTOM_ROLE_REQUIRED":
      return "Specifica il ruolo.";
    case "ASSIGNMENT_SCOPE_INVALID":
    case "ROLE_REQUEST_SCOPE_INVALID":
      return "Seleziona un ambito.";
    case "ASSIGNMENT_CUSTOM_ROLE_TOO_LONG":
      return "Controlla il ruolo inserito.";
    case "ASSIGNMENT_TEAM_UNAVAILABLE":
    case "ROLE_REQUEST_TEAM_UNAVAILABLE":
    case "ASSIGNMENT_RESTORE_TEAM_UNAVAILABLE":
    case "TEAM_NOT_ACTIVE":
      return "La squadra selezionata non è più disponibile.";
    case "ROLE_REQUEST_DUPLICATE":
      return "Hai già una richiesta in attesa per questo ruolo.";
    case "ROLE_REQUEST_INVITE_EXISTS":
      return `Hai già ricevuto un invito da ${club} per questo ruolo.`;
    case "ROLE_REQUEST_ALREADY_ASSIGNED":
    case "ASSIGNMENT_ALREADY_PRESENT":
      return "Questo ruolo è già presente nella società.";
    case "ROLE_REQUEST_NOT_FOUND":
      return "Richiesta non più approvabile.";
    case "ROLE_REQUEST_REVISION_CONFLICT":
      return "La richiesta è già stata aggiornata.";
    case "ASSIGNMENT_REVISION_CONFLICT":
    case "ASSIGNMENT_NOT_ACTIVE":
      return "Questo ruolo è stato aggiornato. Controlla i dati prima di salvare.";
    case "ROLE_LINK_COMPOSITION_CHANGED":
      return "I ruoli sono cambiati. Controlla il riepilogo prima di continuare.";
    case "ROLE_LINK_NOT_ACTIVE":
      return "Il rapporto con questa società non è più attivo.";
    case "ASSIGNMENT_RESTORE_NOT_AVAILABLE":
      return "Il ruolo precedente non può più essere ripristinato.";
    case "OPERATION_CONTENT_CHANGED":
      return "I dati sono cambiati dopo l'ultimo tentativo. Controllali e riprova.";
    default:
      return "Non è stato possibile caricare i dati. Riprova.";
  }
}

export const ROLE_LINK_FAILURES = {
  create: "Non è stato possibile inviare la richiesta. Riprova.",
  load: "Non è stato possibile caricare i dati. Riprova.",
  offline: "Connessione assente. Riprova quando sei online.",
  remove: "Non è stato possibile rimuovere il ruolo. Riprova.",
  save: "Non è stato possibile salvare il ruolo. Riprova.",
  terminate: "Non è stato possibile terminare il rapporto. Riprova.",
  updateRequest: "Non è stato possibile aggiornare la richiesta. Riprova.",
} as const;

const PROFILE_LABELS: Record<RoleProfileType, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

export function profileTypeLabel(type: RoleProfileType | null): string {
  return type ? PROFILE_LABELS[type] : "";
}

/**
 * §26: «riepilogo reale del ruolo singolo oppure conteggio 2 ruoli attivi».
 * Il numero viene dai dati, non da una label statica (§27).
 */
export function societySummary(input: {
  activeCount: number;
  roleLines: readonly string[];
}): string {
  if (input.activeCount === 1 && input.roleLines[0]) {
    return input.roleLines[0];
  }

  return `${input.activeCount} ruoli attivi`;
}

/** §27: «eventuali due righe di contesto». Non di più: la riga ha un limite. */
export const SOCIETY_CONTEXT_LINES = 2;

export function societyContextLines(
  roleLines: readonly string[],
  activeCount: number,
): string[] {
  return activeCount > 1 ? roleLines.slice(0, SOCIETY_CONTEXT_LINES) : [];
}

/**
 * §35: «Il riferimento agli altri due ruoli è proprio della fixture. In
 * produzione usa il numero reale quando opportuno e autorizzato; se non
 * esistono altri ruoli, avvisa che non rimarranno incarichi attivi con la
 * società. Non promettere la conservazione di ruoli inesistenti.»
 */
export function removeRoleSheetBody(input: {
  actorSide: "person" | "society";
  clubName: string;
  contextLabel: string | null;
  otherActiveCount: number;
  personFirstName?: string;
  roleLabel: string;
}): { body: string; note: string } {
  const subject =
    input.actorSide === "person"
      ? "Non risulterai più come"
      : `${input.personFirstName ?? "La persona"} non risulterà più come`;

  const where =
    input.contextLabel === "Intera società"
      ? `per l'intera società di ${input.clubName}`
      : input.contextLabel
        ? `della ${input.contextLabel} di ${input.clubName}`
        : `in ${input.clubName}`;

  const note =
    input.otherActiveCount === 0
      ? input.actorSide === "person"
        ? `Non ti resteranno ruoli attivi con ${input.clubName}.`
        : `Non le resteranno ruoli attivi con ${input.clubName}.`
      : input.otherActiveCount === 1
        ? "L'altro ruolo resterà attivo."
        : `Gli altri ${input.otherActiveCount} ruoli resteranno attivi.`;

  return { body: `${subject} ${input.roleLabel} ${where}.`, note };
}

/** §11 e §24: lo stato di una richiesta, con tono neutro (§5). */
export function requestStateLabel(status: RoleRequestStatus): string {
  switch (status) {
    case "pending":
      return ROLE_LINK_COPY.pendingState;
    case "approved":
      return ROLE_LINK_COPY.approvedState;
    case "declined":
      return ROLE_LINK_COPY.declinedState;
    case "cancelled":
      return ROLE_LINK_COPY.cancelledState;
    default:
      return ROLE_LINK_COPY.supersededState;
  }
}

/** Etichetta dell'ambito nel riepilogo e nelle righe read-only. */
export function scopeLabel(
  scope: RoleScopeType,
  contextLabel: string | null,
): string {
  return scope === "society"
    ? ROLE_LINK_COPY.societyScope
    : (contextLabel ?? "");
}

/**
 * Prima parola del nome, per l'helper «Mario ha aggiornato questo ruolo.»
 * (§33). Se il nome è di una parola sola resta intero: tagliarlo
 * produrrebbe una frase su una persona diversa.
 */
export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(" ");

  return space > 0 ? trimmed.slice(0, space) : trimmed;
}

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export function formatLongDate(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
