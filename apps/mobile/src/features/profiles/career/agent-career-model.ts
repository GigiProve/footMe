/**
 * Derivazioni del Master Profile Procuratore (REV-PROF-13).
 *
 * Il Procuratore non entra nel modello di carriera condiviso da Allenatore,
 * Staff tecnico e Dirigente: quello ragiona per stagioni sportive, questo per
 * periodi datati (mese/anno → mese/anno). Un incarico in agenzia non è "la
 * stagione 2024/25", quindi forzarlo in quel modello inventerebbe stagioni che
 * nessuno ha inserito. Qui vive la lettura canonica dei record periodici, con
 * la stessa disciplina degli altri modelli: niente conteggi memorizzati, tutto
 * ricalcolato dai record a ogni render.
 *
 * Una sola fonte per l'incarico attuale. Fino a REV-PROF-13 l'agenzia corrente
 * stava su tre colonne di `agent_profiles` e le esperienze precedenti su
 * `agent_career_entries`: due posti per lo stesso fatto, che divergevano alla
 * prima modifica. La migrazione 20261002120000 mappa le colonne legacy dentro
 * la carriera; questo modulo legge solo la carriera e usa le colonne legacy
 * soltanto come rete di sicurezza per un profilo non ancora migrato.
 *
 * Da REV-PROF-15 quella rete si spegne da sola. `career_migrated_at` dice che
 * quel profilo è passato al modello canonico: da lì in poi la carriera è la
 * sola fonte, e chi cancella il proprio ultimo incarico non si vede ricomparire
 * la vecchia agenzia dalle colonne legacy, che restano scritte ma inerti.
 */
import type {
  AgentCareerEntryRecord,
  AgentManagedPlayerEntryRecord,
  AgentProfileRecord,
} from "../agent-profile";
import { AGENT_ACTIVITY_SCOPE_OPTIONS } from "../../onboarding/agent/agent-taxonomy";
import type { PlayerExperienceForm } from "../player-sports";
import { buildCareerView, type CoachCareerView } from "./coach-career-model";
import { parseDirectorCareerEntries } from "./director-career-model";

/** Percorso professionale mostrato dal selettore della tab Carriera. */
export type AgentCareerPath =
  | "agent"
  | "director"
  | "coach"
  | "staff"
  | "player"
  | "other";

export type AgentCareerExperience = {
  /** Nome dell'agenzia, oppure `null` per un professionista indipendente. */
  agencyName: string | null;
  id: string;
  /** L'incarico è in corso. */
  isCurrent: boolean;
  /** L'incarico principale: quello che l'header e la Situazione attuale mostrano. */
  isPrimary: boolean;
  logoUrl: string | null;
  /** Agenzia/studio oppure attività per conto proprio. */
  organizationMode: "agency" | "independent";
  /** "2021 — Presente", oppure il periodo reale. */
  periodLabel: string;
  role: string;
  /** Mese/anno di inizio normalizzati in mesi assoluti, per i calcoli. */
  startMonths: number | null;
  endMonths: number | null;
};

export type AgentProfileCareer = {
  /** Anni di attività da procuratore, periodi sovrapposti uniti una volta sola. */
  activityYears: number | null;
  /**
   * REV-PROF-15: i percorsi aggiuntivi, nel modello già approvato per gli
   * altri ruoli. Non vengono mai convertiti in incarichi da procuratore: sono
   * carriere a stagioni, e restano tali.
   */
  coach: CoachCareerView;
  coachExperienceCount: number;
  director: CoachCareerView;
  directorExperienceCount: number;
  staff: CoachCareerView;
  staffExperienceCount: number;
  /** Incarico principale in corso, o `null` se nessuno lo è. */
  currentExperience: AgentCareerExperience | null;
  /** Tutte le esperienze pubbliche, già ordinate. */
  experiences: AgentCareerExperience[];
  /** Mercati professionali distinti dichiarati nel profilo. */
  marketCount: number;
  marketLabels: string[];
  /** Esperienze diverse dall'attuale principale. */
  previousExperiences: AgentCareerExperience[];
  /** Carriera da ex calciatore, nella forma che il Calciatore già legge. */
  playerForms: PlayerExperienceForm[];
  playerExperienceCount: number;
  /** Altri ruoli dichiarati in onboarding, senza un flusso carriera dedicato. */
  otherRoleLabels: string[];
};

const MONTH_LABELS = [
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
];

function monthToNumber(month: string | null | undefined): number | null {
  const trimmed = month?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const index = MONTH_LABELS.findIndex(
    (label) => label.toLowerCase() === trimmed,
  );

  return index >= 0 ? index + 1 : null;
}

