/**
 * Copy, stati derivati e validazione locale del composer (DAS-REV-16 §12,
 * §31).
 *
 * «La validazione server è autorevole. Il client applica le stesse regole
 * per feedback immediato, senza diventare l'unico guard» (§7). Le funzioni
 * qui dentro anticipano il verdetto del server: non lo sostituiscono, e
 * nessuna di esse decide se una pubblicazione è lecita.
 */
import {
  AVAILABILITY_LABELS,
  PLAYER_EXPERIENCE_LABELS,
  PLAYER_SITUATION_LABELS,
  POSITION_SCHEMAS,
} from "./compose-schema";
import type { PositionField } from "./compose-schema";
import type { ComposeError } from "./compose-service";
import type {
  PositionAgeMode,
  PositionAvailability,
  PositionBlocker,
  PositionCatalogItem,
  PositionDetailsForm,
  PositionDraft,
  PositionEligibleTeam,
  PositionLimits,
  PositionReadiness,
  PositionSecondaryTeam,
} from "./compose-types";

/** Le copy minime di §31, in un posto solo. */
export const COMPOSE_COPY = {
  ageBoth: "Indica entrambe le età.",
  ageInvalid: "Inserisci un'età valida.",
  ageOrder: "L'età minima non può essere superiore all'età massima.",
  ageRequired: "Imposta la fascia d'età oppure scegli Nessun limite di età.",
  changeConfirmBody:
    "Cambiare questi dati? Alcuni dettagli già inseriti non saranno più utilizzabili.",
  changeConfirmKeep: "Continua a modificare",
  changeConfirmOk: "Conferma modifica",
  completeAtLeastOne: "Completa almeno una posizione per continuare.",
  dateInvalid: "Inserisci una data valida.",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitDiscard: "Esci senza salvare",
  exitKeep: "Continua a modificare",
  exitSave: "Salva bozza ed esci",
  exitTitle: "Uscire senza salvare?",
  loadOptionsFailed: "Non è stato possibile caricare le opzioni. Riprova.",
  noAgeLimit: "Nessun limite di età",
  offline: "Connessione assente. Riprova quando sei online.",
  profileRequired: "Seleziona il profilo da cercare.",
  publishFailed: "Non è stato possibile pubblicare. Riprova.",
  publishLost: "Non hai più il permesso di pubblicare queste posizioni.",
  roleCustomRequired: "Specifica il ruolo per continuare.",
  roleRequired: "Seleziona un ruolo.",
  saveFailed: "Non è stato possibile salvare la bozza. Riprova.",
  scopeRequired: "Seleziona l'ambito dell'incarico.",
  selectionChanged:
    "Una posizione selezionata è cambiata. Controlla i dettagli prima di pubblicare.",
  selectionRequired: "Seleziona almeno una posizione da pubblicare.",
  societyScopeLabel: "Intera società",
  teamRequired: "Seleziona una squadra.",
  teamUnavailable: "Questa squadra non è più disponibile per la posizione.",
  textTooLong: "Il testo supera il limite consentito.",
  versionConflict:
    "La posizione è stata aggiornata. Ricarica i dati prima di salvare.",
} as const;

/**
 * §12, tabella «Condizione della DRAFT → Presentazione e azione».
 *
 * Quattro stati **derivati**, non quattro lifecycle: §6 vieta di
 * persisterli. `suggest_details` è guidance, non un errore — e infatti la
 * CTA resta attiva.
 */
export function readinessOf(draft: PositionDraft): PositionReadiness {
  if (draft.blockers.length > 0) {
    return "incomplete";
  }

  if (draft.hasDetails) {
    return "ready";
  }

  /* §12: l'Allenatore valido senza dettagli è già «Pronta per la
     pubblicazione»; Staff e Dirigente ricevono invece l'invito ad
     aggiungerli. La differenza viene dalla configurazione del profilo, non
     da un elenco di eccezioni. */
  return POSITION_SCHEMAS[draft.profileType].guidance === null
    ? "ready_without_details"
    : "suggest_details";
}

export function readinessLabel(readiness: PositionReadiness): string {
  switch (readiness) {
    case "incomplete":
      return "Da completare";
    case "suggest_details":
      return "Aggiungi dettagli per completare l'annuncio";
    default:
      return "Pronta per la pubblicazione";
  }
}

