/**
 * Derivazioni pure del flusso Shortlist dal profilo (DAS-REV-26).
 *
 * Qui vive tutto ciò che si può decidere senza render: la copy canonica
 * (§31), lo stato della stella (§9), le righe del selector e del riepilogo
 * (§11, §14), la validazione del form CUSTOM (§16) e la destinazione dopo
 * una rimozione (§21). Le schermate leggono, non decidono.
 */
import { EVALUATION_LABELS, priorityLabel } from "../shortlist-presentation";
import type { ShortlistErrorKind } from "../shortlist-types";
import type {
  ProfileDestination,
  ProfileMembership,
  ProfileShortlistState,
} from "./profile-shortlist-types";

/** §31: stringhe localizzate e centralizzate, parola per parola. */
export const PROFILE_SHORTLIST_COPY = {
  selectorTitle: "Aggiungi a shortlist",
  positionsGroup: "Per posizione",
  customGroup: "Liste personalizzate",
  draft: "Bozza",
  closed: "Posizione chiusa",
  createList: "Crea nuova lista",
  addToOther: "Aggiungi ad altra lista",
  seeInShortlist: "Vedi nella shortlist",
  editEvaluation: "Modifica valutazione",
  removeFromList: "Rimuovi da questa lista",
  formTitle: "Nuova lista",
  formCancel: "Annulla",
  formName: "Nome lista",
  formDescription: "Descrizione (facoltativa)",
  formDescriptionPlaceholder: "Aggiungi una descrizione",
  formScope: "Ambito",
  formScopePlaceholder: "Scegli l'ambito",
  formAccess: "Accesso alla lista",
  formAccessValue: "Solo io",
  formAccessHelper: "La lista sarà visibile solo a te.",
  formSubmitWithProfile: "Crea e aggiungi",
  formSubmitCenter: "Crea lista",
  scopeTitle: "Ambito della lista",
  scopeSociety: "Intera società",
  scopeConfirm: "Conferma",
  evaluationDone: "Valutazione aggiornata.",
  removeTitle: "Rimuovere da questa lista?",
  removeCancel: "Annulla",
  removeConfirm: "Rimuovi",
  removeDone: "Profilo rimosso dalla lista.",
  emptyTitle: "Nessuna shortlist disponibile",
  emptyBody: "Non ci sono altre liste disponibili per questo profilo.",
  positionsError: "Non è stato possibile caricare le posizioni.",
  customError: "Non è stato possibile caricare le liste personalizzate.",
  retry: "Riprova",
  recoveryTitle: "Lista creata",
  retryAdd: "Riprova aggiunta",
  openList: "Apri lista",
  exitTitle: "Uscire senza salvare?",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitStay: "Continua a modificare",
  exitLeave: "Esci senza salvare",
  /* §27: le altre copy di errore. */
  selectorError: "Non è stato possibile caricare le shortlist.",
  summaryError: "Non è stato possibile caricare le liste di questo profilo.",
  addError: "Impossibile aggiungere alla shortlist. Riprova.",
  createError: "Non è stato possibile creare la lista. Riprova.",
  saveError: "Non è stato possibile salvare la valutazione. Riprova.",
  removeError: "Non è stato possibile rimuovere il profilo dalla lista. Riprova.",
  unavailable: "Questa lista non è più disponibile.",
  offlineMutation: "Connessione assente. Riprova quando sei online.",
  offlineTitle: "Sei offline",
  offlineBody: "Connettiti a Internet per caricare le shortlist.",
  nameRequired: "Inserisci il nome della lista.",
  scopeRequired: "Scegli l'ambito della lista.",
  scopeInvalid: "Questo ambito non è più disponibile. Scegline un altro.",
  /* §30: label accessibili della stella, mai «star outline/filled». */
  starAddLabel: "Aggiungi a shortlist",
  starOpenLabel: "Profilo presente in shortlist, apri liste",
} as const;

/** §31: «{Nome} è in shortlist». */
export function summaryTitle(name: string): string {
  return `${name} è in shortlist`;
}

/** §31: «Aggiungerai {Nome} alla nuova lista.» */
export function formIntentLine(name: string): string {
  return `Aggiungerai ${name} alla nuova lista.`;
}

/** §19, §31: «Non è stato possibile aggiungere {Nome} alla lista.» */
export function recoveryBody(name: string): string {
  return `Non è stato possibile aggiungere ${name} alla lista.`;
}

