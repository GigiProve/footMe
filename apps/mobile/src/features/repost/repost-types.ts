/**
 * Contratto del Repost (HOM-10 §14–§21, §32–§44, §66–§72, §169–§192, §225–§238).
 *
 * UNA sola funzione per l'utente (§1): senza testo significativo è un Simple
 * Repost (redistribuzione, nessun Post autonomo §67), con testo è un nuovo Post
 * con una reference strutturata all'originale (§86–§88). Il client non espone mai
 * questa distinzione (§65): vive in `repost-presentation.ts` e nei due percorsi di
 * invio del composer.
 *
 * I tipi `Wire*` sono la forma jsonb delle RPC di
 * `20261125090000_home_repost.sql` (snake_case): `fetch_repost_state`,
 * `repost_content`, `remove_repost`. I tipi senza prefisso sono il dominio del
 * client. La reference di un Post (`data.reference`) e il contesto del Feed
 * (`data.repost`) sono dichiarati in `feed/feed-types.ts`: arrivano nel `data` del
 * Feed e dei dettagli, non da queste RPC.
 */

import type { ComposerIdentity } from "../post-composer/composer-types";
import type { FeedContentType, FeedIdentityType } from "../feed/feed-types";
import type { SharePreview } from "../share/share-types";

/** §2: la reference canonica è `content_type` + `content_id` (HOM-09), mai un solo id. */
export type RepostContentRef = {
  contentType: FeedContentType;
  contentId: string;
};

export type WireRepostIdentity = {
  identity_type: FeedIdentityType;
  identity_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  /** «Allenatore · AC Como», «Società», «Media» (§26, §31). */
  context_label: string | null;
  /** §32: derivata da `content_create` (decisione D1), rivalidata dal server (§35). */
  can_repost: boolean;
  /** §33: con testo serve anche questa. */
  can_publish_post: boolean;
  /** §34: per programmare il Post con testo. */
  can_schedule_content: boolean;
  /** §120, §122: l'identità ha già un Simple Repost attivo di questo originale. */
  has_simple_repost: boolean;
};

/** Risposta di `fetch_repost_state(p_content_type, p_content_id)`. */
export type WireRepostState = {
  /** §43: pubblicato, leggibile dal viewer, tipo ammesso. */
  repostable: boolean;
  /**
   * Lo snapshot dell'originale (snapshot HOM-09 + `has_reference`); `null` se non ripostabile.
   * Il server lo manda sempre: il mapper resta difensivo, ma non c'è un ripiego lato client.
   */
  snapshot: Record<string, unknown> | null;
  identities: WireRepostIdentity[];
};

/**
 * Un'identità che può comparire in «Reposta come». `canRepost` falso la esclude
 * dalla lista del composer (§30) ma resta nello stato: serve a dire «permesso perso».
 */
export type RepostIdentity = ComposerIdentity & { canRepost: boolean };

export type RepostState = {
  repostable: boolean;
  /** L'originale come preview compatta (§45–§46); `null` se non c'è nulla da mostrare. */
  preview: SharePreview | null;
  /** Nell'ordine del server (stesso di `footme_publishing_identities`). */
  identities: RepostIdentity[];
};

/** Esito di `repost_content` (§63, §225–§229, §236). */
export type RepostOutcome = "created" | "already_reposted" | "content_unavailable" | "forbidden";

export type RepostResult = {
  status: RepostOutcome;
  repostId: string | null;
};

/** Esito di `remove_repost` (§128–§131, §238): `not_found` vale successo (idempotente). */
export type RemoveRepostOutcome = "removed" | "not_found" | "forbidden";

/** Perché un Simple Repost non è andato a buon fine, senza codici tecnici verso la UI (§65). */
export type SimpleRepostFailure = "unavailable" | "forbidden" | "error";
