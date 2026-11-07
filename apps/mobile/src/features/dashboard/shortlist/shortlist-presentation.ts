/**
 * Derivazioni pure del Centro Shortlist (§9, §11, §30).
 *
 * Qui vivono le decisioni che §11 descrive a parole e che una schermata non
 * deve poter sbagliare: quale vuoto mostrare, con quale copy, e con quale
 * CTA. Sono le regole più facili da violare in un `if` dentro il render —
 * e le uniche che QA015 e QA016 verificano direttamente.
 */
import type {
  ShortlistCapabilities,
  ShortlistCreatedSource,
  ShortlistEvaluationStatus,
  ShortlistPriority,
} from "./shortlist-types";

/** §30: stringhe localizzate in un posto solo. */
export const SHORTLIST_COPY = {
  title: "Shortlist",
  /** §8: la descrizione della riga in Aree di gestione. */
  moduleDescription: "Profili selezionati e valutazioni interne",

  /** §9: le due sezioni, in quest'ordine. */
  positionsSection: "Per posizione",
  customSection: "Liste personalizzate",

  /** §10: metadato neutro. */
  positionClosed: "Posizione chiusa",

  /** §9. */
  createCustom: "Crea lista personalizzata",

  /** §11, screen 04. */
  positionsEmpty: "Nessun profilo ancora selezionato per le posizioni.",
  /** §11, variante senza CUSTOM. */
  customEmpty: "Nessuna lista personalizzata",

  /** §11, screen 05. */
  globalEmptyTitle: "Nessuna shortlist",
  globalEmptyBoth:
    "Aggiungi profili dalle candidature o crea una lista personalizzata.",
  globalEmptyCreateOnly:
    "Crea una lista personalizzata per organizzare i profili.",
  globalEmptyAddOnly: "Aggiungi profili dalle candidature per ritrovarli qui.",
  globalEmptyReadOnly:
    "Le liste accessibili compariranno qui quando saranno disponibili.",

  /** §12, screen 08. */
  errorTitle: "Impossibile caricare le shortlist",
  errorBody: "Riprova tra poco.",
  retry: "Riprova",
  refreshError: "Non è stato possibile aggiornare le shortlist. Riprova.",

  /** §27. */
  offlineStale: "Sei offline · Dati non aggiornati",
  offlineTitle: "Sei offline",
  offlineBody: "Connettiti a Internet per caricare le shortlist.",
  mutationOffline: "Connessione assente. Riprova quando sei online.",

  /** §22, deep link non disponibile. */
  unavailableTitle: "Contenuto non disponibile",
  unavailableBody:
    "Non hai accesso a questa shortlist oppure non è più disponibile.",
  backToDashboard: "Torna alla Dashboard",

  /** §30, errori contestuali. */
  addError: "Non è stato possibile aggiungere il profilo alla shortlist. Riprova.",
  withdrawn: "La candidatura è stata ritirata.",
  conflict: "I dati sono cambiati. Aggiorna e riprova.",
  revoked: "Non hai più accesso a questa sezione.",

  /** §14, metadati leggeri del pool. */
  fromApplication: "Da candidatura",
  fromProfile: "Aggiunto dal profilo",
} as const;

/**
 * §9, §30: «conteggio con singolare/plurale corretto», e §30 chiede
 * esplicitamente di gestire «0 profili, 1 profilo e quantità maggiori».
 */
export function profilesLabel(countValue: number): string {
  return countValue === 1 ? "1 profilo" : `${countValue} profili`;
}

/**
 * Sottotitolo di una riga: «Prima squadra · 3 profili» (§9).
 *
 * Uno scope assente non produce un separatore penzolante — una Position
 * storica può non averne uno leggibile, e §30 vieta di mostrare `null`.
 */
export function rowSubtitle(
  scopeLabel: string | null,
  countValue: number,
  isClosed = false,
): string {
  const parts = [scopeLabel, profilesLabel(countValue)].filter(
    (part): part is string => !!part && part.length > 0,
  );

  const base = parts.join(" · ");

  /* §10: «Mostra Posizione chiusa come metadato neutro.» Su una riga
     separata nel mockup; qui è il chiamante a decidere il layout, e questa
     funzione produce il testo annunciato dallo screen reader (§31). */
  return isClosed ? `${base}\n${SHORTLIST_COPY.positionClosed}` : base;
}

