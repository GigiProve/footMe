/**
 * Derivazioni del Master Profile Dirigente (REV-PROF-09).
 *
 * Il Dirigente non ha un modello di carriera proprio: gli incarichi passano
 * per `coach-career-model`, lo stesso che leggono Allenatore e Staff tecnico,
 * e le esperienze da ex calciatore per `player-career-model`. Qui vive solo
 * ciò che manca a quei modelli per leggere *questi* record: la carriera del
 * Dirigente non sta su una tabella ma dentro `director_profiles` come JSON
 * nella forma dell'onboarding (`CoachCareerEntry`, camelCase), quindi va
 * tradotta nella forma canonica prima di entrare nel modello condiviso.
 *
 * La traduzione è difensiva per necessità: la colonna è `jsonb` e nessun
 * vincolo garantisce la forma delle righe scritte prima della review. Una riga
 * illeggibile viene scartata, non fatta esplodere addosso al profilo.
 *
 * È anche la frontiera della migrazione di REV-PROF-10: le righe vecchie
 * portano N stagioni in un record solo, quelle nuove una stagione per record
 * con un `experienceGroupId` in comune. Entrambe le forme attraversano questa
 * funzione e arrivano identiche al modello condiviso — nessuna riscrittura del
 * dato è necessaria perché il profilo si legga.
 *
 * Nessun conteggio è memorizzato: ruoli, stagioni e società sono sempre
 * ricalcolati dai record, perché una colonna `director_season_count`
 * divergerebbe dalla carriera alla prima modifica.
 */
import type { PlayerExperienceForm } from "../player-sports";
import {
  buildCareerView,
  getCurrentExperience,
  type CareerEntryLike,
  type CoachCareerExperience,
  type CoachCareerView,
} from "./coach-career-model";
import { buildPlayerCareerView } from "./player-career-model";

/** Percorso professionale mostrato dal selettore della tab Carriera. */
export type DirectorCareerPath =
  | "director"
  | "coach"
  | "staff"
  | "player"
  | "other";

export type DirectorProfileCareer = {
  /** Categorie distinte ricavate dalla sola carriera dirigenziale. */
  categories: string[];
  /** Società dirigenziali distinte. */
  clubCount: number;
  /** Vista canonica del percorso da allenatore. */
  coach: CoachCareerView;
  coachExperienceCount: number;
  /** Incarico attuale, o `null` se nessuno è in corso. */
  currentExperience: CoachCareerExperience | null;
  /** Vista canonica del percorso dirigenziale. */
  director: CoachCareerView;
  /** Esperienze in ruoli senza un flusso carriera dedicato (REV-ONB-07 §AG). */
  other: CoachCareerView;
  otherExperienceCount: number;
  /** Carriera da ex calciatore, già nella forma che il Calciatore legge. */
  playerForms: PlayerExperienceForm[];
  playerExperienceCount: number;
  /** Ruoli dirigenziali distinti fra profilo e carriera. */
  roleCount: number;
  /** Vista canonica del percorso nello staff tecnico. */
  staff: CoachCareerView;
  staffExperienceCount: number;
};

// ---------------------------------------------------------------------------
// Lettura difensiva del JSON
// ---------------------------------------------------------------------------

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  return typeof value === "string" ? value.trim() : "";
}

