/**
 * Modello della carriera da procuratore (REV-PROF-15).
 *
 * È il gemello di `coach-assignment-model` per un dominio che non ha stagioni.
 * Allenatore, Staff tecnico e Dirigente firmano per una stagione sportiva; un
 * procuratore firma per un periodo — Gennaio 2021, Dicembre 2020, "Presente" —
 * e può averne più di uno aperto nello stesso momento. Forzarlo nel modello a
 * stagioni avrebbe significato inventare "2024/25" sopra date che l'utente non
 * ha mai scritto in quella forma, quindi qui vive il proprio modello, con le
 * stesse regole di disciplina degli altri: niente conteggi memorizzati, niente
 * ordinamento salvato, tutto ricalcolato dai record.
 *
 * Tre fatti che il resto del modulo dà per scontati:
 *
 *  * il raggruppamento avviene per **identificativo**, mai per somiglianza di
 *    nome: l'id canonico della pagina PROLINK, l'id stabile del riferimento
 *    manuale, oppure la corsia dell'attività indipendente. Due agenzie con un
 *    nome simile restano due gruppi;
 *  * l'attività indipendente non è un'agenzia con un nome finto. Non ha
 *    organizzazione, non ha logo, e sta in un gruppo tutto suo;
 *  * la precisione temporale è un dato, non un dettaglio di formattazione. Le
 *    esperienze raccolte dal vecchio onboarding hanno solo l'anno: restano
 *    annuali finché l'utente non riscrive quel periodo.
 */
import {
  MONTH_LABEL_TO_NUM,
  coachPeriodFromDateValue,
  coachPeriodToDateValue,
} from "../../onboarding/coach/coach-career-utils";
import type {
  AgentCareerEntryRecord,
  AgentPeriodPrecision,
} from "../agent-profile";

/** Modalità con cui un incarico è stato svolto (§"Modello dati"). */
export type AgentOrganizationMode = "agency" | "independent";

/**
 * Un incarico professionale, nella forma che le schermate modificano.
 *
 * Mese e anno restano due stringhe separate — "Gennaio" e "2021" — come nel
 * database e come nel modello dell'Allenatore: convertirli in `Date` avrebbe
 * costretto a inventare un giorno, e un periodo annuale non ha nemmeno il mese.
 */
export type AgentCareerAssignment = {
  description: string;
  endMonth: string;
  endPrecision: AgentPeriodPrecision;
  endYear: string;
  id: string;
  isCurrent: boolean;
  isPrimary: boolean;
  /** Id stabile di un'organizzazione inserita a mano. Mai una pagina pubblica. */
  manualOrganizationId: string | null;
  organizationCity: string;
  /** Id canonico di un'organizzazione già presente su PROLINK. */
  organizationClubId: string | null;
  organizationCountry: string;
  organizationLogoUrl: string;
  organizationMode: AgentOrganizationMode;
  organizationName: string;
  role: string;
  startMonth: string;
  startPrecision: AgentPeriodPrecision;
  startYear: string;
};

/** Riga di un incarico dentro il gruppo, nel riepilogo e nella timeline. */
export type AgentAssignmentRow = {
  assignmentId: string;
  isCurrent: boolean;
  isPrimary: boolean;
  /** "Gennaio 2023 — Presente" oppure "2017 — 2020". */
  periodLabel: string;
  role: string;
};

/** Un'organizzazione con tutti gli incarichi che ci sono stati svolti. */
export type AgentExperienceGroup = {
  /** "1 incarico" / "3 incarichi": calcolato, mai salvato. */
  countLabel: string;
  groupId: string;
  /** Il gruppo contiene l'esperienza principale: è la situazione attuale. */
  hasPrimary: boolean;
  isCurrent: boolean;
  logoUrl: string;
  organizationMode: AgentOrganizationMode;
  /** Nome dell'organizzazione, o "Professionista indipendente". */
  organizationName: string;
  /** "2021 — Presente" calcolato dai record contenuti. */
  periodLabel: string;
  /** Ruolo dell'incarico principale, o del più recente. */
  primaryRoleLabel: string;
  rows: AgentAssignmentRow[];
};

