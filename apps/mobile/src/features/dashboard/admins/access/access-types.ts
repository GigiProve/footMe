/**
 * Modello dell'accesso amministrativo di una persona (DAS-REV-14, §14–§23).
 *
 * Ruolo, Ambito e Ownership restano tre campi distinti, come §5 impone:
 * «Ruolo è il nome della responsabilità amministrativa; Permessi sono le
 * azioni consentite; Ambito è il perimetro delle attività legate ai Team.»
 * Nessun tipo qui li concatena in una stringa sola.
 */
import type { AreaLevel, AreaScopeKind } from "../../roles/roles-types";

export type AdminScopeMode = "society" | "teams";

/** Dettaglio di un accesso amministrativo (screen 06 e 11). */
export type AdminAccessDetail = {
  accessVerifiedAt: number;
  activatedAt: string | null;
  avatarUrl: string | null;
  canChangeRole: boolean;
  canChangeScope: boolean;
  canRevoke: boolean;
  /** Vero solo per l'Owner corrente su se stesso (§18). */
  canTransferOwner: boolean;
  canViewPermissions: boolean;
  fullName: string;
  isOwner: boolean;
  isSelf: boolean;
  membershipId: string | null;
  profileId: string;
  roleId: string | null;
  /** `false` per un accesso anteriore al catalogo ruoli: non ha un nome. */
  roleIsNamed: boolean;
  roleLabel: string;
  scopeLabel: string | null;
  scopeMode: AdminScopeMode;
  status: string;
  teamIds: string[];
  teamNames: string[];
  version: number;
};

/** Riga della vista «Visualizza permessi» (§14). */
export type AdminAreaPermission = {
  areaId: string;
  areaLabel: string;
  /** Etichette umane dei controlli attivi; vuoto quando il livello è none. */
  controlLabels: string[];
  level: AreaLevel;
  scopeKind: AreaScopeKind;
};

export type AdminEffectivePermissions = {
  areas: AdminAreaPermission[];
  catalogRevision: number;
  isOwner: boolean;
  scopeLabel: string | null;
  scopeMode: AdminScopeMode;
};

/** Squadra selezionabile come ambito (screen 08). */
export type ScopeTeam = {
  category: string | null;
  logoUrl: string | null;
  name: string;
  teamId: string;
  teamType: string | null;
};

export type ScopeDraft = {
  mode: AdminScopeMode;
  teamIds: string[];
};

export type SavedScope = {
  membershipId: string;
  scopeLabel: string | null;
  scopeMode: AdminScopeMode;
  teamIds: string[];
  version: number;
};

/** Stato canonico di un invito (DAS-REV-13 §18, riusato). */
export type AdminInviteState =
  | "accepted"
  | "expired"
  | "pending"
  | "rejected"
  | "revoked";

/** Dettaglio di un invito (screen 10). */
export type AdminInviteDetail = {
  avatarUrl: string | null;
  canCancel: boolean;
  createdAt: string | null;
  emailDisplay: string | null;
  expiresAt: string | null;
  fullName: string | null;
  inviteId: string;
  /** Presente solo nella race vinta dall'accept: la persona ora è attiva. */
  membershipProfileId: string | null;
  profileId: string | null;
  recipientKind: "member" | "email";
  revision: number;
  roleLabel: string;
  scopeLabel: string | null;
  state: AdminInviteState;
};

/** Candidato al trasferimento di ownership (screen 11). */
export type OwnerCandidate = {
  avatarUrl: string | null;
  fullName: string;
  profileId: string;
  roleLabel: string;
  scopeLabel: string | null;
};

/**
 * Configurazione operativa che il vecchio Owner conserva (screen 12).
 *
 * `required` è vero quando non ne ha già una valida: §20 chiede allora di
 * «richiedere un ruolo normale attivo e un ambito validi prima di permettere
 * il trasferimento», e il PNG rappresenta esattamente quel caso.
 */
export type OwnerLegacyConfig = {
  required: boolean;
  roleId: string | null;
  roleLabel: string | null;
  scopeLabel: string | null;
  scopeMode: AdminScopeMode;
  teamIds: string[];
};

export type OwnerTransferResult = {
  newOwnerId: string;
  ownershipVersion: number;
  previousOwnerId: string;
};