/**
 * §16: limiti **centrali**, gli stessi di
 * `public.shortlist_list_name_max_length()` e
 * `public.shortlist_list_description_max_length()`. Il server resta
 * l'autorità e risponde con il proprio codice anche se il client non
 * fermasse l'input.
 */
export const LIST_NAME_MAX_LENGTH = 80;
export const LIST_DESCRIPTION_MAX_LENGTH = 500;

export type StarPresentation = "hidden" | "empty" | "filled";

/**
 * La stella del profilo (§9, tabella).
 *
 * | membership | add | stella |
 * | nessuna, lettura valida | sì | ☆ |
 * | una o più | sì / no | ★ |
 * | nessuna | no | assente |
 * | non ancora note | — | assente temporanea, mai ☆ |
 * | accesso negato | — | assente |
 *
 * Un errore di aggiornamento conserva l'ultimo stato affidabile — React
 * Query mantiene `data` dopo un refetch fallito — e un errore senza stato
 * noto non diventa ☆: `undefined` è «non ancora noto», quindi assente.
 */
export function starPresentation(input: {
  state: ProfileShortlistState | undefined;
}): StarPresentation {
  const { state } = input;

  if (!state || !state.available) {
    return "hidden";
  }

  if (state.inAnyList) {
    return "filled";
  }

  return state.canAdd ? "empty" : "hidden";
}

/** §11: «titolo, Team/scope utile, lifecycle secondario quando Bozza o Posizione chiusa». */
export function destinationLines(row: ProfileDestination): {
  meta: string | null;
  title: string;
} {
  const lifecycle = row.isDraft
    ? PROFILE_SHORTLIST_COPY.draft
    : row.isClosed
      ? PROFILE_SHORTLIST_COPY.closed
      : null;

  const meta = [row.scopeLabel, lifecycle]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  return { meta: meta.length > 0 ? meta : null, title: row.title };
}

/**
 * §14: «Ogni riga mostra destinazione, Team/scope quando utile, priorità se
 * valorizzata e leggibile, stato se leggibile.» Priorità nulla omessa: la
 * riga dice «Da valutare», non «Priorità non impostata».
 */
export function membershipLines(row: ProfileMembership): {
  evaluation: string;
  scope: string | null;
  title: string;
} {
  const lifecycle = row.isDraft
    ? PROFILE_SHORTLIST_COPY.draft
    : row.isClosed
      ? PROFILE_SHORTLIST_COPY.closed
      : null;

  const scope = [row.scopeLabel, lifecycle]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  return {
    evaluation: [priorityLabel(row.priority), EVALUATION_LABELS[row.evaluationStatus]]
      .filter((part): part is string => !!part)
      .join(" · "),
    scope: scope.length > 0 ? scope : null,
    title: row.title,
  };
}

/** §30: la riga membership annuncia nome, scope, valori e apertura. */
export function membershipAccessibilityLabel(row: ProfileMembership): string {
  const lines = membershipLines(row);

  return [lines.title, lines.scope, lines.evaluation, "apri azioni"]
    .filter((part): part is string => !!part && part.length > 0)
    .join(", ");
}

/** I due gruppi del riepilogo, nello stesso componente (§14, QA047). */
export function groupMemberships(items: ProfileMembership[]): {
  custom: ProfileMembership[];
  positions: ProfileMembership[];
} {
  return {
    custom: items.filter((item) => item.kind === "custom"),
    positions: items.filter((item) => item.kind === "position"),
  };
}

/**
 * §15: «Modifica valutazione» esiste quando almeno un campo è scrivibile;
 * Rimuovi soltanto con il potere di rimozione. Lo screen 12 è il caso in cui
 * resta soltanto Vedi nella shortlist.
 */
export function membershipActions(row: ProfileMembership): {
  canEdit: boolean;
  canRemove: boolean;
} {
  return {
    canEdit: row.canEditStatus || row.canEditNote,
    canRemove: row.canRemove,
  };
}

/** §21: «{Nome} verrà rimosso da {nome destinazione} · {ambito leggibile}.» */
export function removeBody(input: {
  name: string;
  scopeLabel: string | null;
  title: string;
}): string {
  /* «Se l'ambito è già parte del nome o non serve a identificare la lista,
     evita la duplicazione.» */
  const scope =
    input.scopeLabel && !input.title.toLowerCase().includes(input.scopeLabel.toLowerCase())
      ? input.scopeLabel
      : null;

  const destination = [input.title, scope]
    .filter((part): part is string => !!part)
    .join(" · ");

  return `${input.name} verrà rimosso da ${destination}.`;
}