/** Un anno scritto come numero o come stringa vale lo stesso anno. */
function readYear(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readSeasons(record: Record<string, unknown>): string[] {
  const value = record.seasons;

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((season): season is string => typeof season === "string")
    .map((season) => season.trim())
    .filter(Boolean);
}

function readSeasonDetails(
  record: Record<string, unknown>,
): Record<string, { category?: string; role?: string }> {
  const raw = toRecord(record.seasonDetails) ?? toRecord(record.season_details);

  if (!raw) {
    return {};
  }

  const details: Record<string, { category?: string; role?: string }> = {};

  for (const [seasonKey, value] of Object.entries(raw)) {
    const detail = toRecord(value);

    if (!detail) {
      continue;
    }

    details[seasonKey] = {
      category: readText(detail, "category"),
      role: readText(detail, "role"),
    };
  }

  return details;
}

function readExperienceType(
  record: Record<string, unknown>,
  seasonCount: number,
): CareerEntryLike["experience_type"] {
  const value = readText(record, "type") || readText(record, "experience_type");

  if (
    value === "MULTI_SEASON" ||
    value === "SINGLE_SEASON" ||
    value === "CUSTOM_PERIOD"
  ) {
    return value;
  }

  return seasonCount > 1 ? "MULTI_SEASON" : "SINGLE_SEASON";
}

/**
 * Una riga JSON dell'onboarding nella forma canonica letta dal modello
 * condiviso. Il nome società è l'unico campo davvero obbligatorio: senza non
 * c'è un'esperienza da mostrare.
 */
function toCareerEntry(
  value: unknown,
  index: number,
  prefix: string,
): CareerEntryLike | null {
  const record = toRecord(value);

  if (!record) {
    return null;
  }

  const teamName = readText(record, "teamName") || readText(record, "team_name");

  if (!teamName) {
    return null;
  }

  const seasons = readSeasons(record);
  /*
    Due forme per lo stesso dato: l'onboarding scrive un oggetto `period`
    annidato, le righe più vecchie i quattro campi piatti in snake_case. Il
    vecchio profilo Dirigente le leggeva entrambe e continuano a farlo: una
    migrazione distruttiva non è necessaria per mostrarle.
  */
  const period = toRecord(record.period);
  const periodFields = period
    ? {
        endMonth: readText(period, "endMonth") || null,
        endYear: readYear(period, "endYear"),
        startMonth: readText(period, "startMonth") || null,
        startYear: readYear(period, "startYear"),
      }
    : {
        endMonth: readText(record, "period_end_month") || null,
        endYear: readYear(record, "period_end_year"),
        startMonth: readText(record, "period_start_month") || null,
        startYear: readYear(record, "period_start_year"),
      };

  return {
    category: readText(record, "category") || null,
    club_id: readText(record, "clubId") || readText(record, "club_id") || null,
    description: readText(record, "description") || null,
    /*
      Il gruppo tiene insieme le stagioni nate da un solo inserimento
      multi-stagione. Le righe scritte dall'onboarding non ce l'hanno — una
      riga era già l'esperienza intera — e senza gruppo ognuna resta
      un'esperienza a sé, che è esattamente ciò che erano. Da REV-PROF-10 la
      gestione carriera scrive una riga per stagione e marca il gruppo, quindi
      leggerlo è ciò che tiene unite quelle stagioni nel Master Profile.
    */
    experience_group_id:
      readText(record, "experienceGroupId") ||
      readText(record, "experience_group_id") ||
      null,
    experience_type: readExperienceType(record, seasons.length),
    id: readText(record, "id") || `${prefix}-${index}`,
    period_end_month: periodFields.endMonth,
    period_end_year: periodFields.endYear,
    period_start_month: periodFields.startMonth,
    period_start_year: periodFields.startYear,
    results: [],
    role: readText(record, "role"),
    season_details: readSeasonDetails(record),
    seasons,
    sort_order: index,
    team_logo_url:
      readText(record, "teamLogoUrl") || readText(record, "team_logo_url") || null,
    team_name: teamName,
  } satisfies CareerEntryLike;
}

export function parseDirectorCareerEntries(
  entries: readonly unknown[] | null | undefined,
  prefix: string,
): CareerEntryLike[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => toCareerEntry(entry, index, prefix))
    .filter((entry): entry is CareerEntryLike => entry !== null);
}

/**
 * Le esperienze da ex calciatore del Dirigente sono già salvate nella forma
 * che il Master Profile Calciatore legge (`PlayerExperienceForm`): qui si
 * verifica soltanto che la riga sia leggibile, non la si converte.
 */
export function parseDirectorPlayerForms(
  entries: readonly unknown[] | null | undefined,
): PlayerExperienceForm[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((value, index): PlayerExperienceForm | null => {
      const record = toRecord(value);

      if (!record) {
        return null;
      }

      const clubName =
        readText(record, "clubName") || readText(record, "teamName");

      if (!clubName) {
        return null;
      }

      const seasonPeriod = readText(record, "seasonPeriod");
      const careerType = readText(record, "careerType");
      const groupId = readText(record, "groupId");

      return {
        appearances: readText(record, "appearances"),
        assists: readText(record, "assists"),
        awards: readText(record, "awards"),
        /*
          Tipo e gruppo sono ciò che tiene insieme le righe di una stessa
          esperienza quando torna al flusso Calciatore. Senza, il
          raggruppamento ricade su società + categoria e due passaggi distinti
          nello stesso club collasserebbero in uno.
        */
        ...(careerType === "MULTI_SEASON" ||
        careerType === "SINGLE_SEASON" ||
        careerType === "CUSTOM_PERIOD"
          ? { careerType }
          : {}),
        category: readText(record, "category"),
        clubId: readText(record, "clubId") || null,
        clubName,
        goals: readText(record, "goals"),
        ...(groupId ? { groupId } : {}),
        id: readText(record, "id") || `director-player-${index}`,
        minutesPlayed: readText(record, "minutesPlayed"),
        periodEndMonth: readText(record, "periodEndMonth"),
        periodStartMonth: readText(record, "periodStartMonth"),
        seasonLabel: readText(record, "seasonLabel"),
        seasonPeriod: seasonPeriod === "partial" ? "partial" : "full",
        teamCity: readText(record, "teamCity"),
        teamLogoUrl: readText(record, "teamLogoUrl"),
      } satisfies PlayerExperienceForm;
    })
    .filter((form): form is PlayerExperienceForm => form !== null);
}

