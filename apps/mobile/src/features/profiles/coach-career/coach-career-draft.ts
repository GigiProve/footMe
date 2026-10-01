/**
 * La bozza che l'editor manipola, e le regole che decidono se può essere
 * salvata (REV-PROF-04).
 *
 * Una bozza è sempre **un gruppo**: una società, una modalità temporale e le
 * assegnazioni che ne derivano. Le tre modalità del mockup producono bozze
 * diverse solo nei campi che riempiono, mai nel modo in cui vengono salvate —
 * così "Salva esperienza" è una sola operazione, atomica anche quando scrive
 * tre assegnazioni.
 *
 * Due regole della task vivono qui e da nessun'altra parte:
 *
 * — si blocca **solo** il duplicato esatto (stessa società, stessa stagione o
 *   identico periodo, stesso ruolo, stessa categoria): un allenatore può
 *   ricoprire più incarichi contemporaneamente, quindi la sovrapposizione è un
 *   avviso e non un errore;
 * — il prefill copia il valore della riga precedente ma non lega le righe:
 *   cambiare il ruolo di una stagione non tocca le altre.
 */
import {
  assignmentSeasonKeys,
  clubIdentity,
  formatPeriodLabel,
  formatSeasonLabel,
  monthLabelToNumber,
  type CoachAssignment,
  type CoachPeriod,
  type CoachTemporalMode,
} from "./coach-assignment-model";

export type CoachSeasonDraftDetail = {
  category: string;
  role: string;
};

export type CoachExperienceDraft = {
  /** Ruolo e categoria di `SINGLE_SEASON` e `CUSTOM_PERIOD`. */
  category: string;
  clubId: string | null;
  /** Descrizione di `SINGLE_SEASON` e `CUSTOM_PERIOD`, sempre facoltativa. */
  description: string;
  /**
   * Descrizioni già salvate delle singole stagioni di un gruppo
   * multi-stagione.
   *
   * Vivono qui e non in `description` perché la task è esplicita: la stessa
   * descrizione non va replicata su tutte le stagioni senza un'azione
   * dell'utente. Le schermate 3 e 4 non hanno un campo descrizione, quindi qui
   * il dato viene solo attraversato — preservato riga per riga, mai propagato.
   */
  descriptionBySeason: Record<string, string>;
  groupId: string;
  /** Incarico in corso: solo `CUSTOM_PERIOD`. */
  isOngoing: boolean;
  mode: CoachTemporalMode;
  period: CoachPeriod | null;
  role: string;
  /**
   * Ruolo e categoria per stagione. È la source of truth di `MULTI_SEASON`:
   * ogni stagione selezionata ha la sua riga, indipendente dalle altre.
   */
  seasonDetails: Record<string, CoachSeasonDraftDetail>;
  seasons: string[];
  teamLogoUrl: string;
  teamName: string;
  /**
   * Id già persistiti del gruppo. Riusarli tiene stabile l'identità di una
   * stagione che sopravvive a una modifica, invece di cancellarla e ricrearla.
   */
  persistedIdBySeason: Record<string, string>;
  /** Id persistito di una bozza a singola assegnazione, quando in modifica. */
  persistedId: string | null;
};

export const COACH_DRAFT_ERROR_MESSAGES = {
  category: "Seleziona una categoria.",
  duplicate: "Questa esperienza è già presente.",
  endBeforeStart: "La data finale non può precedere quella iniziale.",
  endDate: "Inserisci la data finale.",
  role: "Seleziona un ruolo.",
  season: "Seleziona almeno una stagione.",
  startDate: "Inserisci la data iniziale.",
  team: "Seleziona una squadra.",
} as const;

export const COACH_OVERLAP_WARNING =
  "Esiste già un incarico in questo periodo. Verifica i dati prima di continuare.";

export type CoachDraftErrors = {
  category?: string;
  endDate?: string;
  role?: string;
  seasons?: string;
  /** Errori per stagione della schermata "Ruolo per stagione". */
  seasonRows?: Record<string, string>;
  startDate?: string;
  teamName?: string;
};

let draftCounter = 0;