/**
 * Dove si torna dopo una rimozione confermata (§21).
 *
 * «se restano appartenenze accessibili, torna al riepilogo aggiornato e
 * conserva ★; se non ne restano, chiudi il flow e torna al profilo.» La
 * risposta viene dal **comando**, non da un refresh: «non dedurre
 * appartenenze mancanti da un refresh fallito».
 */
export function afterRemove(inAnyList: boolean): "summary" | "profile" {
  return inAnyList ? "summary" : "profile";
}

export type ListFormErrors = {
  description: string | null;
  name: string | null;
  scope: string | null;
};

/**
 * Validazione del form CUSTOM (§16), la stessa per centro e profilo.
 *
 * «Nome lista, obbligatorio dopo trim»; nessun troncamento silenzioso: oltre
 * il limite il testo resta com'è e il campo mostra l'errore.
 */
export function validateListForm(input: {
  description: string;
  name: string;
  scopeChosen: boolean;
}): ListFormErrors {
  const name = input.name.trim();
  const description = input.description.trim();

  return {
    description:
      description.length > LIST_DESCRIPTION_MAX_LENGTH
        ? `Massimo ${LIST_DESCRIPTION_MAX_LENGTH} caratteri.`
        : null,
    name:
      name.length === 0
        ? null
        : name.length > LIST_NAME_MAX_LENGTH
          ? `Massimo ${LIST_NAME_MAX_LENGTH} caratteri.`
          : null,
    scope: null,
  };
}

/** Il form è inviabile: nome presente, limiti rispettati, ambito scelto. */
export function listFormSubmittable(input: {
  description: string;
  name: string;
  scopeChosen: boolean;
}): boolean {
  const errors = validateListForm(input);

  return (
    input.name.trim().length > 0 &&
    input.scopeChosen &&
    !errors.name &&
    !errors.description
  );
}

/** Errori del comando di creazione mappati sul campo che li causa (§16). */
export function createErrorFields(kind: ShortlistErrorKind): Partial<ListFormErrors> & {
  banner?: string;
} {
  switch (kind) {
    case "nameRequired":
      return { name: PROFILE_SHORTLIST_COPY.nameRequired };
    case "nameTooLong":
      return { name: `Massimo ${LIST_NAME_MAX_LENGTH} caratteri.` };
    case "descriptionTooLong":
      return { description: `Massimo ${LIST_DESCRIPTION_MAX_LENGTH} caratteri.` };
    case "scopeInvalid":
      return { scope: PROFILE_SHORTLIST_COPY.scopeInvalid };
    default:
      return { banner: PROFILE_SHORTLIST_COPY.createError };
  }
}

/** §27: copy di un errore di aggiunta. */
export function addFailureCopy(kind: ShortlistErrorKind): string {
  switch (kind) {
    case "notFound":
    case "gone":
    case "notAuthorized":
      /* «Questa lista non è più disponibile.» — senza rivelare se appartiene
         a un'altra Società o è stata resa riservata. */
      return PROFILE_SHORTLIST_COPY.unavailable;
    default:
      return PROFILE_SHORTLIST_COPY.addError;
  }
}

/** §27: un errore definitivo non va riprovato con la stessa chiave. */
export function isDefinitiveFailure(kind: ShortlistErrorKind): boolean {
  return kind !== "network";
}

/**
 * Selettore: cosa mostrare dopo letture valide (§11).
 *
 * «Un gruppo in errore non è un gruppo vuoto»: l'empty dello screen 13 vale
 * soltanto quando **entrambi** i gruppi hanno risposto e sono vuoti.
 */
export function selectorPresentation(input: {
  custom: { error: boolean; items: number; loading: boolean };
  position: { error: boolean; items: number; loading: boolean };
}): "loading" | "empty" | "totalError" | "content" {
  const { custom, position } = input;

  if (custom.error && position.error) {
    return "totalError";
  }

  if (
    !custom.error &&
    !position.error &&
    !custom.loading &&
    !position.loading &&
    custom.items === 0 &&
    position.items === 0
  ) {
    return "empty";
  }

  if (custom.loading && position.loading) {
    return "loading";
  }

  return "content";
}