export function readinessActionLabel(
  readiness: PositionReadiness,
  hasDetails: boolean,
): string {
  if (readiness === "incomplete") {
    return "Completa";
  }

  return hasDetails ? "Modifica" : "Aggiungi dettagli";
}

/** Una bozza è pubblicabile quando il server non ha restituito blockers. */
export function isPublishable(draft: PositionDraft): boolean {
  return draft.blockers.length === 0 && draft.canPublish;
}

/** §12: la copy del blocker, per campo e comprensibile. */
export function describeBlocker(blocker: PositionBlocker): string {
  switch (blocker) {
    case "AGE_UNSET":
      return COMPOSE_COPY.ageRequired;
    case "AGE_RANGE_INCOMPLETE":
      return COMPOSE_COPY.ageBoth;
    case "AGE_RANGE_INVALID":
      return COMPOSE_COPY.ageOrder;
    case "AGE_OUT_OF_BOUNDS":
      return COMPOSE_COPY.ageInvalid;
    case "CUSTOM_ROLE_MISSING":
      return COMPOSE_COPY.roleCustomRequired;
    case "ROLE_MISSING":
      return COMPOSE_COPY.roleRequired;
    case "TEAM_MISSING":
      return COMPOSE_COPY.teamRequired;
    case "TEAM_UNAVAILABLE":
    case "SECONDARY_TEAM_UNAVAILABLE":
      return COMPOSE_COPY.teamUnavailable;
    case "DEADLINE_PASSED":
      return "La scadenza è già passata. Scegli una nuova data o rimuovila.";
    case "AVAILABILITY_DATE_INVALID":
      return COMPOSE_COPY.dateInvalid;
    case "EXPERIENCE_NEEDS_TEAM_CONTEXT":
      return "Un criterio di esperienza richiede una squadra di riferimento. Rivedilo prima di pubblicare.";
    case "DESCRIPTION_TOO_LONG":
    case "REQUIREMENTS_TOO_LONG":
    case "RESPONSIBILITIES_TOO_LONG":
    case "STAFF_QUALIFICATION_TOO_LONG":
      return COMPOSE_COPY.textTooLong;
    case "SCOPE_CONFLICT":
    case "SCOPE_NOT_ALLOWED":
      return COMPOSE_COPY.scopeRequired;
    default:
      return "Rivedi i dati della posizione prima di pubblicare.";
  }
}

/** §31: errori tecnici fuori dalla UI, un messaggio per ogni causa reale. */
export function describeComposeError(error: ComposeError): string {
  switch (error.code) {
    case "POSITION_COMPOSER_NOT_AUTHORIZED":
    case "POSITION_NOT_AUTHORIZED":
      return "Non hai più accesso alle posizioni di questa società.";
    case "POSITION_PUBLISH_NOT_AUTHORIZED":
      return COMPOSE_COPY.publishLost;
    case "POSITION_VERSION_CONFLICT":
      return COMPOSE_COPY.versionConflict;
    case "POSITION_LIFECYCLE_CONFLICT":
      return COMPOSE_COPY.selectionChanged;
    case "POSITION_IDENTITY_LOCKED":
      /* DAS-REV-17 §28, riga «Identificativi bloccati nell'attiva». */
      return "Le informazioni identificative non possono essere modificate dopo la pubblicazione.";
    case "POSITION_FIELD_NOT_EDITABLE":
      return "Uno dei campi inviati non è modificabile in questo stato.";
    case "POSITION_AGE_UNSET_NOT_ALLOWED":
      return COMPOSE_COPY.ageRequired;
    case "POSITION_SECONDARY_TEAM_IS_PRIMARY":
      return "La squadra principale non può essere anche una squadra secondaria.";
    case "POSITION_PATCH_INVALID":
      return COMPOSE_COPY.saveFailed;
    case "POSITION_NOT_AVAILABLE":
      return "Questa posizione non è più disponibile.";
    case "POSITION_NOT_PUBLISHABLE":
      return error.blockers.length > 0
        ? describeBlocker(error.blockers[0])
        : COMPOSE_COPY.publishFailed;
    case "POSITION_TEAM_NOT_ELIGIBLE":
      return COMPOSE_COPY.teamUnavailable;
    case "POSITION_TEAM_REQUIRED":
      return COMPOSE_COPY.teamRequired;
    case "POSITION_CUSTOM_ROLE_REQUIRED":
      return COMPOSE_COPY.roleCustomRequired;
    case "POSITION_CUSTOM_ROLE_TOO_LONG":
      return COMPOSE_COPY.textTooLong;
    case "POSITION_ROLE_INVALID":
      return COMPOSE_COPY.roleRequired;
    case "POSITION_SELECTION_EMPTY":
      return COMPOSE_COPY.selectionRequired;
    case "POSITION_SCOPE_NOT_ALLOWED":
      return "Non puoi creare un incarico per l'intera società.";
    case "POSITION_OPERATION_CONFLICT":
      return "I dati della richiesta sono cambiati. Riprova.";
    case "POSITION_NOT_FOUND":
      return "Questa posizione non è più disponibile.";
    default:
      return COMPOSE_COPY.saveFailed;
  }
}