/** Id di gruppo generato dal client, come per il Calciatore: `text`, non uuid. */
export function generateCoachGroupId(): string {
  draftCounter += 1;

  return `coach-${Date.now()}-${draftCounter}`;
}

export function createCoachDraft(
  mode: CoachTemporalMode,
  { defaultRole = "" }: { defaultRole?: string } = {},
): CoachExperienceDraft {
  return {
    category: "",
    clubId: null,
    description: "",
    descriptionBySeason: {},
    groupId: generateCoachGroupId(),
    isOngoing: false,
    mode,
    period: mode === "CUSTOM_PERIOD" ? EMPTY_PERIOD : null,
    persistedId: null,
    persistedIdBySeason: {},
    role: defaultRole,
    seasonDetails: {},
    seasons: [],
    teamLogoUrl: "",
    teamName: "",
  };
}

export const EMPTY_PERIOD: CoachPeriod = {
  endMonth: "",
  endYear: "",
  startMonth: "",
  startYear: "",
};

/** Riapre un gruppo esistente nella stessa bozza usata in creazione (§modifica). */
export function draftFromAssignments(
  assignments: readonly CoachAssignment[],
): CoachExperienceDraft | null {
  if (assignments.length === 0) {
    return null;
  }

  const [head] = assignments;
  const isPeriod = head.mode === "CUSTOM_PERIOD";
  const seasons = assignments
    .map((assignment) => assignment.seasonKey)
    .filter((seasonKey) => seasonKey.length > 0);

  return {
    category: head.category,
    clubId: head.clubId,
    // La descrizione di testata è quella dell'assegnazione che si sta
    // modificando: in un gruppo multi-stagione nessuna la rappresenta tutte,
    // quindi lì resta vuota e ogni stagione conserva la propria.
    description: isPeriod || seasons.length <= 1 ? head.description ?? "" : "",
    descriptionBySeason: Object.fromEntries(
      assignments
        .filter((assignment) => assignment.seasonKey)
        .map((assignment) => [assignment.seasonKey, assignment.description ?? ""]),
    ),
    groupId: head.groupId,
    isOngoing: head.isOngoing,
    // Un gruppo con più stagioni resta multi-stagione anche se era stato
    // salvato come singola e poi ampliato.
    mode: isPeriod ? "CUSTOM_PERIOD" : seasons.length > 1 ? "MULTI_SEASON" : head.mode,
    period: head.period,
    persistedId: isPeriod || seasons.length === 1 ? head.id : null,
    persistedIdBySeason: Object.fromEntries(
      assignments
        .filter((assignment) => assignment.seasonKey)
        .map((assignment) => [assignment.seasonKey, assignment.id]),
    ),
    role: head.role,
    seasonDetails: Object.fromEntries(
      assignments
        .filter((assignment) => assignment.seasonKey)
        .map((assignment) => [
          assignment.seasonKey,
          { category: assignment.category, role: assignment.role },
        ]),
    ),
    seasons,
    teamLogoUrl: head.teamLogoUrl,
    teamName: head.teamName,
  };
}

/**
 * Ruolo e categoria di una stagione. Il prefill guarda, in ordine: quello che
 * l'utente ha già scelto per quella stagione, la riga precedente, i valori di
 * testata della bozza. Resta un valore iniziale, non un legame.
 */
export function resolveSeasonDetail(
  draft: CoachExperienceDraft,
  seasonKey: string,
  previousSeasonKey?: string,
): CoachSeasonDraftDetail {
  const own = draft.seasonDetails[seasonKey];

  if (own) {
    return own;
  }

  const previous = previousSeasonKey
    ? draft.seasonDetails[previousSeasonKey]
    : undefined;

  return {
    category: previous?.category ?? draft.category,
    role: previous?.role ?? draft.role,
  };
}

/** Stagioni della bozza, dalla più recente alla più vecchia. */
export function sortedDraftSeasons(draft: CoachExperienceDraft): string[] {
  return [...new Set(draft.seasons)].sort((left, right) =>
    right.localeCompare(left),
  );
}

