/**
 * Copy e formattatori puri dei Link di invito (§5, §41).
 *
 * Tutta la lingua sta qui perché lo stesso dato compare in posti diversi con
 * parole diverse: `player` è «Giocatori» quando la Società decide chi può
 * entrare e «Calciatore» quando la persona dichiara il proprio incarico
 * (§14). Un unico label avrebbe sbagliato in metà delle schermate.
 *
 * Le funzioni prendono `now` come parametro: §45 chiede di congelare
 * l'orologio nei test della scadenza invece di sperare che le date di
 * esempio restino future.
 */
import type {
  JoinLinkAvailability,
  JoinLinkRow,
  JoinLinksTab,
  JoinProfileType,
} from "./join-links-types";
import type { JoinLinksErrorCode } from "./join-links-service";

export const JOIN_LINKS_COPY = Object.freeze({
  // Centro
  centerTitle: "Link di invito",
  create: "Crea nuovo link",
  emptyActive: "Nessun link attivo.",
  emptyActiveBody: "I link di invito attivi compariranno qui.",
  emptyRevoked: "Nessun link disattivato.",
  emptyRevokedBody: "I link disattivati compariranno qui.",
  listError: "Non è stato possibile caricare i link. Riprova.",
  notAuthorized: "Non hai accesso ai link di invito di questa società.",

  // Composer
  composeTitle: "Crea link di invito",
  teamField: "Squadra",
  audienceQuestion: "Chi può utilizzare questo invito?",
  allTeam: "Tutta la squadra",
  expiryField: "Scadenza",
  limitField: "Limite utilizzi",
  optionalHint: "Scadenza e limite sono facoltativi.",
  continueCta: "Continua",
  noTeams: "Nessuna squadra disponibile per questo invito.",

  // Ruoli dirigenziali
  rolesTitle: "Ruoli dirigenziali consentiti",
  rolesHelper: (team: string) => `Scegli i ruoli consentiti nella ${team}.`,
  customRoleField: "Specifica il ruolo",

  // Riepilogo
  reviewTitle: "Riepilogo",
  societyField: "Società",
  audienceField: "Può essere utilizzato da",
  executiveRolesField: "Ruoli dirigenziali consentiti",
  edit: "Modifica",
  generate: "Genera link",

  // Invito pronto
  readyTitle: "Invito pronto",
  readyBody: "Condividi questo link con le persone della squadra.",
  share: "Condividi invito",
  copy: "Copia link",
  copied: "Link copiato",

  // Dettaglio
  peopleField: "Persone collegate",
  createdField: "Creato il",
  revokedField: "Disattivato il",
  revoke: "Disattiva link",
  revokeQuestion: "Disattivare il link?",
  revokeBody:
    "Il link non potrà più creare nuovi collegamenti. Le persone già collegate resteranno nella società.",
  cancel: "Annulla",
  expiredHelper: "Modifica la scadenza per rendere nuovamente utilizzabile il link.",
  limitHelper: "Aumenta il limite per rendere nuovamente utilizzabile il link.",
  bothHelper:
    "Per rendere utilizzabile il link vanno modificati sia la scadenza sia il limite.",
  revokedHelper: "Un link disattivato non può essere riattivato.",
  structureHelper: "La squadra non è attiva: il link non può creare nuovi collegamenti.",

  // Sheet scadenza
  expirySheetTitle: "Modifica scadenza",
  noExpiry: "Nessuna scadenza",
  setExpiry: "Imposta data",
  expiryHelper: "Il link sarà valido fino alla fine del giorno selezionato.",
  expiryUpdated: "Scadenza aggiornata",

  // Sheet limite
  limitSheetTitle: "Modifica limite utilizzi",
  noLimit: "Nessun limite",
  setLimit: "Imposta limite",
  limitInputLabel: "Numero massimo di persone",
  limitUpdated: "Limite aggiornato",
  save: "Salva",

  // Persone
  peopleTitle: "Persone collegate",
  emptyPeople: "Nessuna persona collegata.",
  emptyPeopleBody:
    "Le persone che completeranno il collegamento tramite questo link compariranno qui.",
  peopleError: "Non è stato possibile caricare le persone collegate. Riprova.",
  enteredViaField: "Entrato tramite",
  connectedOnField: "Collegato il",
  viewProfile: "Visualizza profilo",
  removeRole: "Rimuovi ruolo",
  removeHelper: "La rimozione riguarda questo incarico.",
  removeQuestion: "Rimuovere questo ruolo?",
  removeOtherRoles: "Gli altri eventuali incarichi e l'account resteranno invariati.",
  removed: "Collegamento rimosso",

  // Landing e percorso del destinatario
  brand: "PROLINK",
  openInApp: "Apri invito su PROLINK",
  landingHint: "Apri l'invito nell'app. Se non l'hai, ti guideremo a scaricarla.",
  landingFooter: "Il collegamento si attiva solo dopo la tua conferma.",
  unavailableTitle: "Invito non più disponibile",
  unavailableBody: "Chiedi alla società un nuovo invito.",
  close: "Chiudi",
  retry: "Riprova",
  chooseProfileTitle: (team: string) => `Come fai parte della ${team}?`,
  chooseProfileHelper: "Scegli una sola categoria.",
  chooseRoleTitle: "Qual è il tuo ruolo?",
  chooseRoleHelper: "Puoi scegliere tra i ruoli autorizzati dalla società.",
  confirmTitle: "Conferma il tuo collegamento",
  profileField: "Profilo",
  roleField: "Ruolo",
  confirmSource: "Questi dati provengono dall'invito che hai utilizzato.",
  wrongData: "I dati non sono corretti?",
  confirmCta: "Conferma e collegati",
  completedTitle: "Collegamento completato",
  alreadyCompletedTitle: "Collegamento già completato",
  goToProfile: "Vai al profilo",
  incompatibleTitle: "Questo invito non è compatibile con il tuo profilo.",
  reentryTitle: "Non puoi utilizzare questo invito",
  reentryBody: "Il tuo precedente collegamento tramite questo invito non è più attivo.",
  endedTitle: "Il collegamento non è più attivo",

  // Uscita dal composer
  exitTitle: "Uscire senza salvare?",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitStay: "Continua a modificare",
  exitLeave: "Esci senza salvare",
} as const);