// ── Etichette dei valori ────────────────────────────────────────────────────

/** §13: «18–25 anni» oppure «Nessun limite di età». */
export function ageSummary(draft: {
  ageMax: number | null;
  ageMin: number | null;
  ageMode: string;
}): string | null {
  if (draft.ageMode === "unrestricted") {
    return COMPOSE_COPY.noAgeLimit;
  }

  if (draft.ageMode === "range" && draft.ageMin !== null && draft.ageMax !== null) {
    return `${draft.ageMin}–${draft.ageMax} anni`;
  }

  return null;
}

export function availabilitySummary(
  availability: PositionAvailability | undefined,
  seasons: readonly PositionCatalogItem[],
): string | null {
  if (!availability) {
    return null;
  }

  if (availability.mode === "from_date" && availability.date) {
    const parts = availability.date.split("-");

    return parts.length === 3
      ? `Da ${parts[2]}/${parts[1]}/${parts[0]}`
      : AVAILABILITY_LABELS.from_date;
  }

  if (availability.mode === "next_season") {
    const season = seasons.find((entry) => entry.id === availability.seasonId);

    return season
      ? `${AVAILABILITY_LABELS.next_season} · ${season.label}`
      : AVAILABILITY_LABELS.next_season;
  }

  return AVAILABILITY_LABELS[availability.mode] ?? null;
}

export function playerExperienceSummary(
  experience: PositionDraft["details"]["playerExperience"],
  categories: readonly PositionCatalogItem[],
): string | null {
  if (!experience) {
    return null;
  }

  if (experience.mode === "from_category") {
    const level = categories.find((entry) => entry.id === experience.levelId);

    /* §14: «selezionare Serie D produce il significato Serie D o categorie
       superiori». La soglia si legge nella label, non solo nei dati. */
    return level ? `${level.label} o categorie superiori` : null;
  }

  return PLAYER_EXPERIENCE_LABELS[experience.mode] ?? null;
}

export function situationSummary(
  situation: PositionDraft["details"]["playerSituation"],
): string | null {
  return situation ? (PLAYER_SITUATION_LABELS[situation] ?? null) : null;
}

export function experienceSummary(
  ids: readonly string[] | undefined,
  catalog: readonly PositionCatalogItem[],
): string | null {
  if (!ids || ids.length === 0) {
    return null;
  }

  const labels = catalog
    .filter((entry) => ids.includes(entry.id))
    .map((entry) => entry.label);

  return labels.length > 0 ? labels.join(" · ") : null;
}

/**
 * §9 e §17: il contesto sotto il titolo. Un incarico SOCIETY mostra «Intera
 * società» e **nessuna** categoria; un incarico TEAM la squadra e il livello
 * reale.
 */
export function contextSummary(draft: {
  contextLabel: string | null;
  scope: string;
  teamName: string | null;
}): string {
  if (draft.scope === "society") {
    return COMPOSE_COPY.societyScopeLabel;
  }

  const parts = [draft.teamName ?? "Squadra da definire"];

  if (draft.contextLabel) {
    parts.push(draft.contextLabel);
  }

  return parts.join(" · ");
}

