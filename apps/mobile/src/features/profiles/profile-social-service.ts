import { supabase } from "../../lib/supabase";

export type ProfileConnectionPreview = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ProfileSocialSummary = {
  followerCount: number;
  followingCount: number;
  mutualTotal: number;
  mutualPreview: ProfileConnectionPreview[];
};

export type ProfileConnectionListItem = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  roleLabel: string | null;
};

type RawMutualPreviewEntry = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type RawSocialSummaryRow = {
  follower_count: number | string | null;
  following_count: number | string | null;
  mutual_total: number | string | null;
  mutual_preview: RawMutualPreviewEntry[] | null;
};

type RawConnectionRow = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role_label: string | null;
};

function normalizeCount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMutualPreview(
  rows: RawMutualPreviewEntry[] | null | undefined,
): ProfileConnectionPreview[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name ?? "",
    avatarUrl: row.avatar_url ?? null,
  }));
}

function normalizeConnectionListItem(row: RawConnectionRow): ProfileConnectionListItem {
  return {
    profileId: row.profile_id,
    displayName: row.display_name ?? "",
    avatarUrl: row.avatar_url ?? null,
    roleLabel: row.role_label ?? null,
  };
}

export async function fetchProfileSocialSummary(
  profileId: string,
): Promise<ProfileSocialSummary> {
  const { data, error } = await supabase.rpc("fetch_profile_social_summary", {
    target_profile_id: profileId,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as RawSocialSummaryRow | null;

  return {
    followerCount: normalizeCount(row?.follower_count),
    followingCount: normalizeCount(row?.following_count),
    mutualTotal: normalizeCount(row?.mutual_total),
    mutualPreview: normalizeMutualPreview(row?.mutual_preview),
  };
}

export async function fetchProfileFollowers(
  profileId: string,
  opts: { limit: number; offset: number },
): Promise<ProfileConnectionListItem[]> {
  const { data, error } = await supabase.rpc("fetch_profile_followers", {
    target_profile_id: profileId,
    page_limit: opts.limit,
    page_offset: opts.offset,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawConnectionRow[]).map(normalizeConnectionListItem);
}

export async function fetchProfileMutualConnections(
  profileId: string,
  opts: { limit: number; offset: number },
): Promise<ProfileConnectionListItem[]> {
  const { data, error } = await supabase.rpc("fetch_profile_mutual_connections", {
    target_profile_id: profileId,
    page_limit: opts.limit,
    page_offset: opts.offset,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawConnectionRow[]).map(normalizeConnectionListItem);
}

export async function updateProfileCoverUrl(
  profileId: string,
  coverUrl: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ cover_url: coverUrl })
    .eq("id", profileId);

  if (error) {
    throw error;
  }
}

export async function updateProfileAvatarUrl(
  profileId: string,
  avatarUrl: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profileId);

  if (error) {
    throw error;
  }
}
