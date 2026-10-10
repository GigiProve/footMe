/**
 * Accesso ai dati del Dettaglio operativo Squadra (DAS-REV-09).
 *
 * Due letture indipendenti, come il backend (§24, §25): la base della pagina
 * e le Posizioni. Il secondo provider esiste perché il master 06 mostra
 * **solo** Posizioni in errore mentre il resto resta utilizzabile — con una
 * sola richiesta quello stato sarebbe una finzione del client.
 *
 * Nessuna regola di dominio vive qui: capability, perimetro, stagione,
 * normalizzazione dello stato "attiva" e aggregati sono decisi dal server.
 * Questo file traduce righe in tipi e errori in codici.
 */
import { supabase } from "../../../lib/supabase";
import { toTeamError, type TeamOperationError } from "../teams-service";

/**
 * Riferimento avatar dell'anteprima Organico (§11, §25).
 *
 * Il backend non restituisce il nome: le iniziali bastano al fallback del
 * design system e §29 chiede che gli avatar decorativi non espongano dati
 * non necessari.
 */
export type TeamRosterAvatar = {
  avatarUrl: string | null;
  id: string;
  initials: string;
};

export type TeamDetailPayload = {
  accessVerifiedAt: number;
  applicationsCount: number | null;
  applicationsNewCount: number | null;
  canCreatePositions: boolean;
  canEdit: boolean;
  canManageInvites: boolean;
  canManageRoster: boolean;
  canViewApplications: boolean;
  canViewInvites: boolean;
  canViewPositions: boolean;
  canViewRoster: boolean;
  city: string | null;
  cityInherited: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  crestInherited: boolean;
  crestUrl: string | null;
  dataRevision: number;
  groupConversationId: string | null;
  groupMemberCount: number | null;
  groupTitle: string | null;
  /** `false` finché il dominio Messaggi non conosce le squadre (§17). */
  groupSupported: boolean;
  hasSeasonConfig: boolean;
  invitesPendingCount: number | null;
  isArchived: boolean;
  isOwner: boolean;
  levelId: string | null;
  levelLabel: string | null;
  name: string;
  rosterAvatars: TeamRosterAvatar[];
  /** `null` = non consultabile. Mai convertito in zero (§25). */
  rosterPlayersCount: number | null;
  rosterStaffCount: number | null;
  seasonId: string | null;
  seasonLabel: string | null;
  teamId: string;
  typeId: string | null;
  typeLabel: string | null;
};

export type TeamPositionPreview = {
  id: string;
  targetRole: string | null;
  title: string;
};

export type TeamPositionsPayload = {
  /** `null` = non consultabile o non caricato; zero è un valore diverso. */
  activeCount: number | null;
  canCreate: boolean;
  canView: boolean;
  items: TeamPositionPreview[];
};

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function rows(value: unknown): RawRecord[] {
  return Array.isArray(value) ? (value as RawRecord[]) : [];
}

export async function fetchTeamDetail(
  teamId: string,
): Promise<TeamDetailPayload> {
  const { data, error } = await supabase
    .rpc("fetch_team_detail", { p_team_id: teamId })
    .maybeSingle();

  if (error) throw toTeamError(error);

  if (!data) {
    // Una risposta vuota su una risorsa che la RPC non ha rifiutato è
    // comunque "non più disponibile": §27 vuole un esito neutro, non una
    // pagina a metà costruita su campi nulli.
    throw toTeamError(new Error("TEAM_NOT_FOUND"));
  }

  const row = data as RawRecord;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    applicationsCount: count(row.applications_count),
    applicationsNewCount: count(row.applications_new_count),
    canCreatePositions: row.can_create_positions === true,
    canEdit: row.can_edit === true,
    canManageInvites: row.can_manage_invites === true,
    canManageRoster: row.can_manage_roster === true,
    canViewApplications: row.can_view_applications === true,
    canViewInvites: row.can_view_invites === true,
    canViewPositions: row.can_view_positions === true,
    canViewRoster: row.can_view_roster === true,
    city: text(row.city),
    cityInherited: row.city_inherited === true,
    clubId: String(row.club_id ?? ""),
    clubIsVerified: row.club_is_verified === true,
    clubLogoUrl: text(row.club_logo_url),
    clubName: String(row.club_name ?? ""),
    crestInherited: row.crest_inherited === true,
    crestUrl: text(row.crest_url),
    dataRevision: Number(row.data_revision ?? 0),
    groupConversationId: text(row.group_conversation_id),
    groupMemberCount: count(row.group_member_count),
    groupSupported: row.group_supported === true,
    groupTitle: text(row.group_title),
    hasSeasonConfig: row.has_season_config === true,
    invitesPendingCount: count(row.invites_pending_count),
    isArchived: row.is_archived === true,
    isOwner: row.is_owner === true,
    levelId: text(row.level_id),
    levelLabel: text(row.level_label),
    name: String(row.name ?? ""),
    rosterAvatars: rows(row.roster_avatars).map((avatar) => ({
      avatarUrl: text(avatar.avatar_url),
      id: String(avatar.id ?? ""),
      initials: String(avatar.initials ?? ""),
    })),
    rosterPlayersCount: count(row.roster_players_count),
    rosterStaffCount: count(row.roster_staff_count),
    seasonId: text(row.season_id),
    seasonLabel: text(row.season_label),
    teamId: String(row.team_id ?? teamId),
    typeId: text(row.type_id),
    typeLabel: text(row.type_label),
  };
}

export async function fetchTeamPositionsPreview(
  teamId: string,
): Promise<TeamPositionsPayload> {
  const { data, error } = await supabase
    .rpc("fetch_team_positions_preview", { p_team_id: teamId })
    .maybeSingle();

  if (error) throw toTeamError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    activeCount: count(row.active_count),
    canCreate: row.can_create === true,
    canView: row.can_view === true,
    items: rows(row.items).map((item) => ({
      id: String(item.id ?? ""),
      targetRole: text(item.target_role),
      title: String(item.title ?? ""),
    })),
  };
}

export type { TeamOperationError };
