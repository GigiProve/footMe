import { formatPosition, formatRole } from "../profiles/profile-display-helpers";
import type { ProfileSearchRow, SearchProfileRole } from "./search-types";

const ITALIAN_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "Scadenza 15 luglio" from a date-only ISO string (parsed without timezone drift). */
export function formatDeadlineLabel(deadline: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline);

  if (!match) {
    return "";
  }

  const day = Number(match[3]);
  const month = ITALIAN_MONTHS[Number(match[2]) - 1];

  if (!month || day < 1 || day > 31) {
    return "";
  }

  return `Scadenza ${day} ${month}`;
}

/** Small label helper for the club-kind chip family, shared across rows. */
export function formatClubKindLabel(isAffiliate: boolean): string {
  return isAffiliate ? "Affiliata" : "Società";
}

const COACH_CONTEXT_LABELS: Record<string, string> = {
  prima_squadra: "Prima squadra",
  settore_giovanile: "Settore giovanile",
  entrambi: "Prima squadra e settore giovanile",
};

export type ProfileMetaLines = {
  lines: string[];
  note: string | null;
};

function buildPlayerMetaLines(row: ProfileSearchRow): ProfileMetaLines {
  const line1 = [
    formatPosition(row.primary_position),
    row.current_club_name ?? row.current_team_name ?? "Svincolato",
  ]
    .filter(Boolean)
    .join(" • ");

  const line2 = [
    row.birth_year != null ? `Classe ${row.birth_year}` : null,
    row.current_category ?? null,
  ]
    .filter(Boolean)
    .join(" • ");

  const line3 = row.region ?? "";

  const note = row.is_open_to_transfer
    ? "Disponibile al trasferimento"
    : row.is_available
      ? "Disponibile a valutare opportunità"
      : null;

  return {
    lines: [line1, line2, line3].filter(Boolean).slice(0, 3),
    note,
  };
}

function buildCoachMetaLines(row: ProfileSearchRow): ProfileMetaLines {
  const roleLabel = row.coach_primary_role ?? formatRole(row.role);
  const line1 = [roleLabel, row.coach_top_license].filter(Boolean).join(" ");

  const line2 = row.coach_context ? COACH_CONTEXT_LABELS[row.coach_context] ?? "" : "";

  const line3 = row.region ?? "";

  const note = row.open_to_new_role ? "Disponibile" : null;

  return {
    lines: [line1, line2, line3].filter(Boolean).slice(0, 3),
    note,
  };
}

function buildStaffMetaLines(row: ProfileSearchRow): ProfileMetaLines {
  const line1 = row.staff_primary_role ?? formatRole(row.role);
  const line2 = row.experience_summary ?? "";
  const line3 = row.region ?? "";

  const note = row.open_to_work ? "Disponibile" : null;

  return {
    lines: [line1, line2, line3].filter(Boolean).slice(0, 3),
    note,
  };
}

function buildAgentMetaLines(row: ProfileSearchRow): ProfileMetaLines {
  const line1 = "Procuratore";

  const line2 = row.managed_players_count
    ? row.managed_players_count.replace("calciatori", "assistiti")
    : "";

  const areas = (row.agent_operating_areas ?? []).join(" • ");
  const experience =
    row.years_experience != null ? `Esperienza: ${row.years_experience} anni` : "";
  const line3 = [areas, experience].filter(Boolean).join(" • ");

  const note = row.open_to_players ? "Valuta nuovi assistiti" : null;

  return {
    lines: [line1, line2, line3].filter(Boolean).slice(0, 3),
    note,
  };
}

/**
 * Builds up to 3 caption lines + an accent "note" line for a
 * `ProfileResultRow`, tailored per role. Reuses `formatRole`/`formatPosition`
 * so the labels stay in sync with the rest of the profile UI.
 */
export function buildProfileMetaLines(row: ProfileSearchRow): ProfileMetaLines {
  switch (row.role) {
    case "player":
      return buildPlayerMetaLines(row);
    case "coach":
      return buildCoachMetaLines(row);
    case "staff":
      return buildStaffMetaLines(row);
    case "agent":
      return buildAgentMetaLines(row);
    default: {
      const _exhaustive: never = row.role;
      throw new Error(`Unknown profile role: ${String(_exhaustive)}`);
    }
  }
}

const RESULTS_COUNT_NOUNS: Record<
  SearchProfileRole | "all",
  { singular: string; plural: string }
> = {
  all: { singular: "profilo", plural: "profili" },
  player: { singular: "calciatore", plural: "calciatori" },
  coach: { singular: "allenatore", plural: "allenatori" },
  staff: { singular: "profilo staff", plural: "profili staff" },
  agent: { singular: "agente", plural: "agenti" },
};

/** "82 calciatori trovati" / "1 calciatore trovato" / "148 profili trovati". */
export function formatResultsCount(
  count: number,
  role: SearchProfileRole | null,
): string {
  const noun = RESULTS_COUNT_NOUNS[role ?? "all"];
  const label = count === 1 ? noun.singular : noun.plural;
  const verb = count === 1 ? "trovato" : "trovati";
  return `${count} ${label} ${verb}`;
}