/**
 * Un punto del periodo in mesi assoluti, per poter confrontare e sommare
 * periodi che a volte hanno il mese e a volte no. Senza mese si assume gennaio
 * per l'inizio: è la lettura più conservativa, perché non allunga la durata
 * oltre quanto dichiarato.
 */
function toAbsoluteMonths(
  year: number | null | undefined,
  month: string | null | undefined,
  fallbackMonth: number,
): number | null {
  if (typeof year !== "number" || !Number.isFinite(year)) {
    return null;
  }

  return year * 12 + ((monthToNumber(month) ?? fallbackMonth) - 1);
}

function formatPeriodPoint(
  month: string | null | undefined,
  year: number | null | undefined,
): string | null {
  const trimmedMonth = month?.trim();

  if (typeof year !== "number" || !Number.isFinite(year)) {
    return null;
  }

  return trimmedMonth ? `${trimmedMonth} ${year}` : String(year);
}

/**
 * "2021 — Presente" per un incarico in corso, il periodo reale altrimenti.
 * Un periodo del tutto assente non diventa "Periodo da definire" davanti a un
 * visitor: la riga resta senza periodo, invece di dichiarare un dato mancante.
 */
function buildPeriodLabel(
  entry: AgentCareerEntryRecord,
  isCurrent: boolean,
): string {
  const start = formatPeriodPoint(entry.period_start_month, entry.period_start_year);
  const end = formatPeriodPoint(entry.period_end_month, entry.period_end_year);

  if (start && isCurrent) {
    return `${start} — Presente`;
  }

  if (start && end) {
    return `${start} — ${end}`;
  }

  if (start) {
    return start;
  }

  if (end) {
    return `Fino a ${end}`;
  }

  return isCurrent ? "In corso" : "";
}

function readOrganizationMode(
  entry: AgentCareerEntryRecord,
): "agency" | "independent" {
  return entry.organization_mode === "independent" ? "independent" : "agency";
}

function toExperience(entry: AgentCareerEntryRecord): AgentCareerExperience {
  /*
    `is_current` è il dato canonico, ma un record scritto prima della
    migrazione può non averlo: l'assenza di una data di fine resta la lettura
    di riserva, la stessa che la migrazione usa per il backfill.
  */
  const isCurrent =
    entry.is_current ??
    (entry.period_end_year == null && entry.period_end_month == null);
  const organizationMode = readOrganizationMode(entry);
  const agencyName = entry.agency_name?.trim() || null;

  return {
    agencyName: organizationMode === "independent" ? null : agencyName,
    endMonths: toAbsoluteMonths(entry.period_end_year, entry.period_end_month, 12),
    id: entry.id,
    isCurrent,
    isPrimary: entry.is_primary ?? false,
    logoUrl: entry.agency_logo_url?.trim() || null,
    organizationMode,
    periodLabel: buildPeriodLabel(entry, isCurrent),
    role: entry.role?.trim() || "Procuratore",
    startMonths: toAbsoluteMonths(
      entry.period_start_year,
      entry.period_start_month,
      1,
    ),
  };
}

/**
 * Ordinamento canonico della task: in corso per primi, poi fine più recente,
 * a parità inizio più recente. L'ordine restituito dall'API non viene mai
 * assunto, nemmeno quando `sort_order` sembra già corretto.
 */
function sortExperiences(
  experiences: AgentCareerExperience[],
): AgentCareerExperience[] {
  return [...experiences].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    const leftEnd = left.endMonths ?? Number.POSITIVE_INFINITY;
    const rightEnd = right.endMonths ?? Number.POSITIVE_INFINITY;

    if (leftEnd !== rightEnd) {
      return rightEnd - leftEnd;
    }

    return (right.startMonths ?? 0) - (left.startMonths ?? 0);
  });
}

/**
 * Esperienza di riserva costruita dalle colonne legacy di `agent_profiles`.
 *
 * Serve solo finché la migrazione non è passata su quel profilo: senza di
 * questa, un procuratore già registrato vedrebbe la propria agenzia sparire
 * dal profilo il giorno del rilascio. Non viene mai aggiunta se la carriera
 * contiene già qualcosa, così non può nascere un doppione.
 */
