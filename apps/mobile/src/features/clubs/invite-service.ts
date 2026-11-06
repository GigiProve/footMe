/**
 * Link di invito riutilizzabili (`club_invite_links`).
 *
 * Due metà con sorti diverse dopo la rimozione dello schermo legacy
 * `/club-admin/invites`:
 *
 *   · **ricezione** — `joinClubViaInvite` è viva e serve la landing pubblica
 *     `app/invite/[token].tsx`, raggiungibile da deep link;
 *   · **generazione** — `fetchClubInviteLinks`, `createInviteLink`,
 *     `deactivateInviteLink` e `buildInviteUrl` non hanno più chiamanti: la
 *     loro unica UI era `InviteLinkModal`, montata solo da quello schermo, e
 *     nessun ingresso del prodotto ci portava più da DAS-REV-19.
 *
 * Restano perché il dominio è di **DAS-REV-20 — Inviti multipli tramite
 * link**, che le riuserà con una UI propria. Cancellarle qui significherebbe
 * smantellare un dominio che questa pulizia non possiede.
 */
import { supabase } from "../../lib/supabase";
import type { ClubInviteLink, MemberRole } from "./membership-types";

export async function fetchClubInviteLinks(
  clubId: string,
): Promise<ClubInviteLink[]> {
  const { data, error } = await supabase
    .from("club_invite_links")
    .select("id, club_id, token, member_role, expires_at, is_active, created_at")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClubInviteLink[];
}

export async function createInviteLink(input: {
  clubId: string;
  createdBy: string;
  memberRole: MemberRole;
}): Promise<ClubInviteLink> {
  const { data, error } = await supabase
    .from("club_invite_links")
    .insert({
      club_id: input.clubId,
      created_by: input.createdBy,
      member_role: input.memberRole,
    })
    .select("id, club_id, token, member_role, expires_at, is_active, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as ClubInviteLink;
}

export async function deactivateInviteLink(linkId: string) {
  const { error } = await supabase
    .from("club_invite_links")
    .update({ is_active: false })
    .eq("id", linkId);

  if (error) {
    throw error;
  }
}

export async function joinClubViaInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_club_via_invite", {
    invite_token: token,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export function buildInviteUrl(token: string): string {
  return `footme://invite/${token}`;
}
