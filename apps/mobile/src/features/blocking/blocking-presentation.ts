/**
 * Derivazioni pure e copy di Blocca / Sblocca (HOM-12 §14–§15, §22–§28, §80–§113,
 * §141–§151, §241–§249). Tutto qui è testabile senza renderizzare.
 *
 * Il copy è quello della specifica, parola per parola. Mai: «Sei stato bloccato»,
 * «X ti ha bloccato», «Profilo ufficiale» (§84, §232). Il lato bloccato è sempre
 * neutro (§82): nessuna di queste funzioni distingue «bloccato da» da «inesistente».
 */

import type {
  BlockEntry,
  BlockIdentityRef,
  BlockIdentityType,
  BlockedIdentity,
} from "./blocking-types";

export const BLOCK_COPY = {
  blockError: "Non è stato possibile bloccare questo profilo. Riprova.", // §200
  blockedByMeBody:
    "Sbloccalo per visualizzare nuovamente il profilo e riprendere le interazioni.", // §80
  blockedByMeTitle: "Hai bloccato questo profilo", // §80
  blockedChatNotice: "Non puoi inviare messaggi a questo profilo.", // §106, §112
  cancel: "Annulla", // §24
  confirm: "Blocca", // §24
  confirmBody:
    "Non potrete più trovarvi, scrivervi o interagire direttamente su PROLINK finché il blocco sarà attivo.", // §24
  emptyBody: "I profili che blocchi compariranno qui.", // §151
  emptyTitle: "Nessun profilo bloccato", // §151
  listError: "Non è stato possibile caricare i profili bloccati. Riprova.",
  listTitle: "Profili bloccati", // §141
  privacySection: "Privacy e sicurezza", // §141
  privacySectionDescription: "Gestisci chi non può trovarti né scriverti",
  retry: "Riprova",
  unavailableBody: "Questo profilo non è disponibile.", // §83
  unavailableTitle: "Profilo non disponibile", // §83
  unblock: "Sblocca", // §80, §99
  unblockError: "Non è stato possibile sbloccare questo profilo. Riprova.", // §204
  unblockedFallback: "Il profilo è stato sbloccato",
} as const;

/** Attesa per il passaggio ActionSheet → BottomSheet (due Modal non si sovrappongono su iOS). */
export const SHEET_HANDOFF_MS = 300;

/** Nome mostrabile: mai vuoto (un nome mancante non rompe il copy). */
function displayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "questo profilo";
}

/** §15, §241: la voce del menu profilo. */
export function blockMenuLabel(name: string | null | undefined): string {
  return `Blocca ${displayName(name)}`;
}

export function blockMenuSubtitle(): string {
  return "Non potrete trovarvi né scrivervi.";
}

/** §24: titolo della conferma. */
export function blockConfirmTitle(name: string | null | undefined): string {
  return `Bloccare ${displayName(name)}?`;
}

/** §102, §154: snackbar dopo Sblocca. */
export function unblockedMessage(name: string | null | undefined): string {
  return name?.trim() ? `${name.trim()} è stato sbloccato` : BLOCK_COPY.unblockedFallback;
}

/** §92, §95: riga compatta della chat lato blocker. */
export function chatBlockerLabel(name: string | null | undefined): string {
  return `Hai bloccato ${displayName(name)}`;
}

/** §242–§243: etichette distinte per le due azioni della conferma. */
export function confirmCancelA11yLabel(name: string | null | undefined): string {
  return `Annulla, non bloccare ${displayName(name)}`;
}

export function confirmBlockA11yLabel(name: string | null | undefined): string {
  return `Blocca ${displayName(name)}`;
}

/** §247: ogni riga annuncia identità, tipo e azione. */
export function blockedRowA11yLabel(item: Pick<BlockedIdentity, "name" | "identityType" | "subtitle">): string {
  return `${item.name}, ${blockedSubtitle(item)}`;
}

export function unblockA11yLabel(name: string | null | undefined): string {
  return `Sblocca ${displayName(name)}`;
}

/** §144–§147: metadata breve. Il server la compone; il ripiego è il tipo. */
export function blockedSubtitle(item: Pick<BlockedIdentity, "identityType" | "subtitle">): string {
  if (item.subtitle) {
    return item.subtitle;
  }
  return item.identityType === "society" ? "Società" : item.identityType === "media" ? "Media" : "Persona";
}

/**
 * Le chiavi dello store: person e media vivono entrambi su `profiles.id`, la
 * Società su `clubs.id`. Una sola famiglia «profilo» evita che la stessa pagina
 * (tipo noto solo dopo il caricamento) abbia due celle diverse.
 */
