/**
 * Modello di lettura della carriera per incarichi (REV-PROF-03, REV-PROF-06).
 *
 * È la controparte di `player-career-model` per i Master Profile Allenatore e
 * Staff tecnico: un unico posto in cui gli incarichi vengono normalizzati,
 * ordinati e resi in stagioni. I componenti ricevono dati già pronti e non
 * rifanno aggregazioni.
 *
 * Le due tipologie salvano l'incarico nella stessa forma e differiscono solo
 * in campi che questo modello non legge, quindi l'ingresso è tipizzato per
 * struttura (`CareerEntryLike`) e non per tabella: lo Staff tecnico riusa
 * questo modello invece di possederne una copia.
 *
 * Due vincoli espliciti della task guidano questo file:
 *
 * - ruolo e categoria appartengono alla **singola stagione**, non
 *   all'incarico: `season_details` vince sempre sui campi di testata, che
 *   restano solo il fallback delle righe che non lo portano;
 * - l'ordine ricevuto dall'API non è attendibile: viene sempre ricalcolato.
 *
 * Nessuna statistica da giocatore entra in questo modello: la carriera da ex
 * calciatore passa invece per `buildCoachPlayerCareerForms`, che la consegna al
 * modello già approvato del Calciatore.
 */
import {
  formatSeasonShort,
} from "../../onboarding/career/player-career-utils";
import { coachPlayerRecordsToForms } from "../coach-career/coach-player-career";
import type { PlayerExperienceForm } from "../player-sports";
import type {
  CoachCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
} from "../profile-service";
import { getCurrentSeasonKey } from "./player-career-model";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

/**
 * Forma minima di un incarico leggibile da questo modello.
 *
 * `experience_group_id` è opzionale perché esiste solo sulla carriera
 * dell'Allenatore (REV-PROF-04): senza gruppo ogni riga resta un'esperienza a
 * sé, che è esattamente il comportamento dello Staff tecnico.
 */
export type CareerEntryLike = Omit<
  CoachCareerEntryRecord,
  "coach_profile_id" | "experience_group_id"
> & {
  experience_group_id?: string | null;
};

export type CoachCareerSeason = {
  /** Categoria della singola stagione. Stringa vuota = non indicata. */
  category: string;
  /** Etichetta compatta mostrata a schermo: "2024/25". */
  label: string;
  /** Ruolo ricoperto in quella stagione, non nell'intero incarico. */
  role: string;
  /** Chiave canonica della stagione: "2024/2025". */
  seasonKey: string;
  startYear: number | null;
};

export type CoachCareerExperience = {
  /**
   * Categoria di riferimento dell'incarico: quella della stagione più
   * recente, non un campo indipendente.
   */
  category: string;
  clubId: string | null;
  clubName: string;
  /** Id dell'incarico: due incarichi nello stesso club restano distinti. */
  id: string;
  /** L'incarico copre la stagione sportiva in corso. */
  isCurrent: boolean;
  logoUrl: string;
  /** "2022 — Presente · 3 stagioni", oppure il periodo reale di un CUSTOM_PERIOD. */
  periodLabel: string;
  /** Ruolo di riferimento dell'incarico: quello della stagione più recente. */
  role: string;
  seasons: CoachCareerSeason[];
};

