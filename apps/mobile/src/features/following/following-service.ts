import { supabase } from "../../lib/supabase";
import { unfollowProfile } from "../profiles/fan-media-service";
import { unfollowClub } from "../clubs/club-service";

export type FollowedEntity = {
  kind: "profile" | "club";
  entity_id: string;
  name: string;
  role:
    | "player"
    | "coach"
    | "agent"
    | "staff"
    | "director"
    | "media"
    | "fan"
    | "club_admin"
    | "club";
  subtitle: string | null;
  avatar_url: string | null;
  followed_at: string;
};

export type FollowFilter =
  | "all"
  | "club"
  | "player"
  | "media"
  | "coach"
  | "agent";

export async function fetchFollowedProfiles(
  filter: FollowFilter,
  page: number,
  pageSize = 20,
): Promise<FollowedEntity[]> {
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("fetch_followed_profiles", {
    p_filter: filter,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as FollowedEntity[];
}

export async function fetchFollowingCount(): Promise<number> {
  const { data, error } = await supabase.rpc("fetch_following_count");

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
}

export function resolveFollowedHref(item: FollowedEntity): string {
  return item.kind === "club"
    ? `/club/${item.entity_id}`
    : `/profile/${item.entity_id}`;
}

export async function unfollowEntity(
  ownerId: string,
  item: FollowedEntity,
): Promise<void> {
  if (item.kind === "club") {
    await unfollowClub(ownerId, item.entity_id);
  } else {
    await unfollowProfile(ownerId, item.entity_id);
  }
}
