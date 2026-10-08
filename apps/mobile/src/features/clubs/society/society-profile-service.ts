/**
 * Accesso ai dati del Master Profile Società (REV-PROF-17).
 *
 * Due letture, due RPC: il profilo del club e il profilo della singola
 * squadra. Niente richieste a cascata sulle squadre, sull'organico o sulle
 * posizioni — il payload arriva già composto, e la visibilità l'ha già
 * applicata il database.
 */
import { supabase } from "../../../lib/supabase";
import { isPlayerPosition } from "../../profiles/player-sports";
import type {
  SocietyAffiliate,
  SocietyClub,
  SocietyMasterProfile,
  SocietyPosition,
  SocietyTeamDetail,
  SocietyTeamMember,
  SocietyTeamSummary,
  SocietyViewer,
} from "./society-profile-types";

type Json = Record<string, unknown>;

export async function fetchSocietyMasterProfile(
  clubId: string,
): Promise<SocietyMasterProfile | null> {
  const { data, error } = await supabase.rpc("fetch_society_master_profile", {
    p_club_id: clubId,
  });

  if (error) throw error;
  if (!data) return null;

  const payload = data as Json;
  const club = mapClub(asObject(payload.club));

  if (!club) return null;

  return {
    affiliates: asArray(payload.affiliates).map(mapAffiliate),
    club,
    positions: asArray(payload.positions).map(mapPosition),
    teams: asArray(payload.teams).map(mapTeam),
    viewer: mapViewer(asObject(payload.viewer)),
  };
}

export async function fetchSocietyTeamProfile(
  teamId: string,
): Promise<SocietyTeamDetail | null> {
  const { data, error } = await supabase.rpc("fetch_society_team_profile", {
    p_team_id: teamId,
  });

  if (error) throw error;
  if (!data) return null;

  const payload = data as Json;
  const teamRow = asObject(payload.team);
  const clubRow = asObject(payload.club);

  if (!teamRow.id || !clubRow.id) return null;

  return {
    club: {
      id: String(clubRow.id),
      logoUrl: asText(clubRow.logo_url),
      name: asText(clubRow.name) ?? "",
      ownerProfileId: asText(clubRow.owner_profile_id),
      verificationStatus: asText(clubRow.verification_status) ?? "unverified",
    },
    squad: asArray(payload.squad).map((row) => mapMember(row, "player")),
    staff: asArray(payload.staff).map((row) => mapMember(row, "staff")),
    team: mapTeam(teamRow),
    viewer: mapViewer(asObject(payload.viewer)),
  };
}

function mapClub(row: Json): SocietyClub | null {
  if (!row.id) return null;

  return {
    category: asText(row.category),
    city: asText(row.city) ?? "",
    clubColors: asText(row.club_colors),
    clubEmail: asText(row.club_email),
    clubPhone: asText(row.club_phone),
    coverUrl: asText(row.cover_url),
    description: asText(row.description),
    facebook: asText(row.facebook),
    fieldAddress: asText(row.field_address),
    foundingYear: asNumber(row.founding_year),
    headquartersAddress: asText(row.headquarters_address),
    id: String(row.id),
    instagram: asText(row.instagram),
    logoUrl: asText(row.logo_url),
    name: asText(row.name) ?? "",
    ownerProfileId: asText(row.owner_profile_id),
    province: asText(row.province),
    region: asText(row.region) ?? "",
    stadium: asText(row.stadium),
    verificationStatus: asText(row.verification_status) ?? "unverified",
    websiteUrl: asText(row.website_url),
  };
}

function mapTeam(row: Json): SocietyTeamSummary {
  return {
    category: asText(row.category),
    city: asText(row.city),
    clubId: String(row.club_id ?? ""),
    competitionName: asText(row.competition_name),
    coverUrl: asText(row.cover_url),
    id: String(row.id ?? ""),
    logoUrl: asText(row.logo_url),
    name: asText(row.name) ?? "",
    region: asText(row.region),
    season: asText(row.season),
    sortOrder: asNumber(row.sort_order) ?? 0,
    teamType: row.team_type === "youth" ? "youth" : "senior",
    venueName: asText(row.venue_name),
  };
}

function mapAffiliate(row: Json): SocietyAffiliate {
  return {
    category: asText(row.category),
    city: asText(row.city),
    id: String(row.id ?? ""),
    logoUrl: asText(row.logo_url),
    name: asText(row.name) ?? "",
    region: asText(row.region),
    relationshipLabel: asText(row.relationship_label),
  };
}

function mapPosition(row: Json): SocietyPosition {
  return {
    category: asText(row.category),
    city: asText(row.city),
    id: String(row.id ?? ""),
    publishedAt: asText(row.published_at),
    region: asText(row.region),
    roleRequired: asText(row.role_required) ?? "",
    targetRole: asText(row.target_role) ?? "player",
    teamId: asText(row.team_id),
    teamName: asText(row.team_name),
    teamType: row.team_type === "youth" ? "youth" : "senior",
    title: asText(row.title) ?? "",
  };
}

function mapMember(row: Json, kind: "player" | "staff"): SocietyTeamMember {
  const position = asText(row.primary_position);

  return {
    avatarUrl: asText(row.avatar_url),
    fullName: asText(row.full_name) ?? "",
    id: String(row.id ?? ""),
    isLinked: row.is_linked === true,
    primaryPosition:
      kind === "player" && position && isPlayerPosition(position)
        ? position
        : null,
    profileId: asText(row.profile_id),
    roleLabel: asText(row.role_label),
  };
}

/**
 * L'owner mode arriva dal backend, mai dal fatto che l'utente stia guardando
 * il proprio tab Profilo: il permesso è l'unica fonte.
 */
function mapViewer(row: Json): SocietyViewer {
  const canManage = row.can_manage === true;

  return {
    canManage,
    canManagePositions: row.can_manage_positions === true,
    canPublishMedia: row.can_publish_media === true,
    isFollowing: row.is_following === true,
    mode: canManage ? "owner" : "visitor",
    profileId: asText(row.profile_id),
  };
}

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function asArray(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(asObject) : [];
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