/** §15: «Lo stesso allenatore seguirà anche Under 15.» */
export function secondaryTeamsHelper(
  profileType: PositionDraft["profileType"],
  names: readonly string[],
): string | null {
  if (names.length === 0) {
    return null;
  }

  const subject = profileType === "coach" ? "Lo stesso allenatore" : "La stessa persona";

  return `${subject} seguirà anche ${listNames(names)}.`;
}

export function listNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }

  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

// ── Conteggi e plurali ──────────────────────────────────────────────────────

export function positionsCount(count: number): string {
  return count === 1 ? "1 posizione" : `${count} posizioni`;
}

/** §11: «Continua con N posizioni». */
export function continueLabel(count: number): string {
  return `Continua con ${positionsCount(count)}`;
}

/** §24: «Pubblica 1 posizione», «Pubblica 2 posizioni». */
export function publishLabel(count: number): string {
  return `Pubblica ${positionsCount(count)}`;
}

/** §11: «La posizione Primavera resterà in bozza.» */
export function remainingDraftsHelper(names: readonly string[]): string | null {
  if (names.length === 0) {
    return null;
  }

  return names.length === 1
    ? `La posizione ${names[0]} resterà in bozza.`
    : `${names.length} posizioni resteranno in bozza.`;
}

/** §24: «1 posizione resterà in bozza». */
export function remainingCountHelper(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return count === 1
    ? "1 posizione resterà in bozza"
    : `${count} posizioni resteranno in bozza`;
}

/** §26: «2 posizioni pubblicate», «1 pubblicata · 1 conservata in bozza». */
export function publishSuccessMessage(
  published: number,
  remaining: number,
): string {
  const head = published === 1 ? "Posizione pubblicata" : `${published} posizioni pubblicate`;

  if (remaining <= 0) {
    return head;
  }

  const tail =
    remaining === 1 ? "1 conservata in bozza" : `${remaining} conservate in bozza`;

  return `${head} · ${tail}`;
}

export function saveDraftsMessage(count: number): string {
  return count === 1 ? "Bozza salvata" : "Bozze salvate";
}

// ── Validazione locale (anticipa il server, non lo sostituisce) ─────────────

export type AgeDraftInput = {
  max: string;
  min: string;
  mode: "range" | "unrestricted";
};

/* I soli due limiti che riguardano l'età: chiedere l'intero `PositionLimits`
   costringerebbe chi valida un campo a procurarsi anche i limiti dei testi. */
export function validateAgeInput(
  input: AgeDraftInput,
  limits: Pick<PositionLimits, "ageMax" | "ageMin">,
): string | null {
  if (input.mode === "unrestricted") {
    return null;
  }

  const min = input.min.trim();
  const max = input.max.trim();

  if (min === "" || max === "") {
    return COMPOSE_COPY.ageBoth;
  }

  if (!/^\d+$/.test(min) || !/^\d+$/.test(max)) {
    return COMPOSE_COPY.ageInvalid;
  }

  const minValue = Number(min);
  const maxValue = Number(max);

  if (
    minValue < limits.ageMin ||
    maxValue > limits.ageMax ||
    maxValue < limits.ageMin
  ) {
    return COMPOSE_COPY.ageInvalid;
  }

  if (minValue > maxValue) {
    return COMPOSE_COPY.ageOrder;
  }

  return null;
}

export function validateCustomRoleName(
  value: string,
  limits: Pick<PositionLimits, "customRoleName">,
): string | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return COMPOSE_COPY.roleCustomRequired;
  }

  /* §20: conteggio Unicode coerente. `Array.from` conta i code point, non le
     code unit UTF-16, così un'emoji o una lettera accentata composta non
     vale due caratteri. */
  return Array.from(trimmed).length > limits.customRoleName
    ? COMPOSE_COPY.textTooLong
    : null;
}

export function validateText(value: string, limit: number): string | null {
  return Array.from(value.trim()).length > limit
    ? COMPOSE_COPY.textTooLong
    : null;
}

export function textLength(value: string): number {
  return Array.from(value).length;
}

