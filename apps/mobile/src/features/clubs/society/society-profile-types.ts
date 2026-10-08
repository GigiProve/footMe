/**
 * Modello del Master Profile Società (REV-PROF-17).
 *
 * Una sola forma per Owner e Visitor: gli stessi dati pubblici, con un blocco
 * `viewer` che dice soltanto quali azioni sono permesse. Non esiste un campo
 * "privato" che il client debba ricordarsi di nascondere — il payload della
 * RPC non lo contiene affatto.
 */
import type { PlayerPosition } from "../../profiles/player-sports";

export type SocietyViewerMode = "owner" | "visitor";

export type SocietyViewer = {
  canManage: boolean;
  canManagePositions: boolean;
  canPublishMedia: boolean;
  isFollowing: boolean;
  mode: SocietyViewerMode;
  profileId: string | null;
};

export type SocietyClub = {
  category: string | null;
  city: string;
  clubColors: string | null;
  clubEmail: string | null;
  clubPhone: string | null;
  coverUrl: string | null;
  description: string | null;
  facebook: string | null;
  fieldAddress: string | null;
  foundingYear: number | null;
  headquartersAddress: string | null;
  id: string;
  instagram: string | null;
  logoUrl: string | null;
  name: string;
  ownerProfileId: string | null;
  province: string | null;
  region: string;
  stadium: string | null;
  verificationStatus: string;
  websiteUrl: string | null;
};

export type SocietyTeamSummary = {
  category: string | null;
  city: string | null;
  clubId: string;
  competitionName: string | null;
  coverUrl: string | null;
  id: string;
  logoUrl: string | null;
  name: string;
  region: string | null;
  season: string | null;
  sortOrder: number;
  teamType: "senior" | "youth";
  venueName: string | null;
};

export type SocietyAffiliate = {
  category: string | null;
  city: string | null;
  id: string;
  logoUrl: string | null;
  name: string;
  region: string | null;
  relationshipLabel: string | null;
};

export type SocietyPosition = {
  category: string | null;
  city: string | null;
  id: string;
  publishedAt: string | null;
  region: string | null;
  roleRequired: string;
  targetRole: string;
  teamId: string | null;
  teamName: string | null;
  teamType: "senior" | "youth";
  title: string;
};

export type SocietyMasterProfile = {
  affiliates: SocietyAffiliate[];
  club: SocietyClub;
  positions: SocietyPosition[];
  teams: SocietyTeamSummary[];
  viewer: SocietyViewer;
};

export type SocietyTeamMember = {
  avatarUrl: string | null;
  fullName: string;
  id: string;
  /** Un record manuale non è un profilo PROLINK: non è tappabile. */
  isLinked: boolean;
  primaryPosition: PlayerPosition | null;
  profileId: string | null;
  roleLabel: string | null;
};

export type SocietyTeamDetail = {
  club: Pick<SocietyClub, "id" | "logoUrl" | "name" | "ownerProfileId" | "verificationStatus">;
  squad: SocietyTeamMember[];
  staff: SocietyTeamMember[];
  team: SocietyTeamSummary & { venueName: string | null };
  viewer: SocietyViewer;
};
