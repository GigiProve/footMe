export type GlobalSearchGroupKey =
  | "societa"
  | "profilo"
  | "posizione"
  | "contenuto";

export type GlobalSearchTargetType =
  | "profile"
  | "club"
  | "club_team"
  | "recruiting_ad"
  | "club_media"
  | "fan_tribuna";

export type GlobalSearchRow = {
  group_key: GlobalSearchGroupKey;
  target_type: GlobalSearchTargetType;
  target_id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
};

/** Roles surfaced by the Cerca > Profili chips. */
export type SearchProfileRole = "player" | "coach" | "staff" | "agent";

export type ProfileSearchRow = {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  role: SearchProfileRole;
  region: string | null;
  city: string | null;
  primary_position: string | null;
  current_club_name: string | null;
  current_team_name: string | null;
  age: number | null;
  is_available: boolean | null;
};

/** Chip filter on Cerca > Società ("affiliate" filters clubs flagged as affiliated). */
export type SearchClubKind = "club" | "team" | "affiliate";

export type ClubSearchRow = {
  kind: "club" | "team";
  entity_id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  region: string | null;
  category: string | null;
  parent_club_name: string | null;
  is_affiliate: boolean;
};

/** Chip filter on Cerca > Posizioni aperte. */
export type SearchPositionTarget = "player" | "coach" | "staff";

export type PositionSearchRow = {
  ad_id: string;
  title: string;
  club_name: string;
  club_logo_url: string | null;
  team_name: string | null;
  category: string | null;
  region: string | null;
  target_role: SearchPositionTarget;
  deadline: string | null;
  published_at: string | null;
  is_saved: boolean;
};