export const JOIN_LINKS_TABS: readonly { label: string; value: JoinLinksTab }[] =
  [
    { label: "Attivi", value: "active" },
    { label: "Disattivati", value: "revoked" },
  ];

/* ------------------------------------------------------------------ */
/* Categorie                                                          */
/* ------------------------------------------------------------------ */

/** L'ordine canonico delle quattro categorie, uguale ovunque (§12). */
export const JOIN_PROFILE_TYPES: readonly JoinProfileType[] = [
  "player",
  "coach",
  "staff",
  "director",
];

/** Lingua della Società: chi può entrare. */
const AUDIENCE_LABELS: Record<JoinProfileType, string> = {
  coach: "Allenatori",
  director: "Dirigenti",
  player: "Giocatori",
  staff: "Staff",
};

/**
 * Lingua della persona: che cosa sarà.
 *
 * §14: «Nel linguaggio del link, la categoria amministrativa può essere
 * Giocatori; nel profilo e nell'incarico della persona usare Calciatore.»
 */
const PERSON_LABELS: Record<JoinProfileType, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

export function audienceLabel(type: JoinProfileType): string {
  return AUDIENCE_LABELS[type];
}

export function personCategoryLabel(type: JoinProfileType): string {
  return PERSON_LABELS[type];
}

function sortTypes(types: readonly JoinProfileType[]): JoinProfileType[] {
  return JOIN_PROFILE_TYPES.filter((type) => types.includes(type));
}

/** «Giocatori e Staff», «Giocatori, Allenatori e Staff». */
function joinWithAnd(parts: readonly string[]): string {
  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0] ?? "";
  }

  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/**
 * Riepilogo testuale dell'audience (§16).
 *
 * «Il riepilogo delle quattro categorie può essere Tutta la squadra. Con due
 * o tre categorie usa una frase localizzata.» Non è un elenco di chip: §12
 * vieta di ripetere sotto le checkbox la selezione che le checkbox già
 * mostrano.
 */
export function audienceSummary(types: readonly JoinProfileType[]): string {
  const ordered = sortTypes(types);

  if (ordered.length === 0) {
    return "";
  }

  if (ordered.length === JOIN_PROFILE_TYPES.length) {
    return JOIN_LINKS_COPY.allTeam;
  }

  return joinWithAnd(ordered.map((type) => AUDIENCE_LABELS[type]));
}

/** La stessa frase, in minuscolo, per il messaggio di condivisione (§18). */
export function audienceSentence(types: readonly JoinProfileType[]): string {
  const ordered = sortTypes(types);

  return joinWithAnd(
    ordered.map((type) => AUDIENCE_LABELS[type].toLowerCase()),
  );
}

/* ------------------------------------------------------------------ */
/* Stato e contatori                                                  */
/* ------------------------------------------------------------------ */

