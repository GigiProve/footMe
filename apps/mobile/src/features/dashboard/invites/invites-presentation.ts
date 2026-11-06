/**
 * Copy e funzioni pure del pack Inviti (§38).
 *
 * Tutta la copy sta qui, in un posto solo: lo stesso codice di errore compare
 * in schermate diverse con parole diverse, e §38 vieta di mostrare «stack
 * trace, codici HTTP, null, undefined, ID o nomi di errori tecnici».
 *
 * Le funzioni sono pure e prendono `now` come parametro, perché la verifica
 * visuale di §44 fissa l'istante di test e un formatter legato all'orologio
 * del dispositivo non sarebbe verificabile.
 */
import type { InvitesErrorCode } from "./invites-service";
import type {
  InviteFilterTeam,
  InviteRecordState,
  InviteScopeType,
  InvitesFilter,
  InvitesTab,
} from "./invites-types";

export const INVITES_COPY = {
  centerTitle: "Inviti e richieste",
  invitePerson: "Invita persona",
  allScopes: "Tutti gli ambiti",
  pendingSection: "In attesa",
  recentSection: "Recenti",
  newBadge: "Nuova",
  societyScope: "Intera società",

  // Composer
  searchTitle: "Invita persona",
  searchHelper: "Cerca una persona già registrata su PROLINK.",
  searchPlaceholder: "Nome e cognome",
  searchEmpty: "Nessun profilo trovato",
  searchEmptyBody: "Controlla il nome e riprova.",
  searchError: "Non è stato possibile cercare i profili. Riprova.",
  configureTitle: "Collegamento",
  roleFieldLabel: "Ruolo nella struttura",
  customRoleFieldLabel: "Specifica il ruolo",
  teamFieldLabel: "Squadra",
  scopeFieldLabel: "Ambito",
  noTeams: "Nessuna squadra disponibile",
  reviewTitle: "Riepilogo",
  personSection: "Persona",
  linkSection: "Collegamento",
  reviewConsent: "Il collegamento si attiva dopo l'accettazione.",
  editLink: "Modifica collegamento",
  submit: "Invia invito",
  continueLabel: "Continua",
  cancelFlow: "Annulla",
  exitTitle: "Uscire dall'invito?",
  exitBody: "Le informazioni inserite andranno perse.",
  exitKeep: "Continua a modificare",
  exitLeave: "Esci",

  // Destinatario
  receivedTitle: "Invito ricevuto",
  proposedSection: "Collegamento proposto",
  receivedConsent:
    "Accettando, il collegamento verrà associato al tuo profilo PROLINK.",
  accept: "Accetta invito",
  acceptConfirm: "Accetta",
  acceptConfirmTitle: "Accetta invito",
  decline: "Rifiuta",
  acceptedTitle: "Invito accettato",
  acceptedHeadline: "Collegamento confermato",
  goToProfile: "Vai al profilo",
  declinedTitle: "Invito rifiutato",
  declinedBody: "Non verrà creato alcun collegamento per questo incarico.",
  declineConfirmTitle: "Rifiuta invito",
  close: "Chiudi",
  unavailableTitle: "Invito non più disponibile",
  noLongerAcceptable:
    "Questo invito non può più essere accettato. La società potrà inviartene uno nuovo.",
  detailError: "Non è stato possibile caricare l'invito. Riprova.",

  // Società — dettaglio e annullamento
  sentTitle: "Invito inviato",
  requestTitle: "Richiesta ricevuta",
  cancelInvite: "Annulla invito",
  keepInvite: "Mantieni invito",
  cancelConfirmBody: "L'invito non potrà più essere accettato.",

  // Filtro
  filterTitle: "Filtra per squadra",
  filterHelper: "Scegli una o più squadre.",
  apply: "Applica",
  editFilter: "Modifica filtro",

  // Esiti
  sentFeedback: "Invito inviato",
  scopeChanged: "Il tuo perimetro è cambiato.",
  offlineBody: "Connessione assente. Riprova quando sei online.",
  nextPageError: "Non siamo riusciti a caricare altri risultati.",
} as const;

export const INVITE_TABS = [
  { label: "Inviti inviati", value: "sent" },
  { label: "Richieste ricevute", value: "received" },
] as const;

const STATE_LABELS: Record<InviteRecordState, string> = {
  accepted: "Accettato",
  approved: "Approvato",
  cancelled: "Annullato",
  declined: "Rifiutato",
  pending: "In attesa",
};

/**
 * §5: «Stato dell'invito/richiesta: label neutra e leggibile; nessun badge
 * verde per Accettato o Approvata.» È testo, e questa funzione produce solo
 * testo.
 */