/**
 * Corsia dell'attività indipendente.
 *
 * Non è un'organizzazione: è l'assenza di organizzazione, quindi ha un
 * identificativo proprio invece di un'agenzia fittizia chiamata "Freelance".
 */
export const AGENT_INDEPENDENT_GROUP_ID = "independent";

export const AGENT_INDEPENDENT_LABEL = "Professionista indipendente";

/** Limite della descrizione facoltativa (§Screen 4). */
export const AGENT_DESCRIPTION_MAX_LENGTH = 500;

export type AgentAssignmentErrors = {
  endDate?: string;
  organization?: string;
  role?: string;
  startDate?: string;
};

export const AGENT_CAREER_MESSAGES = {
  deleteError: "Non è stato possibile eliminare. Riprova.",
  duplicate: "Questa esperienza è già presente.",
  endError: "Non è stato possibile concludere l'incarico. Riprova.",
  genericError: "Non è stato possibile completare l'operazione. Riprova.",
  loadError: "Non è stato possibile caricare le organizzazioni. Riprova.",
  overlap:
    "Esiste già un incarico in questo periodo. Verifica i dati prima di continuare.",
  saveError: "Non è stato possibile salvare. Riprova.",
  updateError: "Non è stato possibile aggiornare l'esperienza. Riprova.",
} as const;

// ---------------------------------------------------------------------------
// Conversioni
// ---------------------------------------------------------------------------

function toText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function recordToAssignment(
  record: AgentCareerEntryRecord,
): AgentCareerAssignment {
  const organizationMode: AgentOrganizationMode =
    record.organization_mode === "independent" ? "independent" : "agency";

  return {
    description: toText(record.description),
    endMonth: toText(record.period_end_month),
    endPrecision: record.period_end_precision === "year" ? "year" : "month",
    endYear: record.period_end_year == null ? "" : String(record.period_end_year),
    id: record.id,
    isCurrent: record.is_current,
    isPrimary: record.is_primary,
    manualOrganizationId:
      organizationMode === "independent" ? null : record.manual_organization_id,
    organizationCity: toText(record.organization_city),
    organizationClubId:
      organizationMode === "independent" ? null : record.organization_club_id,
    organizationCountry: toText(record.organization_country),
    organizationLogoUrl:
      organizationMode === "independent" ? "" : toText(record.agency_logo_url),
    organizationMode,
    organizationName:
      organizationMode === "independent" ? "" : toText(record.agency_name),
    role: toText(record.role),
    startMonth: toText(record.period_start_month),
    startPrecision: record.period_start_precision === "year" ? "year" : "month",
    startYear:
      record.period_start_year == null ? "" : String(record.period_start_year),
  };
}

export function recordsToAssignments(
  records: readonly AgentCareerEntryRecord[],
): AgentCareerAssignment[] {
  return sortAssignments(records.map(recordToAssignment));
}

/**
 * Payload della RPC di salvataggio.
 *
 * La precisione non viene inviata: la decide il database guardando se il mese
 * c'è. Un solo posto in cui quella regola è scritta vale più di due che
 * possono divergere.
 */
export function assignmentToPayload(
  assignment: AgentCareerAssignment,
): Record<string, unknown> {
  const isIndependent = assignment.organizationMode === "independent";

  return {
    agency_logo_url: isIndependent ? null : assignment.organizationLogoUrl || null,
    agency_name: isIndependent ? null : assignment.organizationName || null,
    description: assignment.description || null,
    ...(isLocalAssignmentId(assignment.id) ? {} : { id: assignment.id }),
    is_current: assignment.isCurrent,
    is_primary: assignment.isPrimary,
    manual_organization_id: isIndependent
      ? null
      : assignment.manualOrganizationId,
    organization_city: isIndependent ? null : assignment.organizationCity || null,
    organization_club_id: isIndependent ? null : assignment.organizationClubId,
    organization_country: isIndependent
      ? null
      : assignment.organizationCountry || null,
    organization_mode: assignment.organizationMode,
    period_end_month: assignment.isCurrent ? null : assignment.endMonth || null,
    period_end_year: assignment.isCurrent
      ? null
      : toYearNumber(assignment.endYear),
    period_start_month: assignment.startMonth || null,
    period_start_year: toYearNumber(assignment.startYear),
    role: assignment.role,
  };
}

