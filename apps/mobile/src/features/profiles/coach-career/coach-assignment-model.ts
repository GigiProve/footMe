/**
 * Modello delle assegnazioni della carriera da allenatore (REV-PROF-04).
 *
 * Il requisito funzionale della task è uno solo, e da lì discende tutto il
 * resto: **ruolo e categoria appartengono alla singola stagione**, non alla
 * società. Quindi l'unità persistita non è "l'esperienza al Torino" ma
 * "Torino, 2023/24, Vice allenatore, Prima Squadra": una riga per assegnazione.
 *
 * Il raggruppamento per società è un fatto di presentazione e vive qui, non nel
 * database: `experience_group_id` tiene insieme le assegnazioni nate da una
 * sola operazione, ma nessuna riga dipende dalle altre per essere letta,
 * modificata o eliminata.
 *
 * Perché il gruppo è il batch e non la società: due passaggi distinti nello
 * stesso club (2015-2017 e poi di nuovo dal 2024) sono due esperienze, non una
 * con un buco in mezzo. È la stessa correzione già fatta per il Calciatore in
 * REV-PROF-01. Le righe salvate prima della migrazione, che il gruppo non ce
 * l'hanno, ricadono sull'identità della società.
 */
import type { CoachCareerEntryRecord } from "../profile-service";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

/**
 * Le colonne che una riga di carriera deve avere per essere un'assegnazione,
 * indipendentemente dalla tabella che la ospita.
 *
 * `coach_career_entries`, `staff_career_entries` e `staff_coach_career_entries`
 * sono tre tabelle con tre chiavi esterne diverse ma **lo stesso modello**:
 * quello che cambia è a quale profilo appartengono, non come si legge una
 * stagione. Tipizzare la conversione su questa forma è ciò che evita una
 * seconda copia del modello per lo Staff tecnico (REV-PROF-07).
 */
export type CareerAssignmentRecord = {
  category: string | null;
  club_id: string | null;
  experience_group_id: string | null;
  experience_type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";
  id: string;
  period_end_month: string | null;
  period_end_year: number | null;
  period_start_month: string | null;
  period_start_year: number | null;
  role: string;
  season_details: Record<string, { category?: string; role?: string }>;
  seasons: string[];
  team_logo_url: string | null;
  team_name: string;
};

export type CoachTemporalMode =
  | "MULTI_SEASON"
  | "SINGLE_SEASON"
  | "CUSTOM_PERIOD";

export type CoachPeriod = {
  endMonth: string;
  endYear: string;
  startMonth: string;
  startYear: string;
};

/** Una riga persistita: una stagione (o un periodo), un ruolo, una categoria. */
export type CoachAssignment = {
  category: string;
  clubId: string | null;
  /**
   * Descrizione facoltativa dell'esperienza (REV-PROF-10 §"Descrizione
   * opzionale"). Appartiene alla singola assegnazione, come ruolo e categoria.
   *
   * Opzionale perché non tutte le corsie la portano: `coach_career_entries` e
   * `staff_career_entries` la conservano senza esporla, quindi le loro
   * conversioni la lasciano indefinita e il campo già salvato resta intatto.
   */
  description?: string;
  groupId: string;
  id: string;
  /** Periodo personalizzato ancora aperto: data finale assente. */
  isOngoing: boolean;
  mode: CoachTemporalMode;
  /** Valorizzato solo in `CUSTOM_PERIOD`. */
  period: CoachPeriod | null;
  role: string;
  /** "2024/2025". Vuoto in `CUSTOM_PERIOD`. */
  seasonKey: string;
  teamLogoUrl: string;
  teamName: string;
};

/** Riga mostrata dentro un gruppo: stagione o periodo, ruolo, categoria. */
export type CoachAssignmentRow = {
  assignmentId: string;
  category: string;
  isOngoing: boolean;
  /** "2024/25" oppure "Gennaio 2021 — Maggio 2021". */
  label: string;
  mode: CoachTemporalMode;
  role: string;
  seasonKey: string;
};

