/**
 * Modello del composer Position (DAS-REV-16 §6, §7).
 *
 * I nomi seguono il contratto della specifica, non le colonne: `profileType`
 * è `recruiting_ads.target_role`, `scope` è `position_scope_type`. §6 è
 * esplicito — «I nomi tecnici seguenti descrivono il contratto, non
 * impongono nuove tabelle o endpoint omonimi».
 *
 * Due distinzioni che il resto del modulo dà per acquisite:
 *
 *   * **Ambito ≠ Team nullo.** `scope` è il dato; un `teamId` nullo su una
 *     bozza TEAM è una bozza incompleta, non un incarico di club (§6, §35).
 *   * **Batch ≠ squadre dello stesso incarico.** Il primo produce Position
 *     indipendenti (`PositionDraft[]`); il secondo è `secondaryTeams`, una
 *     relazione di **una sola** Position (§15).
 */

/** I quattro profili del composer. `director` è il Dirigente. */
export type PositionProfileType = "player" | "coach" | "staff" | "director";

export type PositionScope = "team" | "society";

/**
 * §13: «Nel modello distingui UNSET, RANGE e UNRESTRICTED o equivalenti; due
 * valori null non devono significare contemporaneamente "non configurato" e
 * "nessun limite".»
 */
export type PositionAgeMode = "unset" | "range" | "unrestricted";

export type PositionAvailabilityMode =
  | "immediate"
  | "from_date"
  | "next_season";

export type PositionAvailability = {
  /** Solo per `from_date`. Data civile `YYYY-MM-DD`, senza fuso (§19). */
  date?: string | null;
  mode: PositionAvailabilityMode;
  /** Solo per `next_season`. Riferimento risolto alla conferma (§19). */
  seasonId?: string | null;
};

/** Esperienza Calciatore: scelta **singola**, rimovibile (§14). */
export type PositionPlayerExperience = {
  /** Solo per `from_category`: soglia, non uguaglianza esatta (§14). */
  levelId?: string | null;
  mode: "in_category" | "higher_categories" | "from_category";
};

export type PositionPlayerSituation = "free_agent" | "open_to_transfer";

/**
 * Dettagli tipizzati, serializzati in `recruiting_ads.details`.
 *
 * Una chiave assente significa «non specificato» e viene omessa dal payload
 * pubblico (§20). Una patch che non la nomina non la tocca (§21).
 */
export type PositionDetails = {
  availability?: PositionAvailability;
  /** Patentino Allenatore: id del catalogo, mai testo libero (§15). */
  coachQualificationId?: string;
  /** Multi-select Coach/Staff/Dirigente, id canonici del proprio profilo. */
  experience?: string[];
  playerExperience?: PositionPlayerExperience;
  playerSituation?: PositionPlayerSituation;
  requirements?: string;
  /** Aree di responsabilità del Dirigente: testo libero (§17). */
  responsibilities?: string;
  /** Qualifica Staff: testo libero breve, non un qualification ID (§16). */
  staffQualification?: string;
};

export type PositionSecondaryTeam = {
  isInactive: boolean;
  name: string;
  teamId: string;
};

/**
 * Codici di non pubblicabilità emessi da `position_publish_blockers`.
 *
 * §12 chiede di tenere distinti i motivi: un dato mancante non è un Team
 * diventato inutilizzabile, e nessuno dei due è un errore di rete — che
 * infatti non compare in questa lista.
 */
export type PositionBlocker =
  | "AGE_OUT_OF_BOUNDS"
  | "AGE_RANGE_INCOMPLETE"
  | "AGE_RANGE_INVALID"
  | "AGE_UNSET"
  | "AVAILABILITY_DATE_INVALID"
  | "AVAILABILITY_INVALID"
  | "AVAILABILITY_SEASON_INVALID"
  | "CUSTOM_ROLE_MISSING"
  | "DEADLINE_PASSED"
  | "DESCRIPTION_TOO_LONG"
  | "EXPERIENCE_CATEGORY_INVALID"
  | "EXPERIENCE_INVALID"
  | "EXPERIENCE_NEEDS_TEAM_CONTEXT"
  | "POSITION_NOT_FOUND"
  | "QUALIFICATION_INVALID"
  | "REQUIREMENTS_TOO_LONG"
  | "RESPONSIBILITIES_TOO_LONG"
  | "ROLE_INVALID"
  | "ROLE_MISSING"
  | "SCOPE_CONFLICT"
  | "SCOPE_NOT_ALLOWED"
  | "SECONDARY_TEAM_UNAVAILABLE"
  | "SITUATION_INVALID"
  | "STAFF_QUALIFICATION_TOO_LONG"
  | "TEAM_MISSING"
  | "TEAM_UNAVAILABLE";

/**
 * Una Position della sessione, letta da `fetch_position_drafts`.
 *
 * `blockers` e `hasDetails` sono **derivazioni** calcolate dal server a ogni
 * lettura, non colonne: §6 vieta stati READY o ENRICHED persistiti.
 */
export type PositionDraft = {
  ageMax: number | null;
  ageMin: number | null;
  ageMode: PositionAgeMode;
  blockers: PositionBlocker[];
  canEdit: boolean;
  canPublish: boolean;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  clubRegion: string | null;
  /** Livello/categoria della TeamSeason. `null` su un incarico SOCIETY. */
  contextLabel: string | null;
  creationBatchId: string | null;
  customRoleName: string | null;
  /** Giorno civile nel fuso della Società, già convertito dal server (§23). */
  deadlineDate: string | null;
  deadlineTimezone: string | null;
  description: string | null;
  details: PositionDetails;
  hasDetails: boolean;
  id: string;
  profileType: PositionProfileType;
  publishedAt: string | null;
  resourceVersion: number;
  roleId: string | null;
  roleIsCustom: boolean;
  roleLabel: string | null;
  schemaVersion: number;
  scope: PositionScope;
  secondaryTeams: PositionSecondaryTeam[];
  status: string;
  teamId: string | null;
  teamName: string | null;
  /** Derivato da ruolo o nome custom, mai chiesto nello step 1 (§8). */
  title: string | null;
  updatedAt: string | null;
};

/** Identità, capability e limiti del composer (§5, §20). */
export type PositionComposerContext = {
  accessVerifiedAt: number;
  canCreate: boolean;
  /** Vero solo con perimetro Society-wide: un incarico di club lo esige (§5). */
  canCreateSociety: boolean;
  canPublish: boolean;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  clubRegion: string | null;
  limits: PositionLimits;
  schemaVersion: number;
  timezoneName: string;
};

/** §20: «una sola configurazione iniziale, condivisa client/server». */
export type PositionLimits = {
  ageMax: number;
  ageMin: number;
  customRoleName: number;
  description: number;
  requirements: number;
  responsibilities: number;
  staffQualification: number;
};

export type PositionEligibleTeam = {
  canCreate: boolean;
  canPublish: boolean;
  contextLabel: string | null;
  teamId: string;
  teamName: string;
};

export type PositionCatalogItem = {
  id: string;
  isCustom: boolean;
  label: string;
  /** Criterio relativo: richiede un contesto Team per avere senso (§17). */
  needsContext: boolean;
};

export type PositionCatalogs = {
  categories: PositionCatalogItem[];
  experiences: PositionCatalogItem[];
  qualifications: PositionCatalogItem[];
  roles: PositionCatalogItem[];
  seasons: PositionCatalogItem[];
};

/** Stato derivato di una riga dell'hub (§12). Non è un lifecycle. */
export type PositionReadiness =
  | "incomplete"
  | "ready"
  | "ready_without_details"
  | "suggest_details";