/**
 * Etichette sobrie (§5).
 *
 * «Attivo, Scaduto, Limite raggiunto e Disattivato sono label sobrie.
 * Nessun badge verde decorativo, rating, percentuale o progress bar.»
 */
export function availabilityLabel(value: JoinLinkAvailability): string {
  switch (value) {
    case "available":
      return "Attivo";
    case "expired":
      return "Scaduto";
    case "limit_reached":
      return "Limite raggiunto";
    case "revoked":
      return "Disattivato";
    case "structure":
      return "Non disponibile";
  }
}

/** «27 persone collegate», «1 persona collegata», «Nessuna persona collegata». */
export function peopleLabel(count: number): string {
  if (count === 0) {
    return "Nessuna persona collegata";
  }

  return count === 1 ? "1 persona collegata" : `${count} persone collegate`;
}

/**
 * Riga di stato del centro (§10).
 *
 * «Attivo · 27 persone collegate». Il numero visibile nella riga è quello
 * delle persone, non il consumo del limite: §10 avverte che un link con 20
 * utilizzi su 20 può averne 18 ancora collegate.
 */
export function rowStateLine(row: JoinLinkRow): string {
  return `${availabilityLabel(row.availability)} · ${peopleLabel(row.activePeople)}`;
}

/**
 * Consumo del limite (§27).
 *
 * «Con un limite mostra 30 di 40 utilizzati, senza percentuale o progress
 * bar. Senza limite puoi mostrare 30 utilizzi completati nel dettaglio.»
 */
export function usageLine(
  completed: number,
  max: number | null,
): string {
  if (max === null) {
    return completed === 1
      ? "1 utilizzo completato"
      : `${completed} utilizzi completati`;
  }

  return `${completed} di ${max} utilizzati`;
}

/* ------------------------------------------------------------------ */
/* Date                                                               */
/* ------------------------------------------------------------------ */

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

/** «20 settembre 2026». */
export function formatLongDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = parseDay(value);

  if (!date) {
    return null;
  }

  const month = LONG_MONTHS[date.getMonth()];

  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : null;
}