/**
 * Un incarico non ancora salvato ha un id locale: la RPC gliene assegna uno
 * vero. Inviare un id inventato dal client farebbe nascere una riga con una
 * chiave che nessun'altra tabella conosce.
 */
export function isLocalAssignmentId(id: string): boolean {
  return id.startsWith("local-");
}

export function createLocalAssignmentId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toYearNumber(year: string): number | null {
  const parsed = Number.parseInt(year, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Periodi
// ---------------------------------------------------------------------------

/** Mesi assoluti: l'unità in cui due periodi si possono confrontare. */
function toAbsoluteMonths(
  year: string,
  month: string,
  fallbackMonth: number,
): number | null {
  const parsedYear = toYearNumber(year);

  if (parsedYear === null) {
    return null;
  }

  return parsedYear * 12 + ((MONTH_LABEL_TO_NUM[month] ?? fallbackMonth) - 1);
}

export function assignmentStartMonths(
  assignment: AgentCareerAssignment,
): number | null {
  return toAbsoluteMonths(assignment.startYear, assignment.startMonth, 1);
}

export function assignmentEndMonths(
  assignment: AgentCareerAssignment,
): number | null {
  if (assignment.isCurrent) {
    return null;
  }

  return toAbsoluteMonths(assignment.endYear, assignment.endMonth, 12);
}

/**
 * Un estremo del periodo. Senza mese resta l'anno nudo: è esattamente quanto
 * l'utente ha dichiarato, e aggiungere "Gennaio" sarebbe inventare un dato.
 */
function formatPoint(
  month: string,
  year: string,
  precision: AgentPeriodPrecision,
): string {
  if (!year) {
    return "";
  }

  return precision === "month" && month ? `${month} ${year}` : year;
}

/** "Gennaio 2023 — Presente", "2017 — 2020", oppure il solo inizio. */
export function formatAssignmentPeriod(
  assignment: AgentCareerAssignment,
): string {
  const start = formatPoint(
    assignment.startMonth,
    assignment.startYear,
    assignment.startPrecision,
  );

  if (assignment.isCurrent) {
    return start ? `${start} — Presente` : "In corso";
  }

  const end = formatPoint(
    assignment.endMonth,
    assignment.endYear,
    assignment.endPrecision,
  );

  if (start && end) {
    return `${start} — ${end}`;
  }

  return start || end;
}

/**
 * Periodo complessivo di un gruppo: dal più lontano inizio alla più recente
 * fine, con "Presente" quando almeno un incarico è aperto. Solo l'anno, perché
 * la card dell'hub riassume e il dettaglio al mese sta nel riepilogo.
 */
export function formatGroupPeriod(
  assignments: readonly AgentCareerAssignment[],
): string {
  const startYears = assignments
    .map((assignment) => toYearNumber(assignment.startYear))
    .filter((year): year is number => year !== null);

  const start = startYears.length > 0 ? Math.min(...startYears) : null;

  if (assignments.some((assignment) => assignment.isCurrent)) {
    return start === null ? "In corso" : `${start} — Presente`;
  }

  const endYears = assignments
    .map((assignment) => toYearNumber(assignment.endYear))
    .filter((year): year is number => year !== null);

  const end = endYears.length > 0 ? Math.max(...endYears) : null;

  if (start !== null && end !== null) {
    return start === end ? String(start) : `${start} — ${end}`;
  }

  return start === null ? "" : String(start);
}

/** "2026-03" ↔ { month: "Marzo", year: "2026" }, dal modello dell'Allenatore. */
export function agentPeriodToDateValue(month: string, year: string): string {
  return coachPeriodToDateValue(month, year);
}

export function agentPeriodFromDateValue(value: string): {
  month: string;
  year: string;
} {
  return coachPeriodFromDateValue(value);
}

/** Mese corrente nel formato del selettore: precompila "Concludi incarico". */
export function currentMonthValue(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Raggruppamento e ordinamento
// ---------------------------------------------------------------------------

/**
 * Chiave di raggruppamento: un identificativo, mai un nome.
 *
 * Una pagina canonica raggruppa per id della pagina; un'organizzazione
 * inserita a mano per il proprio id stabile; l'attività indipendente ha la
 * propria corsia. Un'organizzazione manuale priva di id — non dovrebbe
 * esistere dopo la migrazione — ricade sull'id del record, quindi resta sola
 * invece di finire nel gruppo sbagliato.
 */
export function getAssignmentGroupId(
  assignment: AgentCareerAssignment,
): string {
  if (assignment.organizationMode === "independent") {
    return AGENT_INDEPENDENT_GROUP_ID;
  }

  if (assignment.organizationClubId) {
    return `club:${assignment.organizationClubId}`;
  }

  if (assignment.manualOrganizationId) {
    return `manual:${assignment.manualOrganizationId}`;
  }

  return `entry:${assignment.id}`;
}

/**
 * Ordine degli incarichi dentro un gruppo (§"Ordinamento"): principale, poi in
 * corso, poi inizio più recente, poi fine più recente.
 */
export function sortAssignments(
  assignments: readonly AgentCareerAssignment[],
): AgentCareerAssignment[] {
  return [...assignments].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    const startDelta =
      (assignmentStartMonths(right) ?? 0) - (assignmentStartMonths(left) ?? 0);

    if (startDelta !== 0) {
      return startDelta;
    }

    return (
      (assignmentEndMonths(right) ?? Number.POSITIVE_INFINITY) -
      (assignmentEndMonths(left) ?? Number.POSITIVE_INFINITY)
    );
  });
}

export function formatAssignmentCount(count: number): string {
  return count === 1 ? "1 incarico" : `${count} incarichi`;
}

/**
 * Gruppi dell'hub e del riepilogo.
 *
 * Il nome del gruppo è quello dell'incarico più recente: se un'agenzia cambia
 * ragione sociale, la carriera mostra come si chiama adesso, non come si
 * chiamava nel primo incarico. Lo stesso vale per il logo.
 */
export function groupAgentAssignments(
  assignments: readonly AgentCareerAssignment[],
): AgentExperienceGroup[] {
  const buckets = new Map<string, AgentCareerAssignment[]>();

  for (const assignment of assignments) {
    const groupId = getAssignmentGroupId(assignment);
    const bucket = buckets.get(groupId);

    if (bucket) {
      bucket.push(assignment);
    } else {
      buckets.set(groupId, [assignment]);
    }
  }

  const groups = [...buckets.entries()].map(([groupId, bucket]) => {
    const sorted = sortAssignments(bucket);
    const leading = sorted[0];
    const isIndependent = groupId === AGENT_INDEPENDENT_GROUP_ID;
    const named = sorted.find((assignment) => assignment.organizationName);

    return {
      countLabel: formatAssignmentCount(sorted.length),
      groupId,
      hasPrimary: sorted.some((assignment) => assignment.isPrimary),
      isCurrent: sorted.some((assignment) => assignment.isCurrent),
      logoUrl: isIndependent ? "" : (named?.organizationLogoUrl ?? ""),
      organizationMode: isIndependent
        ? ("independent" as const)
        : ("agency" as const),
      organizationName: isIndependent
        ? AGENT_INDEPENDENT_LABEL
        : (named?.organizationName ?? AGENT_INDEPENDENT_LABEL),
      periodLabel: formatGroupPeriod(sorted),
      primaryRoleLabel: leading?.role ?? "",
      rows: sorted.map((assignment) => ({
        assignmentId: assignment.id,
        isCurrent: assignment.isCurrent,
        isPrimary: assignment.isPrimary,
        periodLabel: formatAssignmentPeriod(assignment),
        role: assignment.role,
      })),
    } satisfies AgentExperienceGroup;
  });

  return sortGroups(groups, assignments);
}

/**
 * Ordine dei gruppi (§"Ordinamento"): quello con l'esperienza principale, poi
 * quelli con incarichi in corso, poi fine più recente, poi inizio più recente.
 */
export function sortGroups(
  groups: readonly AgentExperienceGroup[],
  assignments: readonly AgentCareerAssignment[],
): AgentExperienceGroup[] {
  const byGroup = new Map<string, AgentCareerAssignment[]>();

  for (const assignment of assignments) {
    const groupId = getAssignmentGroupId(assignment);

    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), assignment]);
  }

  function latestEnd(groupId: string): number {
    const bucket = byGroup.get(groupId) ?? [];

    return bucket.reduce(
      (best, assignment) =>
        Math.max(best, assignmentEndMonths(assignment) ?? 0),
      0,
    );
  }

  function latestStart(groupId: string): number {
    const bucket = byGroup.get(groupId) ?? [];

    return bucket.reduce(
      (best, assignment) => Math.max(best, assignmentStartMonths(assignment) ?? 0),
      0,
    );
  }

  return [...groups].sort((left, right) => {
    if (left.hasPrimary !== right.hasPrimary) {
      return left.hasPrimary ? -1 : 1;
    }

    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    const endDelta = latestEnd(right.groupId) - latestEnd(left.groupId);

    if (endDelta !== 0) {
      return endDelta;
    }

    return latestStart(right.groupId) - latestStart(left.groupId);
  });
}

