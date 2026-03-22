export type MemberRole = "player" | "staff" | "coach" | "director";

export type MemberStatus = "active" | "rejected" | "removed";

export type AddedBy = "admin_manual" | "self_request" | "invite_link";

export type ClubMember = {
  added_by: AddedBy;
  avatar_url: string | null;
  club_id: string;
  created_at: string;
  full_name: string | null;
  id: string;
  manual_name: string | null;
  member_role: MemberRole;
  profile_id: string | null;
  staff_title: string | null;
  status: MemberStatus;
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
  body: string | null;
  created_at: string;
  data: Record<string, string>;
  id: string;
  is_read: boolean;
  recipient_profile_id: string;
  title: string;
  type: string;
};

export type ProfileSuggestion = {
  avatar_url: string | null;
  city: string | null;
  full_name: string;
  profile_id: string;
  region: string | null;
  role: string;
};