function buildLegacyExperience(
  agentProfile: AgentProfileRecord | null,
): AgentCareerExperience | null {
  if (!agentProfile) {
    return null;
  }

  const agencyName = agentProfile.agency_name?.trim() || null;
  const isIndependent = agentProfile.professional_mode === "independent";

  if (!agencyName && !isIndependent) {
    return null;
  }

  const isCurrent =
    agentProfile.period_end_year == null && agentProfile.period_end_month == null;

  return {
    agencyName: isIndependent ? null : agencyName,
    endMonths: toAbsoluteMonths(
      agentProfile.period_end_year,
      agentProfile.period_end_month,
      12,
    ),
    id: `${agentProfile.profile_id}-legacy-current`,
    isCurrent,
    isPrimary: isCurrent,
    logoUrl: agentProfile.agency_logo_url?.trim() || null,
    organizationMode: isIndependent ? "independent" : "agency",
    periodLabel: buildPeriodLabel(
      {
        period_end_month: agentProfile.period_end_month,
        period_end_year: agentProfile.period_end_year,
        period_start_month: agentProfile.period_start_month,
        period_start_year: agentProfile.period_start_year,
      } as AgentCareerEntryRecord,
      isCurrent,
    ),
    role: agentProfile.agency_role?.trim() || "Procuratore",
    startMonths: toAbsoluteMonths(
      agentProfile.period_start_year,
      agentProfile.period_start_month,
      1,
    ),
  };
}

/**
 * Incarico principale (REV-PROF-13 §"Agenzia attuale"). Nell'ordine:
 * l'esperienza attiva marcata principale, poi l'attiva iniziata più di
 * recente. Un'esperienza conclusa non viene mai promossa ad attuale: se
 * nessun incarico è in corso la funzione tace, invece di far passare l'ultima
 * riga salvata per la situazione di oggi.
 */
function resolveCurrentExperience(
  experiences: AgentCareerExperience[],
): AgentCareerExperience | null {
  const active = experiences.filter((experience) => experience.isCurrent);

  if (active.length === 0) {
    return null;
  }

  return (
    active.find((experience) => experience.isPrimary) ??
    active.reduce((best, experience) =>
      (experience.startMonths ?? 0) > (best.startMonths ?? 0) ? experience : best,
    )
  );
}

/**
 * Anni di attività da procuratore (REV-PROF-13 §"Anni").
 *
 * Regola unica e documentata: i periodi vengono uniti prima di essere contati,
 * così due incarichi simultanei non valgono il doppio degli anni; la durata si
 * misura in mesi e si arrotonda per difetto, perché nove mesi di attività non
 * sono "un anno di esperienza". Un'attività senza data di inizio non entra nel
 * conto — un anno non calcolabile deve sparire, non diventare zero. Il dato non
 * deriva mai dalla data di creazione dell'account.
 */
export function computeAgentActivityYears(
  experiences: readonly AgentCareerExperience[],
  now: Date = new Date(),
): number | null {
  const nowMonths = now.getFullYear() * 12 + now.getMonth();
  const ranges = experiences
    .map((experience) => {
      if (experience.startMonths === null) {
        return null;
      }

      const end = experience.isCurrent
        ? nowMonths
        : (experience.endMonths ?? nowMonths);

      return end >= experience.startMonths
        ? { end, start: experience.startMonths }
        : null;
    })
    .filter((range): range is { end: number; start: number } => range !== null)
    .sort((left, right) => left.start - right.start);

  if (ranges.length === 0) {
    return null;
  }

  // Fusione dei periodi sovrapposti o contigui: un mese di attività vale uno,
  // indipendentemente da quanti incarichi lo coprono.
  let totalMonths = 0;
  let currentStart = ranges[0]!.start;
  let currentEnd = ranges[0]!.end;

  for (const range of ranges.slice(1)) {
    if (range.start <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, range.end);
      continue;
    }

    totalMonths += currentEnd - currentStart + 1;
    currentStart = range.start;
    currentEnd = range.end;
  }

  totalMonths += currentEnd - currentStart + 1;

  const years = Math.floor(totalMonths / 12);

  return years > 0 ? years : null;
}

/**
 * Mercati professionali (REV-PROF-13 §"Mercati"): gli ambiti di attività del
 * catalogo dell'onboarding, mai le regioni o le province. `activity_scopes` è
 * il dato strutturato; `operational_focuses` è la colonna che lo precedeva e
 * resta leggibile per i profili che non hanno ancora rifatto l'onboarding.
 */
export function buildAgentMarketLabels(
  agentProfile: AgentProfileRecord | null,
): string[] {
  const scopes = agentProfile?.activity_scopes ?? [];
  const labels = scopes
    .map(
      (scope) =>
        AGENT_ACTIVITY_SCOPE_OPTIONS.find((option) => option.value === scope)
          ?.label ?? null,
    )
    .filter((label): label is string => Boolean(label));

  if (labels.length > 0) {
    return [...new Set(labels)];
  }

  const legacy = (agentProfile?.operational_focuses ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(legacy)];
}

/**
 * Assistiti pubblici contati dal portfolio visibile, non da una colonna.
 *
 * `portfolio_range` e `managed_players_count` restano dichiarazioni
 * dell'onboarding: una fascia scelta a mano non può smentire l'elenco che il
 * visitor ha davanti, quindi non partecipa a questo conteggio. Gli inserimenti
 * manuali restano fuori: il modello non porta né visibilità né consenso per
 * quelle righe, quindi non sono pubblicabili.
 */