// ---------------------------------------------------------------------------
// Esperienza principale
// ---------------------------------------------------------------------------

/**
 * Quale incarico rappresenta la situazione attuale (§"Esperienza principale").
 *
 * Nell'ordine: l'incarico in corso marcato come principale; in sua assenza
 * quello in corso iniziato più di recente — l'attività indipendente partecipa
 * alla scelta come qualsiasi altro. Se nessun incarico è in corso la funzione
 * tace: un'esperienza conclusa non diventa mai la situazione di oggi.
 */
export function resolvePrimaryAssignment(
  assignments: readonly AgentCareerAssignment[],
): AgentCareerAssignment | null {
  const active = assignments.filter((assignment) => assignment.isCurrent);

  if (active.length === 0) {
    return null;
  }

  return (
    active.find((assignment) => assignment.isPrimary) ??
    active.reduce((best, assignment) =>
      (assignmentStartMonths(assignment) ?? 0) >
      (assignmentStartMonths(best) ?? 0)
        ? assignment
        : best,
    )
  );
}

/**
 * Il primo incarico in corso di una carriera vuota può nascere già principale
 * (§"Esperienza principale"), purché il form lo mostri. Non vale per il
 * secondo: lì la scelta è dell'utente.
 */
export function shouldDefaultToPrimary(
  assignments: readonly AgentCareerAssignment[],
  assignmentId: string | null,
): boolean {
  return !assignments.some(
    (assignment) => assignment.isCurrent && assignment.id !== assignmentId,
  );
}

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