export type CoachCareerView = {
  experiences: CoachCareerExperience[];
  /**
   * Stagioni allenate, contate una sola volta: due incarichi simultanei nella
   * stessa stagione non valgono due stagioni di esperienza.
   */
  seasonCount: number;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

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

  if (index >= 0) {
    return index + 1;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function seasonStartYear(seasonKey: string): number | null {
  const parsed = Number.parseInt(seasonKey.slice(0, 4), 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function formatSeasonCount(count: number): string {
  return count === 1 ? "1 stagione" : `${count} stagioni`;
}

function monthYearLabel(month: string | null, year: number | null): string {
  if (!year) {
    return "";
  }

  const monthNumber = monthToNumber(month);
  const monthLabel = monthNumber ? MONTH_LABELS[monthNumber - 1] : null;

  return [monthLabel, String(year)].filter(Boolean).join(" ");
}

/** Mesi assoluti dall'anno 0: rende confrontabili periodi e stagioni. */
function toAbsoluteMonth(year: number, month: number): number {
  return year * 12 + month;
}

function hasCustomPeriod(entry: CareerEntryLike): boolean {
  return Boolean(entry.period_start_year && entry.period_end_year);
}

/**
 * Stagioni dell'incarico. Un periodo personalizzato senza stagioni salvate le
 * deriva dai suoi anni: è una derivazione dichiarata, non un dato inventato,
 * e serve solo a dare una riga per anno sportivo coperto.
 */
function resolveSeasonKeys(entry: CareerEntryLike): string[] {
  const saved = entry.seasons.filter((season) => Boolean(season?.trim()));

  if (saved.length > 0) {
    return [...new Set(saved)];
  }

  if (!hasCustomPeriod(entry)) {
    return [];
  }

  const startYear = entry.period_start_year as number;
  const endYear = entry.period_end_year as number;
  const startMonth = monthToNumber(entry.period_start_month) ?? 7;
  const endMonth = monthToNumber(entry.period_end_month) ?? 6;
  // Luglio apre la stagione sportiva: un periodo che inizia prima appartiene
  // ancora alla stagione cominciata l'anno precedente.
  const firstSeason = startMonth >= 7 ? startYear : startYear - 1;
  const lastSeason = endMonth >= 7 ? endYear : endYear - 1;

  if (lastSeason < firstSeason) {
    return [`${firstSeason}/${firstSeason + 1}`];
  }

  const keys: string[] = [];

  for (let year = firstSeason; year <= lastSeason; year += 1) {
    keys.push(`${year}/${year + 1}`);
  }

  return keys;
}

function toCoachSeasons(entry: CareerEntryLike): CoachCareerSeason[] {
  const fallbackCategory = entry.category?.trim() ?? "";
  const fallbackRole = entry.role?.trim() ?? "";

  return resolveSeasonKeys(entry)
    .map((seasonKey) => {
      // Il dettaglio per stagione è la source of truth di ruolo e categoria:
      // nella stessa società l'incarico può cambiare da una stagione all'altra.
      const detail = entry.season_details?.[seasonKey];

      return {
        category: detail?.category?.trim() || fallbackCategory,
        label: formatSeasonShort(seasonKey),
        role: detail?.role?.trim() || fallbackRole,
        seasonKey,
        startYear: seasonStartYear(seasonKey),
      } satisfies CoachCareerSeason;
    })
    .sort((left, right) => (right.startYear ?? -1) - (left.startYear ?? -1));
}

function buildPeriodLabel(
  entry: CareerEntryLike,
  seasons: CoachCareerSeason[],
  isCurrent: boolean,
): string {
  if (hasCustomPeriod(entry) && entry.seasons.length === 0) {
    const start = monthYearLabel(
      entry.period_start_month,
      entry.period_start_year,
    );
    const end = isCurrent
      ? "Presente"
      : monthYearLabel(entry.period_end_month, entry.period_end_year);

    return [start, end].filter(Boolean).join(" — ");
  }

  const years = seasons
    .map((season) => season.startYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) {
    return seasons.length > 0 ? formatSeasonCount(seasons.length) : "";
  }

  const startYear = Math.min(...years);
  const endYear = Math.max(...years) + 1;
  const range = isCurrent
    ? `${startYear} — Presente`
    : startYear === endYear - 1
      ? `${startYear}/${String(endYear).slice(2)}`
      : `${startYear} — ${endYear}`;

  return `${range} · ${formatSeasonCount(seasons.length)}`;
}

type ExperienceBounds = {
  end: number;
  start: number;
};

function buildBounds(
  entry: CareerEntryLike,
  seasons: CoachCareerSeason[],
): ExperienceBounds {
  if (hasCustomPeriod(entry)) {
    const startMonth = monthToNumber(entry.period_start_month) ?? 7;
    const endMonth = monthToNumber(entry.period_end_month) ?? 6;

    return {
      end: toAbsoluteMonth(entry.period_end_year as number, endMonth),
      start: toAbsoluteMonth(entry.period_start_year as number, startMonth),
    };
  }

  const years = seasons
    .map((season) => season.startYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) {
    return { end: 0, start: 0 };
  }

  // Convenzione della stagione sportiva: luglio → giugno dell'anno dopo.
  return {
    end: toAbsoluteMonth(Math.max(...years) + 1, 6),
    start: toAbsoluteMonth(Math.min(...years), 7),
  };
}

function toCoachExperience(
  entry: CareerEntryLike,
  currentSeasonKey: string,
  now: Date,
): CoachCareerExperience & { bounds: ExperienceBounds } {
  const seasons = toCoachSeasons(entry);
  const bounds = buildBounds(entry, seasons);
  const nowMonth = toAbsoluteMonth(now.getFullYear(), now.getMonth() + 1);
  const isCurrent =
    hasCustomPeriod(entry) && entry.seasons.length === 0
      ? bounds.end >= nowMonth
      : seasons.some((season) => season.seasonKey === currentSeasonKey);
  const latestSeason = seasons[0];

  return {
    bounds,
    category: latestSeason?.category ?? entry.category?.trim() ?? "",
    clubId: entry.club_id ?? null,
    clubName: entry.team_name?.trim() || "Società non indicata",
    id: entry.id,
    isCurrent,
    logoUrl: entry.team_logo_url ?? "",
    periodLabel: buildPeriodLabel(entry, seasons, isCurrent),
    role: latestSeason?.role ?? entry.role?.trim() ?? "",
    seasons,
  };
}

// ---------------------------------------------------------------------------
// Costruzione della vista
// ---------------------------------------------------------------------------

/**
 * Riunisce le assegnazioni di una stessa esperienza in un record unico
 * (REV-PROF-04).
 *
 * Da quando il backend salva una riga per stagione, il Master Profile
 * riceverebbe tre "Torino FC" invece di un incarico con tre stagioni.
 * `experience_group_id` dice quali righe sono la stessa esperienza; qui
 * tornano nella forma che il resto di questo modello già sa leggere, con ruolo
 * e categoria di ciascuna stagione raccolti in `season_details`.
 *
 * Le righe scritte prima della migrazione non hanno un gruppo: ognuna è
 * un'esperienza a sé e attraversa questa funzione immutata.
 */
function mergeCoachRecordsByGroup(
  entries: readonly CareerEntryLike[],
): CareerEntryLike[] {
  const groups = new Map<string, CareerEntryLike[]>();

  for (const entry of entries) {
    const key = entry.experience_group_id?.trim() || entry.id;
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return [...groups.entries()].map(([groupId, records]) => {
    if (records.length === 1) {
      return records[0];
    }

    // Un periodo personalizzato non si fonde con delle stagioni: se nel gruppo
    // ce n'è uno, è lui a dare la forma temporale al record risultante.
    const period = records.find(
      (record) => record.experience_type === "CUSTOM_PERIOD",
    );
    const base = period ?? records[0];
    const seasons: string[] = [];
    const seasonDetails: Record<string, { category?: string; role?: string }> = {};

    for (const record of records) {
      for (const seasonKey of record.seasons) {
        if (!seasonKey?.trim() || seasons.includes(seasonKey)) {
          continue;
        }

        seasons.push(seasonKey);
        const detail = record.season_details?.[seasonKey];

        seasonDetails[seasonKey] = {
          category: detail?.category?.trim() || record.category?.trim() || "",
          role: detail?.role?.trim() || record.role?.trim() || "",
        };
      }
    }

    return {
      ...base,
      experience_type: period
        ? "CUSTOM_PERIOD"
        : seasons.length > 1
          ? "MULTI_SEASON"
          : base.experience_type,
      id: groupId,
      results: records.flatMap((record) => record.results ?? []),
      season_details: seasonDetails,
      seasons,
    } satisfies CareerEntryLike;
  });
}

export function buildCareerView(
  rawEntries: readonly CareerEntryLike[],
  { now = new Date() }: { now?: Date } = {},
): CoachCareerView {
  const currentSeasonKey = getCurrentSeasonKey(now);
  const entries = mergeCoachRecordsByGroup(rawEntries);
  const experiences = entries
    .map((entry) => toCoachExperience(entry, currentSeasonKey, now))
    // Ordinamento canonico della task: in corso prima, poi fine decrescente,
    // a parità inizio decrescente. L'ordine dell'API non viene mai assunto.
    .sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
      }

      if (left.bounds.end !== right.bounds.end) {
        return right.bounds.end - left.bounds.end;
      }

      return right.bounds.start - left.bounds.start;
    })
    .map(({ bounds: _bounds, ...experience }) => experience);

  const seasonKeys = new Set(
    experiences.flatMap((experience) =>
      experience.seasons.map((season) => season.seasonKey),
    ),
  );

  return { experiences, seasonCount: seasonKeys.size };
}

/** Nome storico del builder, mantenuto per la carriera dell'Allenatore. */
export const buildCoachCareerView = buildCareerView;

/**
 * Incarico principale: quello marcato come esperienza in corso. Se ce n'è più
 * di uno vince il più recente per data di inizio, senza che gli altri spariscano
 * dalla carriera. Se non ce n'è nessuno la funzione tace, invece di promuovere
 * l'ultima riga salvata a "società attuale".
 */
export function getCurrentExperience(
  view: CoachCareerView,
): CoachCareerExperience | null {
  return view.experiences.find((experience) => experience.isCurrent) ?? null;
}

/** Nome storico, mantenuto per la carriera dell'Allenatore. */
export const getCurrentCoachExperience = getCurrentExperience;

// ---------------------------------------------------------------------------
// Carriera da ex calciatore
// ---------------------------------------------------------------------------

/**
 * Adatta la carriera da ex calciatore dell'Allenatore al formato che il Master
 * Profile Calciatore già sa leggere: nessun componente di carriera viene
 * riscritto, viene riusato quello approvato.
 *
 * REV-PROF-04 ha spostato la conversione in `coach-career/coach-player-career`,
 * dove serve anche in scrittura. Da quando le righe portano
 * `experience_group_id`, due passaggi distinti nella stessa società non
 * collassano più in un'unica esperienza per somiglianza di nome.
 */
export function buildCoachPlayerCareerForms(
  entries: readonly CoachPlayerCareerEntryRecord[],
): PlayerExperienceForm[] {
  return coachPlayerRecordsToForms(entries);
}
