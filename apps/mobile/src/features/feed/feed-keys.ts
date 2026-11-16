/**
 * Query key del Feed in un posto solo, così invalidazioni e patch ottimistiche
 * non divergono.
 *
 * La key della infinite query ESCLUDE `asOf` e la sessione Per te: entrambi vivono
 * nel `pageParam` e nei dati delle pagine (`FeedPage.session`). Il motivo è che le
 * patch ottimistiche di altri moduli (Like, report, delete, composer, unfollow)
 * scrivono con `setQueryData(FEED_QK.feed(scope, profileId))` a key ESATTA: una
 * sessione nella key le renderebbe tutte cieche. Il refresh (nuova sessione)
 * sostituisce i dati della stessa query, quindi nessuna fork di cache e nessun
 * lampeggio. HOM-13 §227: sessione, unit emesse, cursore e tab stanno nella cache
 * (`feed-cache`, `FeedPage.session`), non nella chiave.
 *
 * `updates` per Per te distingue invece la sessione: il conteggio dei nuovi
 * contenuti ha senso solo rispetto a QUELLA sessione.
 */

import type { FeedContentType, FeedScope } from "./feed-types";

export const FEED_QK = {
  cache: (profileId: string) => ["feed-cache", profileId] as const,
  feed: (scope: FeedScope, profileId: string) => ["feed", scope, profileId] as const,
  followingState: (profileId: string) => ["feed-following-state", profileId] as const,
  intro: (profileId: string) => ["feed-intro", profileId] as const,
  suggestedClubs: (profileId: string) => ["feed-suggested-clubs", profileId] as const,
  suggestedProfiles: (profileId: string) =>
    ["feed-suggested-profiles", profileId] as const,
  /**
   * HOM-13 §4: un modulo per `moduleIndex` DENTRO una sessione, indipendente dagli altri
   * (§269–§271). Il prefisso è `suggestedProfiles`: follow e Block invalidano tutti i moduli.
   */
  suggestedProfilesModule: (profileId: string, sessionId: string, moduleIndex: number) =>
    ["feed-suggested-profiles", profileId, "module", sessionId, moduleIndex] as const,
  updates: (scope: FeedScope, profileId: string) =>
    ["feed-updates", scope, profileId] as const,
  /** HOM-13 §2: nuovi contenuti di Per te rispetto a una sessione precisa. */
  updatesForSession: (profileId: string, sessionId: string) =>
    ["feed-updates", "per_te", profileId, "session", sessionId] as const,
  /** HOM-02: il dettaglio di un post persona, patchato insieme al Feed dal Like. */
  postDetail: (postId: string) => ["feed-post-detail", postId] as const,
  /**
   * HOM-03 §104: Mi piace e commenti del dettaglio `/content/[type]/[id]`.
   * Tipo e id insieme: lo stesso uuid non identifica un contenuto da solo.
   */
  interaction: (contentType: FeedContentType, postId: string) =>
    ["feed-interaction", contentType, postId] as const,
};