export function stateLabel(state: InviteRecordState): string {
  return STATE_LABELS[state];
}

const SHORT_MONTHS = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
] as const;

const LONG_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * «Oggi», «Ieri», «24 set 2026» (master 01, 02).
 *
 * Oggi e Ieri sono relativi all'orologio locale di chi guarda, non a quello
 * del server: è il significato che il lettore attribuisce a quelle parole.
 * Una data non interpretabile torna `null`, e la riga omette il campo invece
 * di stampare una stringa ISO.
 */
export function formatRowDate(
  value: string | null,
  now: Date = new Date(),
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = startOfDay(now);
  const day = startOfDay(date);
  const oneDay = 24 * 60 * 60 * 1000;

  if (day === today) {
    return "Oggi";
  }

  if (day === today - oneDay) {
    return "Ieri";
  }

  const month = SHORT_MONTHS[date.getMonth()];

  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : null;
}

/** «24 settembre 2026» (master 12). Lo storico porta sempre l'anno. */
export function formatLongDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const month = LONG_MONTHS[date.getMonth()];

  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : null;
}

/**
 * «Calciatore · Prima squadra» (§12).
 *
 * «Evita ripetizioni inutili del ruolo»: il contesto non viene ripetuto se
 * coincide con il ruolo, e una riga senza contesto non stampa il separatore
 * orfano.
 */
export function contextLine(input: {
  contextLabel: string | null;
  roleLabel: string;
}): string {
  const context =
    input.contextLabel && input.contextLabel !== input.roleLabel
      ? input.contextLabel
      : null;

  return context ? `${input.roleLabel} · ${context}` : input.roleLabel;
}

/** «In attesa · 24 set 2026». Senza data affidabile resta il solo stato. */
export function stateLine(
  input: { state: InviteRecordState; stateAt: string | null },
  now: Date = new Date(),
): string {
  const date = formatRowDate(input.stateAt, now);

  return date ? `${stateLabel(input.state)} · ${date}` : stateLabel(input.state);
}

// ── Filtro multiselezione (§14) ────────────────────────────────────────────

/**
 * Applica un tocco su una casella e **normalizza** il risultato.
 *
 * Tre regole di §14 in una funzione, perché separarle le farebbe divergere:
 *   · «Selezionare un Team deseleziona Tutti gli ambiti»;
 *   · «scegliere Tutti gli ambiti azzera la restrizione specifica»;
 *   · «Se vengono deselezionate tutte le squadre, normalizza alla scelta
 *     generale prima di applicare, rendendola visivamente selezionata».
 *
 * La normalizzazione avviene nello stato temporaneo dello sheet, non al
 * momento di Applica: §14 vuole che la scelta generale appaia selezionata
 * **mentre** si guarda, non dopo.
 */
export function toggleFilterTeam(
  filter: InvitesFilter,
  teamId: string | null,
): InvitesFilter {
  if (teamId === null) {
    return { kind: "all" };
  }

  const current = filter.kind === "teams" ? filter.teamIds : [];
  const next = current.includes(teamId)
    ? current.filter((id) => id !== teamId)
    : [...current, teamId];

  return next.length === 0 ? { kind: "all" } : { kind: "teams", teamIds: next };
}

export function isTeamSelected(filter: InvitesFilter, teamId: string): boolean {
  return filter.kind === "teams" && filter.teamIds.includes(teamId);
}

export function sameFilter(a: InvitesFilter, b: InvitesFilter): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind !== "teams" || b.kind !== "teams") {
    return true;
  }

  return (
    a.teamIds.length === b.teamIds.length &&
    [...a.teamIds].sort().join(",") === [...b.teamIds].sort().join(",")
  );
}

/**
 * «Tutti gli ambiti», «Under 15», «2 squadre selezionate» (§14).
 *
 * I nomi arrivano dalle opzioni autorizzate, non dal filtro: un Team che non
 * è più nel perimetro non deve poter stampare il proprio nome. Con più di due
 * squadre si passa al conteggio, perché §14 chiede nomi «se lo spazio lo
 * consente» e tre nomi non ci stanno sulla riga.
 */
export function filterSummary(
  filter: InvitesFilter,
  teams: readonly InviteFilterTeam[],
): string {
  if (filter.kind === "all") {
    return INVITES_COPY.allScopes;
  }

  const labels = filter.teamIds
    .map((id) => teams.find((team) => team.teamId === id)?.label)
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) {
    return INVITES_COPY.allScopes;
  }

  return labels.length <= 2
    ? labels.join(", ")
    : `${labels.length} squadre selezionate`;
}