// ---------------------------------------------------------------------------
// Bozza → assegnazioni
// ---------------------------------------------------------------------------

let assignmentCounter = 0;

function generateAssignmentId(): string {
  assignmentCounter += 1;

  return `coach-assignment-${Date.now()}-${assignmentCounter}`;
}

export function draftToAssignments(
  draft: CoachExperienceDraft,
): CoachAssignment[] {
  const base = {
    clubId: draft.clubId,
    groupId: draft.groupId,
    teamLogoUrl: draft.teamLogoUrl,
    teamName: draft.teamName.trim(),
  };

  if (draft.mode === "CUSTOM_PERIOD") {
    return [
      {
        ...base,
        category: draft.category,
        description: draft.description,
        id: draft.persistedId ?? generateAssignmentId(),
        isOngoing: draft.isOngoing,
        mode: "CUSTOM_PERIOD",
        period: draft.period ?? EMPTY_PERIOD,
        role: draft.role,
        seasonKey: "",
      },
    ];
  }

  const seasons = sortedDraftSeasons(draft);

  return seasons.map((seasonKey, index) => {
    const detail = resolveSeasonDetail(draft, seasonKey, seasons[index - 1]);

    return {
      ...base,
      category: detail.category,
      /*
        Una stagione sola è un'assegnazione singola e la sua descrizione è
        quella del form; con più stagioni ognuna si tiene la propria, perché
        propagare il testo di una riga alle altre sarebbe un dato inventato.
      */
      description:
        seasons.length === 1
          ? draft.description
          : draft.descriptionBySeason[seasonKey] ?? "",
      // Una stagione già salvata conserva il proprio id anche se il gruppo
      // cambia forma: la modifica resta una modifica, non una ricreazione.
      id:
        draft.persistedIdBySeason[seasonKey] ??
        (seasons.length === 1 && draft.persistedId
          ? draft.persistedId
          : generateAssignmentId()),
      isOngoing: false,
      mode: seasons.length > 1 ? "MULTI_SEASON" : "SINGLE_SEASON",
      period: null,
      role: detail.role,
      seasonKey,
    } satisfies CoachAssignment;
  });
}

// ---------------------------------------------------------------------------
// Duplicati e sovrapposizioni
// ---------------------------------------------------------------------------

function periodSignature(assignment: CoachAssignment): string {
  if (!assignment.period) {
    return "";
  }

  return [
    assignment.period.startMonth,
    assignment.period.startYear,
    assignment.isOngoing ? "ongoing" : assignment.period.endMonth,
    assignment.isOngoing ? "" : assignment.period.endYear,
  ].join("|");
}

/** Firma del duplicato esatto: società, tempo, ruolo, categoria. */
export function assignmentSignature(assignment: CoachAssignment): string {
  return [
    clubIdentity(assignment.clubId, assignment.teamName),
    assignment.mode === "CUSTOM_PERIOD"
      ? `period:${periodSignature(assignment)}`
      : `season:${assignment.seasonKey}`,
    assignment.role.trim().toLowerCase(),
    assignment.category.trim().toLowerCase(),
  ].join("::");
}

/**
 * Duplicati esatti fra le assegnazioni in arrivo e quelle già presenti. Le
 * assegnazioni dello stesso gruppo non contano: stiamo modificando quelle.
 */
export function findDuplicateAssignments(
  incoming: readonly CoachAssignment[],
  existing: readonly CoachAssignment[],
): CoachAssignment[] {
  const takenSignatures = new Set(
    existing
      .filter((assignment) => !incoming.some((item) => item.groupId === assignment.groupId))
      .map(assignmentSignature),
  );

  return incoming.filter((assignment) =>
    takenSignatures.has(assignmentSignature(assignment)),
  );
}

/**
 * Sovrapposizioni temporali con altri incarichi. Non bloccano: un allenatore
 * può guidare due squadre nella stessa stagione, quindi la decisione resta sua.
 */