export type CoachExperienceGroup = {
  clubId: string | null;
  /** "3 stagioni", "2 incarichi" o "4 esperienze" secondo la composizione. */
  countLabel: string;
  groupId: string;
  isOngoing: boolean;
  logoUrl: string;
  /** "2022 — Presente" oppure "2019 — 2022". */
  periodLabel: string;
  /** "2 ruoli": valori distinti fra le assegnazioni, non un campo del gruppo. */
  roleCountLabel: string;
  rows: CoachAssignmentRow[];
  teamName: string;
};

// ---------------------------------------------------------------------------
// Etichette e conversioni temporali
// ---------------------------------------------------------------------------

export const COACH_MONTH_LABELS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

export function monthLabelToNumber(month: string | null | undefined): number | null {
  const trimmed = month?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const index = COACH_MONTH_LABELS.findIndex(
    (label) => label.toLowerCase() === trimmed,
  );

  if (index >= 0) {
    return index + 1;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

/** "2024/2025" → "2024/25". Tollera già le forme abbreviate. */
export function formatSeasonLabel(seasonKey: string): string {
  const parts = seasonKey.split("/");

  if (parts.length !== 2) {
    return seasonKey;
  }

  const [start, end] = parts;

  return `${start}/${end.length === 4 ? end.slice(2) : end}`;
}

export function seasonStartYear(seasonKey: string): number | null {
  const parsed = Number.parseInt(seasonKey.slice(0, 4), 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function monthYearLabel(month: string, year: string): string {
  if (!year) {
    return "";
  }

  const monthNumber = monthLabelToNumber(month);

  return monthNumber
    ? `${COACH_MONTH_LABELS[monthNumber - 1]} ${year}`
    : year;
}

export function formatPeriodLabel(
  period: CoachPeriod | null,
  isOngoing: boolean,
): string {
  if (!period) {
    return "";
  }

  const start = monthYearLabel(period.startMonth, period.startYear);
  const end = isOngoing
    ? "Presente"
    : monthYearLabel(period.endMonth, period.endYear);

  return [start, end].filter(Boolean).join(" — ");
}

/** Mesi assoluti: rende confrontabili stagioni sportive e periodi liberi. */
function toAbsoluteMonth(year: number, month: number): number {
  return year * 12 + month;
}

const OPEN_ENDED = Number.MAX_SAFE_INTEGER;

type Bounds = { end: number; start: number };

function assignmentBounds(assignment: CoachAssignment): Bounds {
  if (assignment.mode === "CUSTOM_PERIOD" && assignment.period) {
    const startYear = Number.parseInt(assignment.period.startYear, 10);
    const endYear = Number.parseInt(assignment.period.endYear, 10);
    const startMonth = monthLabelToNumber(assignment.period.startMonth) ?? 7;
    const endMonth = monthLabelToNumber(assignment.period.endMonth) ?? 6;
    const start = Number.isNaN(startYear)
      ? 0
      : toAbsoluteMonth(startYear, startMonth);

    return {
      end:
        assignment.isOngoing || Number.isNaN(endYear)
          ? OPEN_ENDED
          : toAbsoluteMonth(endYear, endMonth),
      start,
    };
  }

  const year = seasonStartYear(assignment.seasonKey);

  if (year === null) {
    return { end: 0, start: 0 };
  }

  // Convenzione della stagione sportiva: luglio → giugno dell'anno dopo.
  return { end: toAbsoluteMonth(year + 1, 6), start: toAbsoluteMonth(year, 7) };
}

/**
 * Stagioni sportive coperte da un'assegnazione. Serve per l'avviso di
 * sovrapposizione e per l'etichetta di periodo di un gruppo misto.
 */
export function assignmentSeasonKeys(assignment: CoachAssignment): string[] {
  if (assignment.mode !== "CUSTOM_PERIOD") {
    return assignment.seasonKey ? [assignment.seasonKey] : [];
  }

  if (!assignment.period) {
    return [];
  }

  const startYear = Number.parseInt(assignment.period.startYear, 10);

  if (Number.isNaN(startYear)) {
    return [];
  }

  const startMonth = monthLabelToNumber(assignment.period.startMonth) ?? 7;
  const firstSeason = startMonth >= 7 ? startYear : startYear - 1;

  if (assignment.isOngoing || !assignment.period.endYear) {
    return [`${firstSeason}/${firstSeason + 1}`];
  }

  const endYear = Number.parseInt(assignment.period.endYear, 10);

  if (Number.isNaN(endYear)) {
    return [`${firstSeason}/${firstSeason + 1}`];
  }

  const endMonth = monthLabelToNumber(assignment.period.endMonth) ?? 6;
  const lastSeason = endMonth >= 7 ? endYear : endYear - 1;
  const keys: string[] = [];

  for (
    let year = firstSeason;
    year <= Math.max(firstSeason, lastSeason);
    year += 1
  ) {
    keys.push(`${year}/${year + 1}`);
  }

  return keys;
}

// ---------------------------------------------------------------------------
// Record ↔ assegnazione
// ---------------------------------------------------------------------------

/** Identità del club: l'id canonico quando c'è, altrimenti il nome normalizzato. */
export function clubIdentity(
  clubId: string | null,
  teamName: string,
): string {
  // Mai il solo nome quando esiste un id: due società omonime restano distinte.
  return clubId ? `club:${clubId}` : `name:${teamName.trim().toLowerCase()}`;
}

/**
 * Espande un record letto dal backend nelle sue assegnazioni.
 *
 * Dopo la migrazione un record porta una sola stagione, ma la lettura resta
 * compatibile con le righe multi-stagione ancora in circolo durante il
 * rilascio: `season_details` continua a vincere su ruolo e categoria di
 * testata, che restano il fallback.
 */
export function recordToAssignments(
  record: CareerAssignmentRecord,
): CoachAssignment[] {
  const teamName = record.team_name?.trim() ?? "";
  // Senza gruppo salvato la riga è l'esperienza: il suo id diventa il gruppo.
  // Ricostruirlo dal nome della società unirebbe due passaggi distinti.
  const groupId = record.experience_group_id?.trim() || record.id;
  const fallbackCategory = record.category?.trim() ?? "";
  const fallbackRole = record.role?.trim() ?? "";
  const base = {
    clubId: record.club_id ?? null,
    groupId,
    teamLogoUrl: record.team_logo_url ?? "",
    teamName,
  };

  if (record.experience_type === "CUSTOM_PERIOD") {
    const isOngoing = !record.period_end_year;

    return [
      {
        ...base,
        category: fallbackCategory,
        id: record.id,
        isOngoing,
        mode: "CUSTOM_PERIOD",
        period: {
          endMonth: record.period_end_month ?? "",
          endYear: record.period_end_year ? String(record.period_end_year) : "",
          startMonth: record.period_start_month ?? "",
          startYear: record.period_start_year
            ? String(record.period_start_year)
            : "",
        },
        role: fallbackRole,
        seasonKey: "",
      },
    ];
  }

  const seasonKeys = [...new Set(record.seasons.filter((season) => season?.trim()))];

  if (seasonKeys.length === 0) {
    return [];
  }

  return seasonKeys.map((seasonKey, index) => {
    const detail = record.season_details?.[seasonKey];

    return {
      ...base,
      category: detail?.category?.trim() || fallbackCategory,
      // Una riga legacy con N stagioni produce N assegnazioni: solo la prima
      // può tenersi l'id del record, le altre ne ricevono uno derivato stabile.
      id: index === 0 ? record.id : `${record.id}#${seasonKey}`,
      isOngoing: false,
      mode: record.experience_type,
      period: null,
      role: detail?.role?.trim() || fallbackRole,
      seasonKey,
    } satisfies CoachAssignment;
  });
}

export function recordsToAssignments(
  records: readonly CareerAssignmentRecord[],
): CoachAssignment[] {
  return records.flatMap(recordToAssignments);
}

/**
 * Riporta le assegnazioni nella forma attesa dal backend: una riga per
 * assegnazione, `season_details` vuoto perché ruolo e categoria ora vivono
 * sulla riga.
 */
export function assignmentToRecordFields(
  assignment: CoachAssignment,
  index: number,
): CareerAssignmentRecord & { sort_order: number } {
  return {
    category: assignment.category || null,
    club_id: assignment.clubId,
    experience_group_id: assignment.groupId,
    experience_type: assignment.mode,
    id: assignment.id,
    period_end_month:
      assignment.mode === "CUSTOM_PERIOD" && !assignment.isOngoing
        ? assignment.period?.endMonth || null
        : null,
    period_end_year:
      assignment.mode === "CUSTOM_PERIOD" &&
      !assignment.isOngoing &&
      assignment.period?.endYear
        ? Number(assignment.period.endYear)
        : null,
    period_start_month:
      assignment.mode === "CUSTOM_PERIOD"
        ? assignment.period?.startMonth || null
        : null,
    period_start_year:
      assignment.mode === "CUSTOM_PERIOD" && assignment.period?.startYear
        ? Number(assignment.period.startYear)
        : null,
    role: assignment.role,
    // Ruolo e categoria ora vivono sulla riga: il dettaglio per stagione non
    // ha più niente da portare e resta vuoto.
    season_details: {},
    seasons: assignment.seasonKey ? [assignment.seasonKey] : [],
    sort_order: index,
    team_logo_url: assignment.teamLogoUrl || null,
    team_name: assignment.teamName,
  };
}

/**
 * Riporta le assegnazioni nella forma attesa da `coach_career_entries`.
 */
export function assignmentsToRecords(
  assignments: readonly CoachAssignment[],
  coachProfileId: string,
): CoachCareerEntryRecord[] {
  return assignments.map((assignment, index) => ({
    ...assignmentToRecordFields(assignment, index),
    coach_profile_id: coachProfileId,
    description: null,
    results: [],
  }));
}

// ---------------------------------------------------------------------------
// Raggruppamento e ordinamento
// ---------------------------------------------------------------------------

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function buildCountLabel(rows: CoachAssignmentRow[]): string {
  const hasSeasons = rows.some((row) => row.mode !== "CUSTOM_PERIOD");
  const hasPeriods = rows.some((row) => row.mode === "CUSTOM_PERIOD");

  if (hasSeasons && hasPeriods) {
    return pluralize(rows.length, "esperienza", "esperienze");
  }

  return hasPeriods
    ? pluralize(rows.length, "incarico", "incarichi")
    : pluralize(rows.length, "stagione", "stagioni");
}

function buildGroupPeriodLabel(
  assignments: CoachAssignment[],
  isOngoing: boolean,
): string {
  // Un gruppo di soli periodi non ha stagioni da riassumere: mostra il periodo.
  if (assignments.every((assignment) => assignment.mode === "CUSTOM_PERIOD")) {
    if (assignments.length === 1) {
      return formatPeriodLabel(assignments[0].period, assignments[0].isOngoing);
    }
  }

  const years = assignments
    .flatMap(assignmentSeasonKeys)
    .map(seasonStartYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) {
    return formatPeriodLabel(assignments[0]?.period ?? null, isOngoing);
  }

  const startYear = Math.min(...years);
  const endYear = Math.max(...years) + 1;

  if (isOngoing) {
    return `${startYear} — Presente`;
  }

  return startYear === endYear - 1
    ? `${startYear}/${String(endYear).slice(2)}`
    : `${startYear} — ${endYear}`;
}

function buildRoleCountLabel(assignments: CoachAssignment[]): string {
  const roles = new Set(
    assignments
      .map((assignment) => assignment.role.trim())
      .filter((role) => role.length > 0),
  );

  return pluralize(roles.size, "ruolo", "ruoli");
}

/**
 * Un'assegnazione è "in corso" quando copre la stagione sportiva corrente o
 * quando è un incarico esplicitamente aperto.
 */
export function isAssignmentCurrent(
  assignment: CoachAssignment,
  now: Date,
): boolean {
  if (assignment.mode === "CUSTOM_PERIOD") {
    if (assignment.isOngoing) {
      return true;
    }

    const bounds = assignmentBounds(assignment);

    return bounds.end >= toAbsoluteMonth(now.getFullYear(), now.getMonth() + 1);
  }

  return assignment.seasonKey === getCurrentSeasonKey(now);
}

/** Stagione sportiva corrente: da luglio in poi è quella che inizia quest'anno. */
export function getCurrentSeasonKey(now: Date = new Date()): string {
  const year = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  return `${year}/${year + 1}`;
}

export function buildCoachExperienceGroups(
  assignments: readonly CoachAssignment[],
  { now = new Date() }: { now?: Date } = {},
): CoachExperienceGroup[] {
  const byGroup = new Map<string, CoachAssignment[]>();

  for (const assignment of assignments) {
    const bucket = byGroup.get(assignment.groupId);

    if (bucket) {
      bucket.push(assignment);
    } else {
      byGroup.set(assignment.groupId, [assignment]);
    }
  }

  return [...byGroup.entries()]
    .map(([groupId, groupAssignments]) => {
      // Dentro il gruppo la stagione più recente viene prima.
      const sorted = [...groupAssignments].sort(
        (left, right) => assignmentBounds(right).end - assignmentBounds(left).end,
      );
      const isOngoing = sorted.some((assignment) =>
        isAssignmentCurrent(assignment, now),
      );
      const head = sorted[0];
      const rows = sorted.map((assignment) => ({
        assignmentId: assignment.id,
        category: assignment.category,
        isOngoing: assignment.isOngoing,
        label:
          assignment.mode === "CUSTOM_PERIOD"
            ? formatPeriodLabel(assignment.period, assignment.isOngoing)
            : formatSeasonLabel(assignment.seasonKey),
        mode: assignment.mode,
        role: assignment.role,
        seasonKey: assignment.seasonKey,
      })) satisfies CoachAssignmentRow[];

      return {
        bounds: {
          end: Math.max(...sorted.map((item) => assignmentBounds(item).end)),
          start: Math.min(...sorted.map((item) => assignmentBounds(item).start)),
        },
        clubId: head?.clubId ?? null,
        countLabel: buildCountLabel(rows),
        groupId,
        isOngoing,
        logoUrl: head?.teamLogoUrl ?? "",
        periodLabel: buildGroupPeriodLabel(sorted, isOngoing),
        roleCountLabel: buildRoleCountLabel(sorted),
        rows,
        teamName: head?.teamName || "Società non indicata",
      };
    })
    // Ordinamento canonico della task: in corso prima, poi fine decrescente, a
    // parità inizio decrescente. L'ordine del backend non viene mai assunto.
    .sort((left, right) => {
      if (left.isOngoing !== right.isOngoing) {
        return left.isOngoing ? -1 : 1;
      }

      if (left.bounds.end !== right.bounds.end) {
        return right.bounds.end - left.bounds.end;
      }

      return right.bounds.start - left.bounds.start;
    })
    .map(({ bounds: _bounds, ...group }) => group);
}

/** Stagioni allenate, contate una sola volta anche con incarichi simultanei. */
export function countCoachSeasons(
  assignments: readonly CoachAssignment[],
): number {
  return new Set(assignments.flatMap(assignmentSeasonKeys)).size;
}
