/**
 * Derivazioni pure della lista Mi piace (HOM-07 §47–§60, §63, §179–§180).
 *
 * Righe PERSON, SOCIETY e MEDIA con la stessa struttura (§48–§50): avatar o
 * logo, nome, verifica, UNA riga di metadata sintetica, CTA Follow. Niente
 * città, regione, follower, storico carriera o più badge (§52): la riga dice chi
 * è, non tutto ciò che si sa di lui.
 *
 * La riga meta riusa i presentatori del Feed (`authorMetaParts`): «Allenatore ·
 * AC Como», «Calciatore» per ruolo, «Procuratore» e mai «Agente» (§51,
 * `formatRole`). Società e Media portano il tipo davanti — «Società · Serie D»,
 * «Media · Testata» — come nel mockup, perché qui, a differenza dell'header di un
 * Post, la riga non ha altro che dica di che identità si tratta.
 */

import type { InfiniteData } from "@tanstack/react-query";

import { authorMetaParts } from "../feed/feed-post-presentation";
import type { FeedAuthorMeta } from "../feed/feed-types";
import type { MediaSourceType } from "../search/media/media-search-types";
import type { LikeActor, LikesCursor, LikesPage } from "./likes-types";

/** Le pagine della infinite query della lista. */
export type LikesData = InfiniteData<LikesPage, LikesCursor | null>;

export const LIKES_SOCIETY_LABEL = "Società";
export const LIKES_MEDIA_LABEL = "Media";

function metaOf(actor: LikeActor): FeedAuthorMeta {
  return {
    clubCategory: actor.clubCategory,
    clubName: actor.clubName,
    mediaKind: actor.mediaKind,
    primaryPosition: actor.primaryPosition,
    role: actor.role,
    teamLabel: actor.teamLabel,
  };
}

/** La seconda riga: «Allenatore · AC Como», «Società · Serie D», «Media · Testata». */
export function likeActorMetaLine(actor: LikeActor): string {
  const parts = authorMetaParts(actor.actorType, metaOf(actor));

  switch (actor.actorType) {
    case "society":
      return [LIKES_SOCIETY_LABEL, ...parts].join(" · ");
    case "media":
      return [LIKES_MEDIA_LABEL, ...parts].join(" · ");
    default:
      return parts.join(" · ");
  }
}

/** §179: ogni riga è un'unità semantica: «Marco Bianchi, profilo verificato, Allenatore · AC Como». */
export function likeActorAccessibilityLabel(actor: LikeActor): string {
  return [actor.name, actor.isVerified ? "profilo verificato" : null, likeActorMetaLine(actor)]
    .filter(Boolean)
    .join(", ");
}

/** §53: avatar, nome e riga aprono il profilo (o la Società) per id. */
export function likeActorHref(actor: LikeActor): string {
  return actor.actorType === "society"
    ? `/club/${actor.actorId}`
    : `/profile/${actor.actorId}`;
}

/**
 * §55–§57: il Follow è quello globale. Le Società seguono `club_follows`, i
 * profili (anche Media) `profile_follows`: la stessa distinzione di
 * `toggleFollowSource`. Nessuna CTA per l'identità del viewer (§57).
 */
export function likeActorFollowType(actor: LikeActor): MediaSourceType {
  return actor.actorType === "society" ? "club" : "media_profile";
}

export function canFollowActor(actor: LikeActor): boolean {
  return !actor.isSelf;
}

/** Etichetta parlata del Follow: stato e azione chiari (§180). */
export function followAccessibilityLabel(actor: LikeActor, isFollowing: boolean): string {
  return isFollowing ? `Smetti di seguire ${actor.name}` : `Segui ${actor.name}`;
}

/**
 * Le pagine in un elenco solo, senza duplicati (§60, §229). Il keyset non ne
 * dovrebbe produrre, ma un refetch durante una modifica può sovrapporre due
 * pagine: vince la prima occorrenza, l'ordine del server resta.
 */
export function mergeLikerPages(pages: readonly { items: readonly LikeActor[] }[]): LikeActor[] {
  const seen = new Set<string>();
  const merged: LikeActor[] = [];

  for (const page of pages) {
    for (const actor of page.items) {
      if (!seen.has(actor.key)) {
        seen.add(actor.key);
        merged.push(actor);
      }
    }
  }

  return merged;
}

/**
 * §54: al rientro da un profilo la lista si rilegge per lo stato Follow, ma il
 * ranking del server (seguiti prima, §59) la riordinerebbe sotto il dito. Le
 * righe già viste mantengono il loro posto; quelle nuove si accodano; quelle
 * sparite (Like tolto, identità non più visibile) escono.
 */
export function keepLikerOrder(previousKeys: readonly string[], actors: readonly LikeActor[]): LikeActor[] {
  if (previousKeys.length === 0) {
    return [...actors];
  }

  const byKey = new Map(actors.map((actor) => [actor.key, actor]));
  const kept: LikeActor[] = [];
  for (const key of previousKeys) {
    const actor = byKey.get(key);
    if (actor) {
      kept.push(actor);
      byKey.delete(key);
    }
  }

  return [...kept, ...actors.filter((actor) => byKey.has(actor.key))];
}

/** Riscrive lo stato Follow di UN attore in tutte le pagine caricate; il resto resta identico. */
export function patchLikerFollowing(
  data: LikesData | undefined,
  actorKey: string,
  isFollowing: boolean,
): LikesData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((actor) =>
        actor.key === actorKey ? { ...actor, isFollowing } : actor,
      ),
    })),
  };
}

/**
 * Un errore del server che è una risposta DEFINITIVA e non un guasto: contenuto
 * non più leggibile (`content_unavailable`, §62), permesso negato. Tutto il resto
 * (rete, timeout) è temporaneo e ammette «Riprova» (§67).
 */
export function classifyLikesError(error: unknown): "unavailable" | "error" {
  const message =
    typeof error === "object" && error !== null
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

  return message.includes("content_unavailable") || code === "42501" || code === "22P02"
    ? "unavailable"
    : "error";
}