export const EVALUATION_LABELS: Record<ShortlistEvaluationStatus, string> = {
  contattato: "Contattato",
  da_contattare: "Da contattare",
  da_valutare: "Da valutare",
  interessante: "Interessante",
  non_prioritario: "Non prioritario",
  scartato: "Scartato",
};

export const PRIORITY_LABELS: Record<ShortlistPriority, string> = {
  alta: "Alta",
  bassa: "Bassa",
  media: "Media",
};

/**
 * Metadati di una riga del pool (§14).
 *
 * «Stato di valutazione interno se autorizzato, priorità soltanto se
 * presente ed eventuale informazione discreta sulla candidatura collegata.»
 *
 * `hasApplication: null` non produce nessuna delle due diciture: §22 —
 * «ometti metadata e link della candidatura non autorizzata; non inventare
 * l'affermazione "non si è candidato"».
 */
export function poolRowMeta(input: {
  canSeeEvaluation: boolean;
  createdSource: ShortlistCreatedSource;
  evaluationStatus: ShortlistEvaluationStatus;
  hasApplication: boolean | null;
  priority: ShortlistPriority | null;
}): string[] {
  const parts: string[] = [];

  if (input.canSeeEvaluation) {
    parts.push(EVALUATION_LABELS[input.evaluationStatus]);
  }

  if (input.priority) {
    parts.push(`Priorità ${PRIORITY_LABELS[input.priority].toLocaleLowerCase("it-IT")}`);
  }

  if (input.hasApplication === true) {
    parts.push(SHORTLIST_COPY.fromApplication);
  } else if (input.hasApplication === false) {
    /* §14: «Quando la candidatura di Luca viene collegata, il riepilogo deve
       riflettere la presenza attuale della candidatura; l'audit della
       nascita dal profilo può essere conservato separatamente.» Quindi la
       dicitura segue la **relazione corrente**, non `created_source`. */
    parts.push(SHORTLIST_COPY.fromProfile);
  }

  return parts;
}

/** Stato complessivo del centro, con i due gruppi tenuti distinti (§27). */
export type GroupState = "loading" | "ready" | "error";

export type CenterPresentation =
  | { kind: "globalEmpty"; body: string; showCreate: boolean }
  | { kind: "globalError" }
  | { kind: "content" };

/**
 * Quale superficie mostrare (§11, §12).
 *
 * Tre regole che non possono vivere sparse nel render:
 *
 *   · «Il vuoto globale richiede **entrambi** i gruppi risolti con successo e
 *     vuoti» — un gruppo in errore e l'altro vuoto non è un empty (QA016);
 *   · l'errore globale è solo quando **entrambi** falliscono: con uno dei due
 *     utilizzabile l'errore è locale (QA103);
 *   · la copy del vuoto globale si adatta alle capacità reali, e non propone
 *     azioni per cui mancano i permessi (QA015).
 */
export function centerPresentation(input: {
  capabilities: Pick<ShortlistCapabilities, "canAddProfiles" | "canCreateLists">;
  customCount: number;
  customState: GroupState;
  positionCount: number;
  positionState: GroupState;
}): CenterPresentation {
  if (input.positionState === "error" && input.customState === "error") {
    return { kind: "globalError" };
  }

  const bothResolved =
    input.positionState === "ready" && input.customState === "ready";

  if (bothResolved && input.positionCount === 0 && input.customCount === 0) {
    const { canAddProfiles, canCreateLists } = input.capabilities;

    if (canAddProfiles && canCreateLists) {
      return {
        body: SHORTLIST_COPY.globalEmptyBoth,
        kind: "globalEmpty",
        showCreate: true,
      };
    }

    if (canCreateLists) {
      return {
        body: SHORTLIST_COPY.globalEmptyCreateOnly,
        kind: "globalEmpty",
        showCreate: true,
      };
    }

    if (canAddProfiles) {
      return {
        body: SHORTLIST_COPY.globalEmptyAddOnly,
        kind: "globalEmpty",
        showCreate: false,
      };
    }

    return {
      body: SHORTLIST_COPY.globalEmptyReadOnly,
      kind: "globalEmpty",
      showCreate: false,
    };
  }

  return { kind: "content" };
}

/** §30: la copy contestuale di un errore di aggiunta. */
export function addErrorCopy(kind: string): string {
  switch (kind) {
    case "withdrawn":
      return SHORTLIST_COPY.withdrawn;
    case "conflict":
      return SHORTLIST_COPY.conflict;
    case "notAuthorized":
      return SHORTLIST_COPY.revoked;
    default:
      return SHORTLIST_COPY.addError;
  }
}