export function blockTargetKey(target: BlockIdentityRef): string {
  return `${target.type === "society" ? "society" : "profile"}:${target.id}`;
}

/** Il tipo del target dal ruolo del profilo (`profiles.role`). */
export function targetTypeForRole(role: string | null | undefined): BlockIdentityType {
  return role === "media" ? "media" : "person";
}

/** Un utente è sempre PERSON, tranne la Pagina Media (un solo account, D3). */
export function personalIdentityRef(profile: { id: string; role?: string | null } | null): BlockIdentityRef | null {
  return profile ? { id: profile.id, type: targetTypeForRole(profile.role) } : null;
}

/**
 * §10–§13, D8: chi blocca è l'identità d'interazione attiva. Una Società senza
 * `can_block_identity` (e senza essere titolare, D3) non vede la voce. Il server
 * rivalida comunque.
 */
export function canBlockAs(input: {
  blocker: BlockIdentityRef | null;
  target: BlockIdentityRef | null;
  societyCapable: boolean;
}): boolean {
  const { blocker, societyCapable, target } = input;

  if (!blocker || !target) {
    return false;
  }
  // Nessun auto-blocco, nemmeno della propria identità (§2).
  if (blocker.type === target.type && blocker.id === target.id) {
    return false;
  }
  if (blocker.id === target.id) {
    return false;
  }
  return blocker.type === "society" ? societyCapable : true;
}

/** Il blocker può essere una Società: serve la capability dalla Dashboard. */
export function hasBlockCapability(identity: {
  capabilities: readonly string[];
  isOwner: boolean;
} | null | undefined): boolean {
  return !!identity && (identity.isOwner || identity.capabilities.includes("can_block_identity"));
}

/** Lo store dice «bloccato» anche durante il tentativo e lo sblocco in volo (§198, §205). */
export function isBlockedPhase(entry: Pick<BlockEntry, "phase"> | undefined): boolean {
  return entry?.phase === "blocked" || entry?.phase === "pending_block" || entry?.phase === "pending_unblock";
}

export type ChatBlockState = "none" | "blocker" | "blocked";

/**
 * §90–§109: stato della chat diretta. `blockedByMe` è la direzione blocker; `canSend`
 * è `false` per un Block in QUALUNQUE direzione, senza dire chi ha bloccato (§82, §107).
 * `override` è la cella dello store (ottimismo e convergenza): se presente vince.
 */
export function chatBlockState(input: {
  blockedByMe: boolean;
  canSend: boolean | undefined;
  override: boolean | null;
}): ChatBlockState {
  const blockedByMe = input.override ?? input.blockedByMe;

  if (blockedByMe) {
    return "blocker";
  }
  // Appena sbloccato da me, `can_send: false` del meta in cache dipende dal MIO Block: finché il
  // meta non si rilegge non è un Block dell'altro lato (§101).
  const canSendIsStale = input.blockedByMe && input.override === false;

  return input.canSend === false && !canSendIsStale ? "blocked" : "none";
}

/** §110–§112: un invio rifiutato per Block mostra il copy neutro, non l'errore tecnico. */
export function isBlockedSendError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  const lowered = typeof message === "string" ? message.toLowerCase() : "";

  return code === "42501" || lowered.includes("row-level security") || lowered.includes("blocked");
}

export type BlockedSection = {
  key: string;
  /** `null` = una sola identità blocker: nessuna intestazione (D7). */
  title: string | null;
  items: BlockedIdentity[];
};

/**
 * D7: intestazioni per identità blocker SOLO se più di una; l'ordine delle righe
 * resta quello del server (`blocked_at desc`, §149). `blockerNames` mappa
 * `type:id` → nome dell'identità (dall'elenco delle identità dell'utente).
 */
export function groupBlockedIdentities(
  items: readonly BlockedIdentity[],
  blockerNames: ReadonlyMap<string, string>,
): BlockedSection[] {
  const groups = new Map<string, BlockedIdentity[]>();

  for (const item of items) {
    const key = `${item.blockerType}:${item.blockerId}`;
    const list = groups.get(key);
    if (list) {
      list.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  if (groups.size <= 1) {
    return items.length === 0 ? [] : [{ items: [...items], key: "all", title: null }];
  }

  return [...groups.entries()].map(([key, list]) => ({
    items: list,
    key,
    title: blockerNames.get(key) ?? (key.startsWith("society:") ? "Società" : "Profilo personale"),
  }));
}