// ---------------------------------------------------------------------------
// Derivazioni
// ---------------------------------------------------------------------------

/**
 * Società distinte di una carriera.
 *
 * L'identità è l'id canonico quando la società ha una pagina PROLINK; quando
 * non ce l'ha resta l'id del record, che è stabile. Due società con nomi
 * simili restano due società: il nome non entra mai nella chiave.
 */
export function countDistinctDirectorClubs(view: CoachCareerView): number {
  return new Set(
    view.experiences.map(
      (experience) => experience.clubId ?? `entry:${experience.id}`,
    ),
  ).size;
}

/**
 * Categorie toccate dalla carriera dirigenziale, dalla più recente alla più
 * remota. Le esperienze arrivano già ordinate dal modello condiviso.
 */
export function collectDirectorCategories(view: CoachCareerView): string[] {
  const categories: string[] = [];

  for (const experience of view.experiences) {
    for (const season of experience.seasons) {
      const category = season.category.trim();

      if (category && !categories.includes(category)) {
        categories.push(category);
      }
    }
  }

  return categories;
}

/**
 * I soli campi di `director_profiles` da cui si leggono i ruoli. Tipizzare per
 * struttura evita di far passare l'intero record dove servono tre colonne.
 */
type DirectorRolesFields = {
  director_roles: readonly string[];
  other_role_label?: string | null;
  primary_role?: string | null;
};

export type DirectorRolesSource = DirectorRolesFields | null | undefined;

/**
 * Ruoli dirigenziali dichiarati nel profilo, in ordine e senza duplicati.
 *
 * Il ruolo principale apre sempre l'elenco: è il posizionamento scelto
 * dall'utente. "Altro" non è un ruolo — al suo posto entra l'etichetta libera
 * che l'utente ha scritto (REV-ONB-07 §H), e se non l'ha scritta la voce
 * sparisce invece di comparire come "Altro".
 */
export function collectDirectorRoles(source: DirectorRolesSource): string[] {
  const other = source?.other_role_label?.trim() ?? "";
  const roles: string[] = [];

  for (const value of [source?.primary_role, ...(source?.director_roles ?? [])]) {
    const role = value?.trim() === "Altro" ? other : value?.trim();

    if (role && !roles.includes(role)) {
      roles.push(role);
    }
  }

  return roles;
}

/**
 * Ruolo principale del profilo (REV-PROF-09, "Ruolo principale").
 *
 * È il posizionamento dichiarato dall'utente, non l'ultimo incarico ricoperto:
 * un'esperienza più recente con un altro ruolo non lo sostituisce mai, e non
 * si assume che ogni Dirigente sia un Direttore sportivo. Senza dichiarazione
 * si ricade sul primo ruolo selezionato e solo in ultima istanza
 * sull'etichetta della tipologia.
 */
export function resolveDirectorPrimaryRole(
  directorProfile: DirectorRolesSource,
): string {
  const declared = directorProfile?.primary_role?.trim();
  const other = directorProfile?.other_role_label?.trim();

  if (declared && declared !== "Altro") {
    return declared;
  }

  if (declared === "Altro" && other) {
    return other;
  }

  const firstSelected = directorProfile?.director_roles.find(
    (role) => role.trim() && role.trim() !== "Altro",
  );

  return firstSelected?.trim() || other || "Dirigente";
}

