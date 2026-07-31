import { supabase } from "../../../lib/supabase";
import type { PlayerPosition } from "../../profiles/player-sports";
import type { SearchPositionTarget } from "../search-types";
import { defaultSortFor } from "./positions-labels";
import type { GeoMode, PositionsSearchCriteria } from "./positions-search-types";

function resolveTarget(role: string | null | undefined): SearchPositionTarget {
  return role === "coach" || role === "staff" ? role : "player";
}

type AvailabilityShape = {
  availability_type: string | null;
  regions: string[];
  provinces: string[];
};

/**
 * Split the profile's availability into the exactly-one area bucket used by
 * the "Aree del mio profilo" mode, plus the matching default geo mode.
 */
function resolveAreas(availability: AvailabilityShape): {
  geoMode: GeoMode;
  profileRegions: string[];
  profileProvinces: string[];
} {
  const type = availability.availability_type;
  if (type === "PROVINCES" && availability.provinces.length > 0) {
    return { geoMode: "profile", profileRegions: [], profileProvinces: availability.provinces };
  }
  if (type === "REGIONS" && availability.regions.length > 0) {
    return { geoMode: "profile", profileRegions: availability.regions, profileProvinces: [] };
  }
  // "ITALY" or nothing usable on the profile.
  return { geoMode: "italy", profileRegions: [], profileProvinces: [] };
}

async function fetchAvailability(
  target: SearchPositionTarget,
  profileId: string,
): Promise<{
  availability: AvailabilityShape;
  primaryPositions: PlayerPosition[];
  compatiblePositions: PlayerPosition[];
  coachStaffRole: string | null;
}> {
  if (target === "player") {
    const { data } = await supabase
      .from("player_profiles")
      .select(
        "primary_position, secondary_positions, availability_type, transfer_regions, transfer_provinces",
      )
      .eq("profile_id", profileId)
      .maybeSingle();
    return {
      availability: {
        availability_type: (data?.availability_type as string | null) ?? null,
        regions: (data?.transfer_regions as string[] | null) ?? [],
        provinces: (data?.transfer_provinces as string[] | null) ?? [],
      },
      primaryPositions: data?.primary_position
        ? [data.primary_position as PlayerPosition]
        : [],
      compatiblePositions: (data?.secondary_positions as PlayerPosition[] | null) ?? [],
      coachStaffRole: null,
    };
  }

  const table = target === "coach" ? "coach_profiles" : "staff_profiles";
  const roleColumn = target === "coach" ? "primary_role" : "primary_staff_role";
  const { data } = await supabase
    .from(table)
    .select(
      `${roleColumn}, availability_type, preferred_regions, preferred_provinces`,
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  const record = (data ?? null) as Record<string, unknown> | null;

  return {
    availability: {
      availability_type: (record?.availability_type as string | null) ?? null,
      regions: (record?.preferred_regions as string[] | null) ?? [],
      provinces: (record?.preferred_provinces as string[] | null) ?? [],
    },
    primaryPositions: [],
    compatiblePositions: [],
    coachStaffRole: (record?.[roleColumn] as string | null) ?? null,
  };
}

/**
 * Seed the discovery criteria from the signed-in profile so "Posizioni per te"
 * opens with useful results and no form. Never throws — falls back to a
 * sensible all-Italy default if the role row is missing.
 */
export async function fetchPositionsSeed(
  profileId: string,
  role: string | null,
): Promise<PositionsSearchCriteria> {
  const target = resolveTarget(role);

  let seed: Awaited<ReturnType<typeof fetchAvailability>>;
  try {
    seed = await fetchAvailability(target, profileId);
  } catch {
    seed = {
      availability: { availability_type: null, regions: [], provinces: [] },
      primaryPositions: [],
      compatiblePositions: [],
      coachStaffRole: null,
    };
  }

  const { geoMode, profileRegions, profileProvinces } = resolveAreas(seed.availability);

  return {
    target,
    primaryPositions: seed.primaryPositions,
    compatiblePositions: seed.compatiblePositions,
    useCompatible: seed.compatiblePositions.length > 0,
    coachStaffRole: seed.coachStaffRole,
    geoMode,
    profileRegions,
    profileProvinces,
    // Pre-fill the Regioni / Province modes with the profile areas.
    regions: profileRegions,
    provinces: profileProvinces,
    nearMe: null,
    categories: [],
    teamType: null,
    clubId: null,
    sort: defaultSortFor(geoMode),
  };
}