/**
 * §22: «Se una modifica rende incompatibili dettagli già presenti, elenca
 * sinteticamente le aree interessate e richiedi conferma prima di
 * rimuoverle.» Nessuna conversione automatica fra schemi: §22 vieta
 * Coach→Staff che trasforma un patentino in testo libero.
 */
export function incompatibleAreas(
  from: PositionDraft,
  next: { profileType: PositionDraft["profileType"]; scope: PositionDraft["scope"] },
): string[] {
  const areas: string[] = [];

  if (from.profileType !== next.profileType) {
    if (from.ageMode !== "unset") {
      areas.push("Fascia d'età");
    }

    if (from.details.playerExperience || from.details.playerSituation) {
      areas.push("Esperienza e situazione del calciatore");
    }

    if (from.details.coachQualificationId) {
      areas.push("Patentino richiesto");
    }

    if (from.details.staffQualification) {
      areas.push("Qualifica richiesta");
    }

    if (from.details.responsibilities) {
      areas.push("Aree di responsabilità");
    }

    if ((from.details.experience ?? []).length > 0) {
      areas.push("Esperienza richiesta");
    }
  }

  if (from.scope !== next.scope && from.secondaryTeams.length > 0) {
    areas.push("Altre squadre coinvolte nell'incarico");
  }

  return areas;
}

// ── Buffer dei dettagli: lettura, differenza e validazione ─────────────────
//
// Tre funzioni pure condivise dalle due superfici che montano
// `PositionSchemaFields`: lo step 2 del composer e l'editor di una Position
// già persistita (DAS-REV-17 §20). Stanno qui e non nel componente perché
// §35 chiede test che verifichino «contratti e rischi reali, evitando una
// copia delle condizioni del componente come unica prova»: una patch si
// verifica chiamando una funzione, non montando un form.

/** Lo snapshot persistito, letto come buffer di form. */
export function formFromDraft(draft: {
  ageMax: number | null;
  ageMin: number | null;
  ageMode: PositionAgeMode;
  description: string | null;
  details: PositionDraft["details"];
  secondaryTeams: readonly { teamId: string }[];
}): PositionDetailsForm {
  return {
    ageMax: draft.ageMax !== null ? String(draft.ageMax) : "",
    ageMin: draft.ageMin !== null ? String(draft.ageMin) : "",
    ageMode: draft.ageMode,
    availability: draft.details.availability ?? null,
    coachQualificationId: draft.details.coachQualificationId ?? null,
    description: draft.description ?? "",
    experience: draft.details.experience ?? [],
    playerExperience: draft.details.playerExperience ?? null,
    playerSituation: draft.details.playerSituation ?? null,
    requirements: draft.details.requirements ?? "",
    responsibilities: draft.details.responsibilities ?? "",
    secondaryTeamIds: draft.secondaryTeams.map((team) => team.teamId),
    staffQualification: draft.details.staffQualification ?? "",
  };
}

/** Forma minima della patch prodotta dal form dei dettagli. */
export type PositionDetailsPatch = Partial<{
  ageMax: number | null;
  ageMin: number | null;
  ageMode: PositionAgeMode;
  description: string | null;
  details: Partial<{
    availability: PositionAvailability | null;
    coachQualificationId: string | null;
    experience: string[] | null;
    playerExperience: PositionDraft["details"]["playerExperience"] | null;
    playerSituation: PositionDraft["details"]["playerSituation"] | null;
    requirements: string | null;
    responsibilities: string | null;
    staffQualification: string | null;
  }>;
  secondaryTeamIds: string[];
}>;

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  return sortedA.every((value, index) => value === sortedB[index]);
}

/**
 * La differenza fra lo snapshot persistito e il buffer (§21; DAS-REV-17 §12).
 *
 * «Usa patch parziali. Un campo non presente nel comando significa nessuna
 * modifica; un azzeramento esplicito significa rimozione soltanto se
 * permessa. Non serializzare automaticamente tutti i campi non visibili come
 * null.» Da qui una chiave per ogni campo **cambiato**, e nessuna per gli
 * altri: è ciò che preserva i dati legacy che questo client non conosce.
 */
