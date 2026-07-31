import { COACH_PRIMARY_ROLE_OPTIONS } from "../../onboarding/coach/CoachRoleStep";
import { STAFF_ROLE_OPTIONS } from "../../onboarding/onboarding-types";
import {
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../profiles/player-sports";
import type { PositionSearchRow, PositionSort, SearchPositionTarget } from "../search-types";
import type { GeoMode, PositionsSearchCriteria } from "./positions-search-types";

export const TARGET_OPTIONS: { label: string; value: SearchPositionTarget }[] = [
  { label: "Calciatore", value: "player" },
  { label: "Allenatore", value: "coach" },
  { label: "Staff", value: "staff" },
];

export function targetLabel(target: SearchPositionTarget): string {
  return TARGET_OPTIONS.find((option) => option.value === target)?.label ?? "";
}

/** The role is the most visible element of a preview (spec section 5). */
export function roleHeadline(row: PositionSearchRow): string {
  if (row.target_role === "player" && row.role_required) {
    return getPlayerPositionLabel(row.role_required as PlayerPosition, row.title);
  }
  return row.title;
}

/** e.g. "Prima squadra · AC Como" — the team must always be clear. */
export function teamMetaLine(row: PositionSearchRow): string {
  return [row.team_name, row.club_name].filter(Boolean).join(" · ");
}

/** e.g. "Serie D · Como, Lombardia". */
export function locationMetaLine(row: PositionSearchRow): string {
  const place = [row.city, row.region].filter(Boolean).join(", ");
  return [row.category, place].filter(Boolean).join(" · ");
}

/** Only shown when a distance is available (Vicino a me mode). */
export function distanceLabel(distanceKm: number | null): string | null {
  if (distanceKm == null) {
    return null;
  }
  return `${Math.round(distanceKm)} km da te`;
}

export function coachStaffRoleOptions(
  target: SearchPositionTarget,
): { label: string; value: string }[] {
  if (target === "coach") {
    return COACH_PRIMARY_ROLE_OPTIONS;
  }
  if (target === "staff") {
    return STAFF_ROLE_OPTIONS;
  }
  return [];
}

/** Light role summary for the "Per te" / "Esplora" recap. No scores. */
export function roleSummaryLabel(criteria: PositionsSearchCriteria): string {
  if (criteria.target === "player") {
    const primary = criteria.primaryPositions[0];
    return primary ? getPlayerPositionLabel(primary) : "Tutti i ruoli";
  }
  return criteria.coachStaffRole ?? targetLabel(criteria.target);
}

/** Light area summary for the recap, driven by the active geo mode. */
export function areaSummaryLabel(criteria: PositionsSearchCriteria): string {
  switch (criteria.geoMode) {
    case "italy":
      return "Tutta Italia";
    case "near_me":
      return criteria.nearMe
        ? [criteria.nearMe.label ?? "Vicino a me", `entro ${criteria.nearMe.radiusKm} km`].join(
            " · ",
          )
        : "Vicino a me";
    case "regions":
      return criteria.regions.length > 0 ? criteria.regions.join(" · ") : "Nessuna regione";
    case "provinces":
      return criteria.provinces.length > 0 ? criteria.provinces.join(" · ") : "Nessuna provincia";
    case "profile": {
      const areas =
        criteria.profileProvinces.length > 0
          ? criteria.profileProvinces
          : criteria.profileRegions;
      return areas.length > 0 ? areas.join(" · ") : "Aree del profilo";
    }
    default:
      return "";
  }
}

/**
 * Stable area label for the "Per te" recap. Per te is always profile-seeded
 * (it ignores the mutable Esplora geo edits), so it shows the profile areas.
 */
export function profileAreaLabel(criteria: PositionsSearchCriteria): string {
  const areas =
    criteria.profileProvinces.length > 0
      ? criteria.profileProvinces
      : criteria.profileRegions;
  return areas.length > 0 ? areas.join(" · ") : "Tutta Italia";
}

export const GEO_MODE_META: {
  mode: GeoMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    mode: "profile",
    label: "Aree del mio profilo",
    description: "Usa le zone già indicate nella tua disponibilità",
    icon: "person-outline",
  },
  {
    mode: "near_me",
    label: "Vicino a me",
    description: "Usa la tua posizione attuale e un raggio in km",
    icon: "location-outline",
  },
  {
    mode: "provinces",
    label: "Province specifiche",
    description: "Scegli una o più province",
    icon: "map-outline",
  },
  {
    mode: "regions",
    label: "Regioni specifiche",
    description: "Scegli una o più regioni",
    icon: "grid-outline",
  },
  {
    mode: "italy",
    label: "Tutta Italia",
    description: "Nessun limite geografico",
    icon: "flag-outline",
  },
];

/** Sort options depend on the active geo mode (spec section 18). */
export function sortOptionsFor(geoMode: GeoMode): { label: string; value: PositionSort }[] {
  if (geoMode === "near_me") {
    return [
      { label: "Più vicine a te", value: "vicinanza" },
      { label: "Più pertinenti", value: "pertinenza" },
      { label: "Pubblicate di recente", value: "recenti" },
    ];
  }
  return [
    { label: "Più pertinenti", value: "pertinenza" },
    { label: "Pubblicate di recente", value: "recenti" },
    { label: "Categoria", value: "categoria" },
    { label: "Località", value: "localita" },
  ];
}

export function defaultSortFor(geoMode: GeoMode): PositionSort {
  return geoMode === "near_me" ? "vicinanza" : "pertinenza";
}
