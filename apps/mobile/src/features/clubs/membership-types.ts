export type MemberRole = "player" | "staff" | "coach" | "director";

export type MemberStatus = "pending" | "active" | "rejected" | "removed";

export type AddedBy = "admin_manual" | "self_request" | "invite_link";

export type ClubMember = {
  added_by: AddedBy;
  avatar_url: string | null;
  club_id: string;
  created_at: string;
  full_name: string | null;
  id: string;
  is_current: boolean;
  manual_name: string | null;
  member_role: MemberRole;
  profile_id: string | null;
  season: string | null;
  staff_title: string | null;
  status: MemberStatus;
  team_id: string | null;
};

export type ClubInviteLink = {
  club_id: string;
  created_at: string;
  expires_at: string;
  id: string;
  is_active: boolean;
  member_role: MemberRole;
  token: string;
};

export type AppNotification = {
  /**
   * DAS-REV-31 §23–§24: chiave logica del gruppo (destinatario + Società +
   * evento + tipo + finestra), null per le righe non aggregate.
   */
  aggregate_key: string | null;
  body: string | null;
  category?: string;
  created_at: string;
  /**
   * Payload jsonb. I valori sono per lo più stringhe; le notifiche
   * aggregate della 31 portano anche numeri e `preview_names: string[]`,
   * letti con i parser difensivi di `notifications-helpers`.
   */
  data: Record<string, string>;
  id: string;
  is_read: boolean;
  recipient_profile_id: string;
  /**
   * DAS-REV-31 §24: cresce a ogni nuova risposta nel gruppo. `mark read`
   * cita la revisione vista, così una risposta arrivata nel frattempo non
   * viene marcata letta per errore.
   */
  revision: number;
  title: string;
  type: string;
  /** DAS-REV-31: ultimo aggiornamento della riga (= created_at se non aggregata). */
  updated_at: string;
};

export type ProfileSuggestion = {
  avatar_url: string | null;
  city: string | null;
  full_name: string;
  profile_id: string;
  region: string | null;
  role: string;
};