/**
 * Ruoli dichiarati diversi da quello principale.
 *
 * Il confronto avviene sull'etichetta risolta, non sul valore grezzo: un
 * profilo che ha scelto "Altro" come ruolo principale non deve ritrovarsi la
 * propria etichetta libera ripetuta anche fra gli altri ruoli.
 */
export function collectSecondaryDirectorRoles(
  source: DirectorRolesSource,
): string[] {
  const roles = collectDirectorRoles(source);

  // Il primo elemento è per costruzione il ruolo principale risolto: il ruolo
  // dichiarato se c'è, altrimenti il primo selezionato.
  return roles.slice(1);
}

/**
 * Ruoli dirigenziali distinti fra quelli dichiarati e quelli realmente
 * ricoperti in carriera (REV-PROF-09 §"Ruoli"). I ruoli delle carriere da
 * Allenatore, Staff o Calciatore non entrano: non sono ruoli dirigenziali.
 */
export function countDirectorRoles(
  declaredRoles: readonly string[],
  view: CoachCareerView,
): number {
  const roles = new Set(declaredRoles.map((role) => role.trim()).filter(Boolean));

  for (const experience of view.experiences) {
    for (const season of experience.seasons) {
      const role = season.role.trim();

      if (role) {
        roles.add(role);
      }
    }
  }

  return roles.size;
}

/** Numero di esperienze da calciatore, raggruppate come nel Master Calciatore. */
function countPlayerExperiences(forms: readonly PlayerExperienceForm[]): number {
  if (forms.length === 0) {
    return 0;
  }

  try {
    return buildPlayerCareerView([...forms]).experiences.length;
  } catch {
    return 0;
  }
}

/**
 * I campi di `director_profiles` che compongono la carriera. Le cinque colonne
 * sono `jsonb` e restano `unknown[]` fin qui: la forma viene verificata una
 * riga alla volta, non promessa dal tipo.
 */
export type DirectorCareerSource =
  | (DirectorRolesFields & {
      career_entries: readonly unknown[];
      coach_career_entries: readonly unknown[];
      other_career_entries: readonly unknown[];
      player_career_entries: readonly unknown[];
      staff_career_entries: readonly unknown[];
    })
  | null
  | undefined;

/**
 * Tutto ciò che header, Carriera e Dettagli leggono della carriera, calcolato
 * una volta sola per render del profilo.
 */
export function buildDirectorProfileCareer({
  directorProfile,
  now,
}: {
  directorProfile: DirectorCareerSource;
  now?: Date;
}): DirectorProfileCareer {
  const options = now ? { now } : {};
  const director = buildCareerView(
    parseDirectorCareerEntries(directorProfile?.career_entries, "director"),
    options,
  );
  const coach = buildCareerView(
    parseDirectorCareerEntries(
      directorProfile?.coach_career_entries,
      "director-coach",
    ),
    options,
  );
  const staff = buildCareerView(
    parseDirectorCareerEntries(
      directorProfile?.staff_career_entries,
      "director-staff",
    ),
    options,
  );
  const other = buildCareerView(
    parseDirectorCareerEntries(
      directorProfile?.other_career_entries,
      "director-other",
    ),
    options,
  );
  const playerForms = parseDirectorPlayerForms(
    directorProfile?.player_career_entries,
  );

  return {
    categories: collectDirectorCategories(director),
    clubCount: countDistinctDirectorClubs(director),
    coach,
    coachExperienceCount: coach.experiences.length,
    currentExperience: getCurrentExperience(director),
    director,
    other,
    otherExperienceCount: other.experiences.length,
    playerExperienceCount: countPlayerExperiences(playerForms),
    playerForms,
    roleCount: countDirectorRoles(
      collectDirectorRoles(directorProfile),
      director,
    ),
    staff,
    staffExperienceCount: staff.experiences.length,
  };
}

/** Percorsi realmente presenti, nell'ordine in cui compaiono nel selettore. */
export function getAvailableDirectorPaths(
  career: DirectorProfileCareer,
): DirectorCareerPath[] {
  return [
    // Il percorso dirigenziale resta sempre selezionabile: è la carriera di
    // questo profilo anche quando è ancora vuota.
    "director" as const,
    career.coachExperienceCount > 0 ? ("coach" as const) : null,
    career.staffExperienceCount > 0 ? ("staff" as const) : null,
    career.playerExperienceCount > 0 ? ("player" as const) : null,
    career.otherExperienceCount > 0 ? ("other" as const) : null,
  ].filter((path): path is DirectorCareerPath => path !== null);
}
