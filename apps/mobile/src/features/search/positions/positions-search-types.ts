import type { PlayerPosition } from "../../profiles/player-sports";
import type { PositionSort, SearchPositionTarget } from "../search-types";

export type DiscoveryTab = "perte" | "esplora" | "salvate";

/** Mutually-exclusive geographic modes; exactly one is active at a time. */
export type GeoMode = "profile" | "near_me" | "provinces" | "regions" | "italy";

export type NearMeSelection = {
  lat: number;
  lng: number;
  /** Reverse-geocoded city name for the "Posizione rilevata" label. */
  label: string | null;
  radiusKm: number;
};

/**
 * The full discovery search state, shared across the Per te / Esplora tabs and
 * the Modifica ricerca / geo / filtri modals via PositionsSearchProvider.
 * Seeded from the signed-in profile (see positions-service.fetchPositionsSeed).
 */
export type PositionsSearchCriteria = {
  target: SearchPositionTarget;
  /** Players only: primary role(s). */
  primaryPositions: PlayerPosition[];
  /** Players only: compatible roles, applied when useCompatible is on. */
  compatiblePositions: PlayerPosition[];
  useCompatible: boolean;
  /** Coach/staff role (display + summary only; ads carry no structured role). */
  coachStaffRole: string | null;
  geoMode: GeoMode;
  /** Areas indicated on the profile — baseline for the "Aree del mio profilo" mode. */
  profileRegions: string[];
  profileProvinces: string[];
  /** User-edited selections for the Regioni / Province modes. */
  regions: string[];
  provinces: string[];
  nearMe: NearMeSelection | null;
  categories: string[];
  teamType: "senior" | "youth" | null;
  clubId: string | null;
  sort: PositionSort;
};

export const DEFAULT_RADIUS_KM = 50;
export const RADIUS_OPTIONS = [25, 50, 100, 200] as const;