export function validateAgentAssignment(
  assignment: AgentCareerAssignment,
  now: Date = new Date(),
): AgentAssignmentErrors {
  const errors: AgentAssignmentErrors = {};
  const nowMonths = now.getFullYear() * 12 + now.getMonth();

  if (assignment.organizationMode === "agency") {
    if (!assignment.organizationClubId && !assignment.manualOrganizationId) {
      errors.organization = "Seleziona un'agenzia o uno studio.";
    } else if (!assignment.organizationName.trim()) {
      errors.organization = "Inserisci il nome dell'organizzazione.";
    }
  }

  if (!assignment.role.trim()) {
    errors.role = "Seleziona un ruolo.";
  }

  const start = assignmentStartMonths(assignment);

  if (start === null) {
    errors.startDate = "Inserisci la data iniziale.";
  } else if (start > nowMonths) {
    errors.startDate = "La data non può essere successiva al mese corrente.";
  }

  if (!assignment.isCurrent) {
    const end = assignmentEndMonths(assignment);

    if (end === null) {
      errors.endDate = "Inserisci la data finale.";
    } else if (end > nowMonths) {
      errors.endDate = "La data non può essere successiva al mese corrente.";
    } else if (start !== null && end < start) {
      errors.endDate = "La data finale non può precedere quella iniziale.";
    }
  }

  return errors;
}