export function buildDetailsPatch(
  original: PositionDetailsForm,
  next: PositionDetailsForm,
): PositionDetailsPatch {
  const patch: PositionDetailsPatch = {};

  if (next.description !== original.description) {
    patch.description = next.description.trim() === "" ? null : next.description;
  }

  if (
    next.ageMode !== original.ageMode ||
    next.ageMin !== original.ageMin ||
    next.ageMax !== original.ageMax
  ) {
    patch.ageMode = next.ageMode;
    patch.ageMin = next.ageMode === "range" ? Number(next.ageMin) : null;
    patch.ageMax = next.ageMode === "range" ? Number(next.ageMax) : null;
  }

  if (!sameSet(next.secondaryTeamIds, original.secondaryTeamIds)) {
    patch.secondaryTeamIds = next.secondaryTeamIds;
  }

  const details: NonNullable<PositionDetailsPatch["details"]> = {};

  if (JSON.stringify(next.availability) !== JSON.stringify(original.availability)) {
    details.availability = next.availability ?? null;
  }

  if (!sameSet(next.experience, original.experience)) {
    details.experience = next.experience.length > 0 ? next.experience : null;
  }

  if (
    JSON.stringify(next.playerExperience) !==
    JSON.stringify(original.playerExperience)
  ) {
    details.playerExperience = next.playerExperience ?? null;
  }

  if (next.playerSituation !== original.playerSituation) {
    details.playerSituation = next.playerSituation ?? null;
  }

  if (next.coachQualificationId !== original.coachQualificationId) {
    details.coachQualificationId = next.coachQualificationId ?? null;
  }

  if (next.staffQualification !== original.staffQualification) {
    details.staffQualification =
      next.staffQualification.trim() === "" ? null : next.staffQualification;
  }

  if (next.requirements !== original.requirements) {
    details.requirements =
      next.requirements.trim() === "" ? null : next.requirements;
  }

  if (next.responsibilities !== original.responsibilities) {
    details.responsibilities =
      next.responsibilities.trim() === "" ? null : next.responsibilities;
  }

  if (Object.keys(details).length > 0) {
    patch.details = details;
  }

  return patch;
}

/**
 * Validazione locale dei soli campi presenti nello schema (§7).
 *
 * «La validazione server è autorevole. Il client applica le stesse regole
 * per feedback immediato, senza diventare l'unico guard.» Non decide quindi
 * se una Position sia pubblicabile: controlla la forma di ciò che è stato
 * digitato, e `position_publish_blockers` resta l'autorità.
 */
export function detailsFormErrors(
  form: PositionDetailsForm,
  fields: readonly PositionField[],
  limits: PositionLimits,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};

  if (
    fields.some((field) => field.kind === "ageRange") &&
    form.ageMode === "range"
  ) {
    const error = validateAgeInput(
      { max: form.ageMax, min: form.ageMin, mode: "range" },
      limits,
    );

    if (error) {
      errors.ageRange = error;
    }
  }

  for (const field of fields) {
    if (
      (field.kind === "shortText" || field.kind === "longText") &&
      field.limitKey
    ) {
      const value = (form as unknown as Record<string, string>)[field.key] ?? "";
      const error = validateText(value, limits[field.limitKey]);

      if (error) {
        errors[field.key] = error;
      }
    }
  }

  return errors;
}

/**
 * Le squadre nominabili come secondarie (§27).
 *
 * Alle eleggibili si aggiungono quelle **già collegate**: una secondaria
 * disattivata non compare fra le eleggibili, e §27 vieta di «usare una
 * lista di opzioni vuota come prova che le relazioni sono state rimosse».
 * Senza questa fusione il form mostrerebbe un campo vuoto al posto di una
 * relazione che esiste, e il salvataggio la cancellerebbe.
 */
export function mergeSecondaryTeamOptions(
  eligible: readonly PositionEligibleTeam[],
  linked: readonly PositionSecondaryTeam[],
): PositionEligibleTeam[] {
  const out = [...eligible];

  for (const team of linked) {
    if (out.some((entry) => entry.teamId === team.teamId)) {
      continue;
    }

    out.push({
      /* Non eleggibile per una **nuova** selezione, ma presente: resta
         leggibile e rimovibile, non viene riproposta come scelta. */
      canCreate: false,
      canPublish: false,
      contextLabel: null,
      teamId: team.teamId,
      teamName: team.name,
    });
  }

  return out;
}