export function countPublicAssistiti(publicRelationCount: number): number {
  return Math.max(0, publicRelationCount);
}

/**
 * Inserimenti manuali tenuti fuori dal profilo pubblico (REV-PROF-13
 * §"Inserimenti manuali"). `agent_managed_player_entries` non ha né una
 * visibilità né un consenso del giocatore: finché il modello non li prevede,
 * la riga resta nella gestione dell'owner e non diventa un assistito pubblico
 * né entra nel conteggio.
 */
export function isManualEntryPubliclyVisible(
  _entry: AgentManagedPlayerEntryRecord,
): boolean {
  return false;
}

/** Percorsi realmente presenti: senza aggiuntivi il selettore non compare. */
export function getAvailableAgentPaths(
  career: AgentProfileCareer,
): AgentCareerPath[] {
  const paths: AgentCareerPath[] = ["agent"];

  /*
    REV-PROF-15: i percorsi aggiuntivi del Procuratore sono quattro. Compaiono
    nel selettore solo quando contengono davvero qualcosa — una chip che non
    sceglie niente non è un percorso disponibile.
  */
  if (career.directorExperienceCount > 0) {
    paths.push("director");
  }

  if (career.coachExperienceCount > 0) {
    paths.push("coach");
  }

  if (career.staffExperienceCount > 0) {
    paths.push("staff");
  }

  if (career.playerExperienceCount > 0) {
    paths.push("player");
  }

  return paths;
}

const PREVIOUS_ROLE_LABELS: Record<string, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  other: "Altri ruoli",
  player: "Calciatore",
  scout: "Scout",
  staff: "Staff tecnico",
};

function readPlayerForms(
  agentProfile: AgentProfileRecord | null,
): PlayerExperienceForm[] {
  const raw = agentProfile?.player_career_entries;

  if (!Array.isArray(raw)) {
    return [];
  }

  /*
    La colonna è `jsonb` e nessun vincolo ne garantisce la forma: una riga
    illeggibile viene scartata, non fatta esplodere addosso al profilo.
  */
  return raw.filter(
    (entry): entry is PlayerExperienceForm =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
  );
}

export function buildAgentProfileCareer({
  agentCareerEntries,
  agentProfile,
}: {
  agentCareerEntries: readonly AgentCareerEntryRecord[];
  agentProfile: AgentProfileRecord | null;
}): AgentProfileCareer {
  const visibleEntries = agentCareerEntries.filter(
    (entry) => (entry.visibility ?? "public") === "public",
  );

  const fromCareer = visibleEntries.map(toExperience);
  const legacy =
    fromCareer.length === 0 && !agentProfile?.career_migrated_at
      ? buildLegacyExperience(agentProfile)
      : null;
  const experiences = sortExperiences(legacy ? [legacy] : fromCareer);
  const currentExperience = resolveCurrentExperience(experiences);
  const playerForms = readPlayerForms(agentProfile);
  const marketLabels = buildAgentMarketLabels(agentProfile);

  const otherRoleLabels = (agentProfile?.previous_roles ?? [])
    .filter((role) => role !== "none" && role !== "player")
    .map((role) => PREVIOUS_ROLE_LABELS[role] ?? role)
    .filter(Boolean);

  const coach = buildCareerView(
    parseDirectorCareerEntries(agentProfile?.coach_career_entries, "agent-coach"),
  );
  const director = buildCareerView(
    parseDirectorCareerEntries(
      agentProfile?.director_career_entries,
      "agent-director",
    ),
  );
  const staff = buildCareerView(
    parseDirectorCareerEntries(agentProfile?.staff_career_entries, "agent-staff"),
  );

  return {
    activityYears: computeAgentActivityYears(experiences),
    coach,
    coachExperienceCount: coach.experiences.length,
    currentExperience,
    director,
    directorExperienceCount: director.experiences.length,
    staff,
    staffExperienceCount: staff.experiences.length,
    experiences,
    marketCount: marketLabels.length,
    marketLabels,
    otherRoleLabels: [...new Set(otherRoleLabels)],
    playerExperienceCount: playerForms.length,
    playerForms,
    previousExperiences: experiences.filter(
      (experience) => experience.id !== currentExperience?.id,
    ),
  };
}

/**
 * Etichetta dell'organizzazione mostrata a schermo: un indipendente non ha un
 * nome da mostrare, ha una modalità di lavoro.
 */
export function formatAgentOrganizationLabel(
  experience: AgentCareerExperience,
): string {
  if (experience.organizationMode === "independent") {
    return "Professionista indipendente";
  }

  return experience.agencyName ?? "Professionista indipendente";
}