/** «24 agosto»: l'anno compare solo quando è diverso da quello corrente. */
export function formatConnectedDate(
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

  const month = LONG_MONTHS[date.getMonth()];

  if (!month) {
    return null;
  }

  return date.getFullYear() === now.getFullYear()
    ? `${date.getDate()} ${month}`
    : `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/**
 * `expires_on` arriva come `YYYY-MM-DD`.
 *
 * Va letto come data **civile**, non come istante: `new Date("2026-09-30")`
 * è mezzanotte UTC e in un fuso a ovest diventa il 29. La scadenza reale è
 * già un timestamp calcolato dal server nel fuso della Società; qui si
 * ripresenta soltanto il giorno concordato.
 */
export function parseDay(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    const fallback = new Date(value);

    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day] = match;

  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function toDayString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function expiryLabel(expiresOn: string | null): string {
  return formatLongDate(expiresOn) ?? JOIN_LINKS_COPY.noExpiry;
}

export function limitLabel(max: number | null): string {
  return max === null ? JOIN_LINKS_COPY.noLimit : `${max}`;
}

/* ------------------------------------------------------------------ */
/* Validazioni locali                                                 */
/* ------------------------------------------------------------------ */

export const FIELD_ERRORS = Object.freeze({
  categories: "Seleziona almeno una categoria.",
  customRole: "Specifica il ruolo.",
  expiry: "Scegli una data valida.",
  executiveRoles: "Seleziona almeno un ruolo dirigenziale.",
  limit: "Inserisci un limite valido.",
  team: "Scegli una squadra.",
} as const);

const UNSAFE_CUSTOM_ROLE = /[ -<>]/g;

/**
 * Stessa normalizzazione del server (§13).
 *
 * Il gemello SQL è `normalize_assignment_custom_role`. Divergere
 * significherebbe mostrare valido un valore che il commit poi rifiuta.
 */
export function normalizeCustomRole(value: string): string {
  return value.replace(UNSAFE_CUSTOM_ROLE, " ").replace(/\s+/g, " ").trim();
}

/** Intero positivo, senza decimali, zero o segni (§15). */
export function parseLimit(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) {
    return null;
  }

  const value = Number(raw.trim());

  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * «Il giorno corrente è ammesso se non concluso» (§15).
 *
 * Il confronto è fra giorni civili: la fine effettiva del giorno la decide
 * il server nel fuso della Società, e anticiparla qui farebbe rifiutare al
 * client una data che il commit accetterebbe.
 */
export function isSelectableDay(day: Date, now: Date = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(day.getFullYear(), day.getMonth(), day.getDate());

  return target.getTime() >= today.getTime();
}

/**
 * Select-all delle categorie (§12).
 *
 * «Se attivata seleziona le quattro categorie. Deselezionandone una lo stato
 * globale diventa parziale/non selezionato … non deselezionare le altre.»
 */
export function toggleProfileType(
  current: readonly JoinProfileType[],
  type: JoinProfileType,
): JoinProfileType[] {
  return current.includes(type)
    ? current.filter((item) => item !== type)
    : sortTypes([...current, type]);
}

export function toggleAllTeam(
  current: readonly JoinProfileType[],
): JoinProfileType[] {
  return current.length === JOIN_PROFILE_TYPES.length
    ? []
    : [...JOIN_PROFILE_TYPES];
}

export type SelectAllState = "checked" | "indeterminate" | "unchecked";

export function selectAllState(
  current: readonly JoinProfileType[],
): SelectAllState {
  if (current.length === 0) {
    return "unchecked";
  }

  return current.length === JOIN_PROFILE_TYPES.length
    ? "checked"
    : "indeterminate";
}

/* ------------------------------------------------------------------ */
/* Frasi parametriche                                                 */
/* ------------------------------------------------------------------ */

/**
 * Messaggio della share sheet (§18).
 *
 * «Deve indicare Società, squadra e destinatari ammessi.» Il testo è
 * generato, non modificabile da un campo: §18 lo esclude da questa task.
 */
export function shareMessage(input: {
  allowedProfileTypes: readonly JoinProfileType[];
  clubName: string;
  teamName: string;
  url: string;
}): string {
  const audience = audienceSentence(input.allowedProfileTypes);
  const first = `${input.clubName} ti invita a collegarti alla ${input.teamName} su ${JOIN_LINKS_COPY.brand}.`;
  const second = audience
    ? ` Il link è dedicato a ${audience} della squadra.`
    : "";

  return `${first}${second}\n${input.url}`;
}

/** «AC Como ti invita a collegarti» (§19). */
export function landingHeading(clubName: string): string {
  return `${clubName} ti invita a collegarti`;
}

/** «Un invito per giocatori, allenatori, staff e dirigenti della squadra.» */
export function landingAudience(
  types: readonly JoinProfileType[],
): string | null {
  const audience = audienceSentence(types);

  return audience ? `Un invito per ${audience} della squadra.` : null;
}

/** «Ora sei collegato ad AC Como come Calciatore della Prima squadra.» (§26) */
export function successSentence(input: {
  clubName: string;
  roleLabel: string;
  teamName: string;
}): string {
  return `Ora sei collegato ad ${input.clubName} come ${input.roleLabel} della ${input.teamName}.`;
}

/** Variante al passato per un collegamento già completato (§26). */
export function alreadyConnectedSentence(input: {
  clubName: string;
  roleLabel: string | null;
  teamName: string;
}): string {
  return input.roleLabel
    ? `Sei già collegato ad ${input.clubName} come ${input.roleLabel} della ${input.teamName}.`
    : `Sei già collegato ad ${input.clubName}.`;
}

/**
 * Spiegazione quando la categoria voluta non è ammessa (§23).
 *
 * «Questo invito è riservato ai giocatori della Prima squadra. Chiedi alla
 * società il link corretto.»
 */
export function wrongDataSentence(input: {
  allowedProfileTypes: readonly JoinProfileType[];
  teamName: string;
}): string {
  const audience = audienceSentence(input.allowedProfileTypes);

  return `Questo invito è riservato a ${audience} della ${input.teamName}. Chiedi alla società il link corretto.`;
}

/** «Mario Rossi non risulterà più come Calciatore della Prima squadra di AC Como.» */
export function removeRoleSentence(input: {
  clubName: string;
  personName: string;
  roleLabel: string;
  teamName: string;
}): string {
  return `${input.personName} non risulterà più come ${input.roleLabel} della ${input.teamName} di ${input.clubName}.`;
}

/** «Link Prima squadra · Tutta la squadra» (§34). */
export function enteredViaLabel(input: {
  allowedProfileTypes: readonly JoinProfileType[];
  teamName: string;
}): string {
  const audience = audienceSummary(input.allowedProfileTypes);

  return audience
    ? `Link ${input.teamName} · ${audience}`
    : `Link ${input.teamName}`;
}

/**
 * Helper correttivo del dettaglio (§30).
 *
 * «Se anche il limite è raggiunto, spiega che va modificato anche quello;
 * non promettere disponibilità dopo una sola correzione.»
 */
export function constraintHelper(input: {
  availability: JoinLinkAvailability;
  completedUses: number;
  expiresOn: string | null;
  maxRedemptions: number | null;
  now?: Date;
}): string | null {
  if (input.availability === "revoked") {
    return JOIN_LINKS_COPY.revokedHelper;
  }

  if (input.availability === "structure") {
    return JOIN_LINKS_COPY.structureHelper;
  }

  const day = parseDay(input.expiresOn);
  const expired = day !== null && !isSelectableDay(day, input.now ?? new Date());
  const exhausted =
    input.maxRedemptions !== null &&
    input.completedUses >= input.maxRedemptions;

  if (expired && exhausted) {
    return JOIN_LINKS_COPY.bothHelper;
  }

  if (expired) {
    return JOIN_LINKS_COPY.expiredHelper;
  }

  if (exhausted) {
    return JOIN_LINKS_COPY.limitHelper;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Errori                                                             */
/* ------------------------------------------------------------------ */

const MUTATION_ERRORS: Partial<Record<JoinLinksErrorCode, string>> = {
  JOIN_LINKS_NOT_AUTHORIZED: "Non hai i permessi per questa operazione.",
  JOIN_LINK_CATEGORIES_REQUIRED: FIELD_ERRORS.categories,
  JOIN_LINK_CUSTOM_ROLE_REQUIRED: FIELD_ERRORS.customRole,
  JOIN_LINK_CUSTOM_ROLE_TOO_LONG: "Il ruolo indicato è troppo lungo.",
  JOIN_LINK_EXECUTIVE_ROLES_REQUIRED: FIELD_ERRORS.executiveRoles,
  JOIN_LINK_EXPIRY_INVALID: FIELD_ERRORS.expiry,
  JOIN_LINK_LIMIT_INVALID: FIELD_ERRORS.limit,
  JOIN_LINK_NOT_FOUND: "Il link non è più disponibile.",
  JOIN_LINK_REMOVE_NOT_AUTHORIZED: "Non hai i permessi per rimuovere questo ruolo.",
  JOIN_LINK_REVISION_CONFLICT: "Il link è stato aggiornato. Controlla i dati e riprova.",
  JOIN_LINK_REVOKED: "Il link è stato disattivato.",
  JOIN_LINK_TEAM_INVALID: "La squadra selezionata non è valida.",
  OPERATION_CONTENT_CHANGED: "I dati sono cambiati. Controlla e riprova.",
  RATE_LIMIT: "Hai effettuato troppe operazioni. Riprova più tardi.",
  TEAM_NOT_ACTIVE: "La squadra non è più attiva.",
};

const OPERATION_FALLBACK: Record<JoinLinkOperation, string> = {
  create: "Non è stato possibile creare il link. Riprova.",
  redeem: "Non è stato possibile completare il collegamento. Riprova.",
  remove: "Non è stato possibile rimuovere il ruolo. Riprova.",
  revoke: "Non è stato possibile disattivare il link. Riprova.",
  update: "Non è stato possibile salvare le modifiche. Riprova.",
};

export type JoinLinkOperation =
  | "create"
  | "redeem"
  | "remove"
  | "revoke"
  | "update";

/**
 * «{N} persone hanno già utilizzato questo link. Il limite non può essere
 * inferiore a {N}.» (§41)
 *
 * Il numero arriva dal `detail` dell'errore, cioè dal conteggio riletto al
 * commit: §29 vieta di usare quello che il client aveva in pagina.
 */
export function limitBelowUsageError(completed: number): string {
  const people =
    completed === 1
      ? "1 persona ha già utilizzato questo link"
      : `${completed} persone hanno già utilizzato questo link`;

  return `${people}. Il limite non può essere inferiore a ${completed}.`;
}

export function mutationErrorCopy(
  code: JoinLinksErrorCode,
  operation: JoinLinkOperation,
  detail?: string | null,
): string {
  if (code === "JOIN_LINK_LIMIT_BELOW_USAGE") {
    const parsed = detail && /^\d+$/.test(detail) ? Number(detail) : null;

    return parsed === null
      ? OPERATION_FALLBACK[operation]
      : limitBelowUsageError(parsed);
  }

  return MUTATION_ERRORS[code] ?? OPERATION_FALLBACK[operation];
}

export function emptyCopy(tab: JoinLinksTab): {
  body: string;
  title: string;
} {
  return tab === "active"
    ? {
        body: JOIN_LINKS_COPY.emptyActiveBody,
        title: JOIN_LINKS_COPY.emptyActive,
      }
    : {
        body: JOIN_LINKS_COPY.emptyRevokedBody,
        title: JOIN_LINKS_COPY.emptyRevoked,
      };
}