export function hasOverlappingAssignments(
  incoming: readonly CoachAssignment[],
  existing: readonly CoachAssignment[],
): boolean {
  const occupied = new Set(
    existing
      .filter((assignment) => !incoming.some((item) => item.groupId === assignment.groupId))
      .flatMap(assignmentSeasonKeys),
  );

  return incoming
    .flatMap(assignmentSeasonKeys)
    .some((seasonKey) => occupied.has(seasonKey));
}

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

function periodToComparable(month: string, year: string): number | null {
  const parsedYear = Number.parseInt(year, 10);

  if (Number.isNaN(parsedYear)) {
    return null;
  }

  return parsedYear * 12 + (monthLabelToNumber(month) ?? 1);
}

/** Validazione della schermata "Più stagioni complete — 1 di 2". */
export function validateSeasonsStep(
  draft: CoachExperienceDraft,
): CoachDraftErrors {
  const errors: CoachDraftErrors = {};

  if (!draft.teamName.trim()) {
    errors.teamName = COACH_DRAFT_ERROR_MESSAGES.team;
  }

  if (draft.seasons.length === 0) {
    errors.seasons = COACH_DRAFT_ERROR_MESSAGES.season;
  }

  return errors;
}

/** Validazione della schermata "Ruolo per stagione — 2 di 2". */
export function validateSeasonRolesStep(
  draft: CoachExperienceDraft,
): CoachDraftErrors {
  const seasonRows: Record<string, string> = {};
  const seasons = sortedDraftSeasons(draft);

  seasons.forEach((seasonKey, index) => {
    const detail = resolveSeasonDetail(draft, seasonKey, seasons[index - 1]);

    if (!detail.role.trim()) {
      seasonRows[seasonKey] = COACH_DRAFT_ERROR_MESSAGES.role;
      return;
    }

    if (!detail.category.trim()) {
      seasonRows[seasonKey] = COACH_DRAFT_ERROR_MESSAGES.category;
    }
  });

  return Object.keys(seasonRows).length > 0 ? { seasonRows } : {};
}

/** Validazione di "Singola stagione" e "Periodo personalizzato". */
export function validateSingleAssignmentDraft(
  draft: CoachExperienceDraft,
): CoachDraftErrors {
  const errors: CoachDraftErrors = {};

  if (!draft.teamName.trim()) {
    errors.teamName = COACH_DRAFT_ERROR_MESSAGES.team;
  }

  if (!draft.role.trim()) {
    errors.role = COACH_DRAFT_ERROR_MESSAGES.role;
  }

  if (!draft.category.trim()) {
    errors.category = COACH_DRAFT_ERROR_MESSAGES.category;
  }

  if (draft.mode === "SINGLE_SEASON" && draft.seasons.length === 0) {
    errors.seasons = COACH_DRAFT_ERROR_MESSAGES.season;
  }

  if (draft.mode === "CUSTOM_PERIOD") {
    const period = draft.period ?? EMPTY_PERIOD;
    const start = periodToComparable(period.startMonth, period.startYear);
    const end = periodToComparable(period.endMonth, period.endYear);

    if (start === null) {
      errors.startDate = COACH_DRAFT_ERROR_MESSAGES.startDate;
    }

    // Un incarico in corso non ha una data di fine: non è un campo mancante.
    if (!draft.isOngoing && end === null) {
      errors.endDate = COACH_DRAFT_ERROR_MESSAGES.endDate;
    }

    if (!draft.isOngoing && start !== null && end !== null && end < start) {
      errors.endDate = COACH_DRAFT_ERROR_MESSAGES.endBeforeStart;
    }
  }

  return errors;
}

export function hasDraftErrors(errors: CoachDraftErrors): boolean {
  return (
    Object.entries(errors).filter(([key, value]) =>
      key === "seasonRows"
        ? Object.keys(value as Record<string, string>).length > 0
        : Boolean(value),
    ).length > 0
  );
}

/** Etichetta leggibile dell'assegnazione, per i messaggi di conferma. */
export function describeAssignment(assignment: CoachAssignment): string {
  return assignment.mode === "CUSTOM_PERIOD"
    ? formatPeriodLabel(assignment.period, assignment.isOngoing)
    : formatSeasonLabel(assignment.seasonKey);
}
