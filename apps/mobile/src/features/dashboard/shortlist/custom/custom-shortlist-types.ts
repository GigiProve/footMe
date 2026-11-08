/**
 * Tipi del governo delle Liste personalizzate (DAS-REV-27 §7, §9, §13, §19).
 *
 * Specchio dei read model di 20261107090000: ogni campo arriva dal server
 * già autorizzato. Il conteggio delle condivisioni esiste solo per l'owner
 * (`sharedCount: null` per un collaboratore, §9), e il recupero non porta
 * mai profili, count o ACL (§19).
 */

/** 'scope' = lista storica: persone autorizzate dell'ambito (§25). */
export type CustomAccessMode = "owner_only" | "shared" | "scope";

/** Le due scelte esplicite del form accessi (§10, §13). */
export type AccessChoice = "owner_only" | "shared";

export type CustomShortlistDetail = {
  accessMode: CustomAccessMode;
  accessVerifiedAt: string;
  canDelete: boolean;
  canEdit: boolean;
  canManageAccess: boolean;
  clubId: string;
  description: string | null;
  isOwner: boolean;
  name: string;
  scopeLabel: string;
  sharedCount: number | null;
  shortlistId: string;
  teamId: string | null;
  version: number;
};

/** Persona interna della Società: riferimento organizzativo, mai email (§11). */
export type ShortlistPerson = {
  avatarUrl: string | null;
  fullName: string;
  profileId: string;
  roleLabel: string | null;
};

export type CustomShortlistAccess = {
  accessMode: CustomAccessMode;
  name: string;
  owner: ShortlistPerson | null;
  scopeLabel: string;
  shared: ShortlistPerson[];
  shortlistId: string;
  teamId: string | null;
  version: number;
};

export type PeoplePage = {
  items: ShortlistPerson[];
  nextCursor: string | null;
};

export type AccessUpdateOutcome = {
  accessMode: CustomAccessMode;
  replayed: boolean;
  sharedCount: number;
  version: number;
};

export type ScopePreview = {
  /** 'named' = owner, che conosce le ACL; 'generic' = gestore senza ACL (§14). */
  kind: "named" | "generic" | "none";
  losing: { fullName: string; profileId: string }[] | null;
  ownerValid: boolean;
};

export type ListPatch = {
  description?: string | null;
  name?: string;
  team_id?: string | null;
};

export type ListUpdateOutcome = {
  accessMode: CustomAccessMode;
  description: string | null;
  name: string;
  replayed: boolean;
  scopeLabel: string;
  teamId: string | null;
  version: number;
};

export type RecoverableList = {
  name: string;
  scopeLabel: string;
  shortlistId: string;
};

export type RecoverablePage = {
  items: RecoverableList[];
  nextCursor: string | null;
};

export type RecoveryDetail = {
  name: string;
  scopeLabel: string;
  shortlistId: string;
  version: number;
};

export type OwnerReassignOutcome = {
  accessMode: CustomAccessMode;
  actorIsOwner: boolean;
  ownerName: string;
  replayed: boolean;
  version: number;
};
