/**
 * Tipi del dominio Blocca / Sblocca Profilo (HOM-12 §1–§2, §29–§33, §80–§84, §141–§150).
 *
 * Il Block è identity-to-identity: PERSON, SOCIETY o MEDIA (§1), mai l'account (§3–§6).
 * Le forme sono 1:1 con le RPC di `20261127090000_home_block_identities.sql`
 * (contratto §4); il ponte snake_case → camelCase sta in `blocking-service.ts`.
 */

export type BlockIdentityType = "person" | "society" | "media";

/** Un'identità senza dati di presentazione. */
export type BlockIdentityRef = {
  type: BlockIdentityType;
  id: string;
};

/** Dove nasce l'azione: serve solo agli eventi (§250), mai al server. */
export type BlockSurface = "profile" | "chat" | "settings";

export type BlockStatus =
  | "blocked"
  | "already_blocked"
  | "not_allowed"
  | "target_unavailable"
  | "invalid";

export type UnblockStatus = "unblocked" | "not_blocked" | "not_allowed";

export type BlockResult = {
  status: BlockStatus;
  blockId: string | null;
};

/** §82–§84: il lato bloccato non si distingue mai da un profilo inesistente. */
export type ProfileAvailabilityState = "available" | "blocked_by_me" | "unavailable";

export type ProfileAvailability = {
  state: ProfileAvailabilityState;
  blockId: string | null;
  /** Solo con `blocked_by_me`: l'identità che ha creato il Block (§33). */
  blocker: BlockIdentityRef | null;
  /** Il server può non mandarlo: chi chiama ha un ripiego neutro. */
  name: string | null;
};

/** Una riga di «Profili bloccati» (§143–§147). */
export type BlockedIdentity = {
  blockId: string;
  identityType: BlockIdentityType;
  identityId: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  subtitle: string | null;
  blockerType: BlockIdentityType;
  blockerId: string;
  blockedAt: string;
};

export type BlockedIdentitiesPage = {
  items: BlockedIdentity[];
  /** Cursore keyset opaco (§149–§150); `null` = ultima pagina. */
  nextCursor: Record<string, unknown> | null;
};

/** Una fase della cella nello store di sessione. */
export type BlockPhase = "blocked" | "unblocked" | "pending_block" | "pending_unblock";

export type BlockEntry = {
  phase: BlockPhase;
  blockId: string | null;
  /** Istante (ms) della conoscenza server riflessa; 0 = nessuno. */
  at: number;
  /** Tentativo in volo, per scartare le risposte di un tentativo superato. */
  attempt: number;
  /** Fase prima del tentativo in volo: serve al rollback (§199, §203). */
  previous: "blocked" | "unblocked" | null;
};