/**
 * §14: «Nessuno scope si allarga se una squadra non è più disponibile:
 * rimuovere una restrizione non più autorizzata non deve passare
 * silenziosamente a Tutti gli ambiti.»
 *
 * Restituisce le squadre ancora autorizzate fra quelle selezionate. Quando
 * non ne resta nessuna, il chiamante chiede una nuova scelta invece di
 * ricadere su `all`.
 */
export function retainAuthorizedTeams(
  filter: InvitesFilter,
  teams: readonly InviteFilterTeam[],
): { kept: string[]; lost: boolean } {
  if (filter.kind === "all") {
    return { kept: [], lost: false };
  }

  const authorized = new Set(teams.map((team) => team.teamId));
  const kept = filter.teamIds.filter((id) => authorized.has(id));

  return { kept, lost: kept.length !== filter.teamIds.length };
}

// ── Validazione del composer (§22, §38) ────────────────────────────────────

/* Caratteri di controllo e markup: la stessa classe che
   `normalize_assignment_custom_role` rimuove lato server (§20). */
const UNSAFE_CUSTOM_ROLE = /[\u0000-\u001F\u007F<>]/g;

/**
 * Normalizzazione del ruolo custom, identica a quella del server (§20).
 *
 * Due implementazioni diverse farebbero un form che accetta ciò che la RPC
 * rifiuta: la regola è una sola — niente caratteri di controllo, niente
 * `<` e `>`, spazi compattati, estremi tagliati.
 */
export function normalizeCustomRole(value: string): string {
  return value.replace(UNSAFE_CUSTOM_ROLE, " ").replace(/\s+/g, " ").trim();
}

export type ComposerField = "person" | "role" | "customRole" | "team" | "scope";

export const FIELD_ERRORS: Record<ComposerField, string> = {
  customRole: "Specifica il ruolo.",
  person: "Seleziona una persona.",
  role: "Seleziona un ruolo.",
  scope: "Seleziona un ambito.",
  team: "Seleziona una squadra.",
};

/**
 * §22: «Continua disabilitata solo quando la validità nota non consente di
 * proseguire», e §38 vuole gli errori vicino ai campi. La funzione produce
 * l'elenco dei campi incompleti; quando mostrarli lo decide la schermata,
 * perché §22 vieta di mostrare errori «prima che l'utente abbia interagito».
 */
export function missingConfigureFields(input: {
  customRole: string;
  customRoleMax: number;
  isCustomRole: boolean;
  needsScopeChoice: boolean;
  roleId: string | null;
  scopeType: InviteScopeType | null;
  teamId: string | null;
}): ComposerField[] {
  const missing: ComposerField[] = [];

  if (!input.roleId) {
    missing.push("role");
  }

  if (input.isCustomRole) {
    const normalized = normalizeCustomRole(input.customRole);

    if (normalized.length === 0 || normalized.length > input.customRoleMax) {
      missing.push("customRole");
    }
  }

  if (input.needsScopeChoice && !input.scopeType) {
    missing.push("scope");
  }

  if (input.scopeType === "team" && !input.teamId) {
    missing.push("team");
  }

  return missing;
}

// ── Frasi del destinatario (§29, §31) ──────────────────────────────────────

/**
 * «ad AC Como», «a Milan»: la d eufonica davanti a vocale.
 *
 * Il master scrive «ad AC Como». La regola applicata è la vocale iniziale,
 * che copre i casi del mockup senza una tabella di eccezioni.
 */
function toClub(clubName: string): string {
  const first = clubName.trim().charAt(0).toLocaleLowerCase("it-IT");

  return /[aeiou]/.test(first) ? `ad ${clubName}` : `a ${clubName}`;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLocaleLowerCase("it-IT") + value.slice(1);
}

/**
 * «Verrai collegato ad AC Como come Calciatore della Prima squadra.»
 * «… come Direttore sportivo dell'intera società.»
 *
 * §29 chiede «template localizzati, non concatenazioni fragili»: le due
 * varianti sono due frasi intere, e la preposizione corretta («della prima
 * squadra» / «dell'intera società») è parte della frase, non il risultato di
 * un incollaggio.
 */
export function linkSentence(input: {
  clubName: string;
  past?: boolean;
  roleLabel: string;
  scopeType: InviteScopeType;
  teamName: string | null;
}): string {
  const subject = input.past
    ? `Sei collegato ${toClub(input.clubName)}`
    : `Verrai collegato ${toClub(input.clubName)}`;

  if (input.scopeType === "society") {
    return `${subject} come ${input.roleLabel} dell'intera società.`;
  }

  return input.teamName
    ? `${subject} come ${input.roleLabel} della ${lowerFirst(input.teamName)}.`
    : `${subject} come ${input.roleLabel}.`;
}

