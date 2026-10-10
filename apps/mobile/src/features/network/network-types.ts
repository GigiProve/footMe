/**
 * Modello della Rete societaria (DAS-REV-11).
 *
 * I tipi rispecchiano il contratto canonico del database e nient'altro: §25
 * vieta «stringhe italiane come chiavi di dominio», quindi gli identificativi
 * sono slug e le etichette arrivano dal catalogo già pronte da rendere.
 *
 * Un solo `RelationshipView` serve elenco, richieste, dettaglio e storico:
 * §6 vuole «un solo dominio di relazione» e due tipi diversi sarebbero già
 * due dominî.
 */

export type RelationshipStatus =
  | "pending"
  | "active"
  | "rejected"
  | "cancelled"
  | "ended";

export type RelationshipAction = "accept" | "reject" | "cancel" | "end";

export type InviteState = "valid" | "resolved" | "expired" | "revoked";

export type SocietySummary = {
  city: string | null;
  clubId: string;
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  /** Sigla provincia: la riga del mockup legge "Cantù, CO". */
  province: string | null;
  region: string | null;
};

export type RelationshipType = {
  activeTemplate: string;
  description: string | null;
  draftTemplate: string;
  exclusivityGroup: string | null;
  id: string;
  isDirectional: boolean;
  isSelectable: boolean;
  label: string;
  proposalTemplate: string;
  roleASection: string | null;
  roleAId: string | null;
  roleALabel: string | null;
  roleBSection: string | null;
  roleBId: string | null;
  roleBLabel: string | null;
  rowTemplateA: string | null;
  rowTemplateB: string | null;
  rowTemplateSymmetric: string | null;
  sortOrder: number;
  symmetricSection: string | null;
};

/**
 * La relazione vista da una Società (§7).
 *
 * `groupLabel`, `rowLabel` e le tre frasi arrivano già risolte dal backend:
 * §7 chiede che «il renderer riceva metadata sufficienti dal backend» e non
 * indovini la semantica da source/target.
 */
export type RelationshipView = {
  acceptedAt: string | null;
  activeSentence: string | null;
  allowedActions: RelationshipAction[];
  cancelledAt: string | null;
  clubA: SocietySummary;
  clubB: SocietySummary;
  counterpart: SocietySummary;
  counterpartRoleId: string | null;
  counterpartRoleLabel: string | null;
  draftSentence: string | null;
  endedAt: string | null;
  endedByClubId: string | null;
  groupLabel: string | null;
  groupSort: number;
  isDirectional: boolean;
  isPublic: boolean;
  isRequester: boolean;
  proposalSentence: string | null;
  recipientClubId: string;
  rejectedAt: string | null;
  relationshipId: string;
  requestedAt: string | null;
  requesterClubId: string;
  rowLabel: string | null;
  status: RelationshipStatus;
  typeDescription: string | null;
  typeId: string;
  typeLabel: string;
  version: number;
  viewerClubId: string;
  viewerRoleId: string | null;
  viewerRoleLabel: string | null;
  viewerSide: "a" | "b";
};

export type NetworkHeader = {
  accessVerifiedAt: number;
  /** `null` = non consultabile. Mai convertito in zero (§8). */
  activeRelationshipCount: number | null;
  capabilities: NetworkCapability[];
  city: string | null;
  clubId: string;
  dataRevision: number;
  distinctSocietyCount: number | null;
  historyCount: number | null;
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  openInvitesCount: number | null;
  province: string | null;
  region: string | null;
  requestsReceivedCount: number | null;
  requestsSentCount: number | null;
};

export const NETWORK_CAPABILITIES = [
  "network_view",
  "network_requests_view",
  "network_request_send",
  "network_request_manage",
  "network_request_cancel",
  "network_invite_create",
  "network_terminate",
  "network_history_view",
] as const;

export type NetworkCapability = (typeof NETWORK_CAPABILITIES)[number];

export type NetworkListPage = {
  items: RelationshipView[];
  nextCursor: string | null;
};

export type PendingInviteItem = {
  createdAt: string;
  descriptiveName: string | null;
  expiresAt: string;
  inviteId: string;
  inviterRoleId: string | null;
  isDirectional: boolean;
  state: InviteState;
  typeId: string;
  typeLabel: string;
  version: number;
};

export type NetworkRequestItem =
  | { kind: "received"; relationship: RelationshipView }
  | { kind: "sent"; relationship: RelationshipView }
  | { kind: "invite"; invite: PendingInviteItem };

export type NetworkRequestsPage = {
  items: NetworkRequestItem[];
  nextCursor: string | null;
};

/** §10: l'eligibility è per tipo, non un booleano "già collegata". */
export type LinkEligibility = {
  availableTypeIds: string[];
  blockingTypeIds: string[];
  relationshipId: string | null;
  /** Dati di visualizzazione canonici: una riga, una sola fonte (§10). */
  society: SocietySummary | null;
  state: "eligible" | "linked" | "pending" | "self";
  targetClubId: string;
};

export type IssuedInvite = {
  expiresAt: string;
  inviteId: string;
  state: InviteState;
  /** Disponibile solo alla creazione o a una rigenerazione esplicita (§17). */
  token: string | null;
  version: number;
};

export type InvitePublicContext =
  | { state: "invalid" | "expired" | "revoked" | "unavailable" }
  | {
      inviter: Omit<SocietySummary, "clubId"> & { clubId?: string };
      state: "valid";
      typeId: string;
      typeLabel: string;
    };

export type InviteResolveContext =
  | { state: "invalid" | "expired" | "revoked" | "unavailable" }
  | { clubId: string; relationshipId: string | null; state: "resolved" }
  | {
      descriptiveName: string | null;
      eligibleSocieties: EligibleSociety[];
      inviter: SocietySummary;
      isDirectional: boolean;
      state: "valid";
      typeId: string;
      typeLabel: string;
    };

export type EligibleSociety = SocietySummary & {
  /** Un collegamento incompatibile esiste già fra le due società (§19). */
  blocked: boolean;
  isSelf: boolean;
};