export function hasAgentAssignmentErrors(
  errors: AgentAssignmentErrors,
): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Duplicato esatto (§"Incarichi contemporanei"): stesso profilo, stessa
 * modalità, stessa organizzazione, stesso ruolo e stesso periodo. È l'unico
 * caso che blocca il salvataggio — la sovrapposizione no, quella è un avviso.
 */
export function isExactDuplicate(
  assignment: AgentCareerAssignment,
  others: readonly AgentCareerAssignment[],
): boolean {
  return others.some((other) => {
    if (other.id === assignment.id) {
      return false;
    }

    if (other.organizationMode !== assignment.organizationMode) {
      return false;
    }

    // Per l'attività indipendente l'organizzazione non esiste e non entra nel
    // confronto: due attività indipendenti identiche restano un duplicato.
    if (assignment.organizationMode === "agency") {
      if (
        other.organizationClubId !== assignment.organizationClubId ||
        other.manualOrganizationId !== assignment.manualOrganizationId
      ) {
        return false;
      }
    }

    return (
      other.role.trim().toLowerCase() === assignment.role.trim().toLowerCase() &&
      other.startYear === assignment.startYear &&
      other.startMonth === assignment.startMonth &&
      other.isCurrent === assignment.isCurrent &&
      other.endYear === assignment.endYear &&
      other.endMonth === assignment.endMonth
    );
  });
}

/**
 * Sovrapposizione temporale con un altro incarico. Non blocca niente: un
 * procuratore può collaborare con più organizzazioni nello stesso periodo, e
 * l'avviso serve solo a far ricontrollare le date.
 */
export function hasOverlappingAssignment(
  assignment: AgentCareerAssignment,
  others: readonly AgentCareerAssignment[],
  now: Date = new Date(),
): boolean {
  const nowMonths = now.getFullYear() * 12 + now.getMonth();
  const start = assignmentStartMonths(assignment);

  if (start === null) {
    return false;
  }

  const end = assignment.isCurrent
    ? nowMonths
    : (assignmentEndMonths(assignment) ?? nowMonths);

  return others.some((other) => {
    if (other.id === assignment.id) {
      return false;
    }

    const otherStart = assignmentStartMonths(other);

    if (otherStart === null) {
      return false;
    }

    const otherEnd = other.isCurrent
      ? nowMonths
      : (assignmentEndMonths(other) ?? nowMonths);

    return start <= otherEnd && otherStart <= end;
  });
}

/**
 * Due incarichi sono "lo stesso form riaperto" quando ogni campo coincide.
 * Serve al controllo delle modifiche non salvate: una bozza aperta e chiusa
 * senza toccare niente non deve chiedere conferma.
 */
export function isSameAssignment(
  left: AgentCareerAssignment,
  right: AgentCareerAssignment,
): boolean {
  return (
    left.description === right.description &&
    left.endMonth === right.endMonth &&
    left.endYear === right.endYear &&
    left.isCurrent === right.isCurrent &&
    left.isPrimary === right.isPrimary &&
    left.manualOrganizationId === right.manualOrganizationId &&
    left.organizationCity === right.organizationCity &&
    left.organizationClubId === right.organizationClubId &&
    left.organizationCountry === right.organizationCountry &&
    left.organizationMode === right.organizationMode &&
    left.organizationName === right.organizationName &&
    left.role === right.role &&
    left.startMonth === right.startMonth &&
    left.startYear === right.startYear
  );
}

export function createAgentAssignment(
  mode: AgentOrganizationMode,
): AgentCareerAssignment {
  return {
    description: "",
    endMonth: "",
    endPrecision: "month",
    endYear: "",
    id: createLocalAssignmentId(),
    isCurrent: false,
    isPrimary: false,
    manualOrganizationId: null,
    organizationCity: "",
    organizationClubId: null,
    organizationCountry: "",
    organizationLogoUrl: "",
    organizationMode: mode,
    organizationName: "",
    role: "",
    startMonth: "",
    startPrecision: "month",
    startYear: "",
  };
}