/** «Non verrai collegato ad AC Como per questo incarico.» (§32) */
export function declineSentence(clubName: string): string {
  return `Non verrai collegato ${toClub(clubName)} per questo incarico.`;
}

/** «AC Como ti invita a collegarti alla società.» (§28) */
export function invitationSentence(clubName: string): string {
  return `${clubName} ti invita a collegarti alla società.`;
}

/** «AC Como ha annullato questo invito.» (§33) */
export function cancelledByClubSentence(clubName: string): string {
  return `${clubName} ha annullato questo invito.`;
}

/** «Annullare l'invito a Mario Rossi?» (§26) */
export function cancelQuestion(personName: string): string {
  return `Annullare l'invito a ${personName}?`;
}

/** «Mario Rossi riceverà l'invito su PROLINK.» (§24) */
export function sentFeedbackBody(personName: string): string {
  return `${personName} riceverà l'invito su PROLINK.`;
}

/** «Accettato il 24 settembre 2026» (master 12). */
export function resolutionLine(
  state: InviteRecordState,
  resolvedAt: string | null,
): string | null {
  const date = formatLongDate(resolvedAt);

  return date ? `${stateLabel(state)} il ${date}` : null;
}

// ── Stati vuoti ed errori (§38) ────────────────────────────────────────────

export function emptyCopy(input: {
  filtered: boolean;
  tab: InvitesTab;
}): { body: string; title: string } {
  if (input.filtered) {
    return {
      body: "Modifica il filtro per vedere altri risultati.",
      title:
        input.tab === "sent"
          ? "Nessun invito per le squadre selezionate"
          : "Nessuna richiesta per le squadre selezionate",
    };
  }

  return input.tab === "sent"
    ? {
        body: "Gli inviti inviati dalla società compariranno qui.",
        title: "Nessun invito inviato",
      }
    : {
        /* §38: «Nessuna CTA artificiale per crearne una.» Una richiesta la
           avvia la persona, non la Società. */
        body: "Le richieste di collegamento alla società compariranno qui.",
        title: "Nessuna richiesta ricevuta",
      };
}

export function listErrorCopy(tab: InvitesTab): string {
  return tab === "sent"
    ? "Non siamo riusciti a caricare gli inviti. Riprova."
    : "Non siamo riusciti a caricare le richieste. Riprova.";
}

const MUTATION_ERRORS: Partial<Record<InvitesErrorCode, string>> = {
  INVITE_ALREADY_ACCEPTED: "L'invito è già stato accettato.",
  INVITE_ALREADY_LINKED:
    "Questa persona è già collegata alla società per questo incarico.",
  INVITE_ALREADY_PENDING: "Hai già invitato questa persona per questo incarico.",
  INVITE_ALREADY_RESOLVED: "Questo invito è già stato chiuso.",
  INVITE_CUSTOM_ROLE_REQUIRED: FIELD_ERRORS.customRole,
  INVITE_NOT_ACCEPTABLE:
    "Questo invito non può più essere accettato. La società potrà inviartene uno nuovo.",
  INVITE_RECIPIENT_INELIGIBLE:
    "Questo profilo non è più disponibile per l'invito.",
  INVITE_RECIPIENT_INVALID: "Questo profilo non è più disponibile per l'invito.",
  INVITE_REQUEST_PENDING: "Questa persona ha già una richiesta in attesa.",
  INVITE_REVISION_CONFLICT: "L'invito è cambiato. Ricaricalo e riprova.",
  INVITE_TEAM_UNAVAILABLE:
    "Questa squadra non è più disponibile. Selezionane un'altra.",
  RATE_LIMIT: "Hai inviato troppi inviti. Riprova più tardi.",
  TEAM_NOT_ACTIVE: "Questa squadra non è più disponibile. Selezionane un'altra.",
};

/**
 * Messaggio di una mutazione fallita. Il fallback è per operazione, non
 * generico: §38 ha una copy diversa per invio, risposta e annullamento.
 */
export function mutationErrorCopy(
  code: InvitesErrorCode,
  operation: "create" | "cancel" | "respond",
): string {
  const specific = MUTATION_ERRORS[code];

  if (specific) {
    return specific;
  }

  if (operation === "create") {
    return "Non è stato possibile inviare l'invito. Riprova.";
  }

  if (operation === "cancel") {
    return "Non è stato possibile annullare l'invito. Riprova.";
  }

  return "Non è stato possibile completare l'operazione. Riprova.";
}
