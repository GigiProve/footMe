/**
 * Le due azioni del Simple Repost, senza hook né UI (HOM-10 §63, §69–§72, §128–§131,
 * §226–§229, §234–§238).
 *
 * Funzioni semplici, non hook, perché sopravvivono alla schermata che le avvia: il
 * composer si chiude SUBITO al tap (§70) e l'esito arriva dopo. Chi le chiama dice
 * cosa mostrare; qui c'è solo l'ordine corretto di patch, chiamata, rollback e
 * invalidazione.
 *
 *  • `performSimpleRepost` — patch ottimistica, `repost_content`, e in caso di
 *    errore rollback (§72). `already_reposted` vale successo: il server restituisce
 *    lo stato canonico (§236) e il client converge su «Repost ✓» (§237);
 *  • `performRemoveRepost` — patch, `remove_repost`, rollback su errore.
 *    `not_found` vale successo (§238): rimosso da un altro device converge.
 *
 * Nessun errore tecnico esce: un fallimento è una `SimpleRepostFailure` (§65).
 */

import type { QueryClient } from "@tanstack/react-query";

import { trackRepost } from "./repost-analytics";
import { invalidateAfterRepostChange, patchSimpleRepost, rollbackSimpleRepost } from "./repost-cache";
import { removeRepost, repostContent } from "./repost-service";
import type { RepostContentRef, SimpleRepostFailure } from "./repost-types";
import type { ComposerIdentityType } from "../post-composer/composer-types";

type Actor = { type: ComposerIdentityType; id: string };

export type SimpleRepostResult = { ok: true; replayed: boolean } | { ok: false; failure: SimpleRepostFailure };

type PerformInput = {
  queryClient: QueryClient;
  profileId: string;
  ref: RepostContentRef;
  actor: Actor;
  /** §234: stabile per l'azione; doppio tap e retry la riusano. */
  operationKey: string;
};

/** §70–§72, §225, §236: Simple Repost ottimistico con rollback. */
export async function performSimpleRepost({
  queryClient,
  profileId,
  ref,
  actor,
  operationKey,
}: PerformInput): Promise<SimpleRepostResult> {
  const props = { contentId: ref.contentId, contentType: ref.contentType, identityType: actor.type };

  trackRepost({ name: "simple_repost_attempt", ...props });

  // §70: lo stato locale cambia prima della risposta.
  const previous = patchSimpleRepost(queryClient, profileId, ref, actor, true);

  const fail = (failure: SimpleRepostFailure): SimpleRepostResult => {
    // §72: rollback. Per un originale sparito lo stato in cache è comunque vecchio.
    rollbackSimpleRepost(queryClient, profileId, ref, previous);
    trackRepost({ name: "simple_repost_failure", reason: failure, ...props });
    return { failure, ok: false };
  };

  // Risposta persa ma richiesta forse arrivata: lo stato in cache potrebbe essere vecchio. Si segna stale (§236–§237).
  const failAmbiguous = (): SimpleRepostResult => {
    const outcome = fail("error");
    invalidateAfterRepostChange(queryClient, profileId, ref);
    return outcome;
  };

  try {
    const result = await repostContent({
      identityId: actor.id,
      identityType: actor.type,
      operationKey,
      ref,
    });

    if (result.status === "content_unavailable") {
      invalidateAfterRepostChange(queryClient, profileId, ref);
      return fail("unavailable");
    }

    if (result.status === "forbidden") {
      return fail("forbidden");
    }

    invalidateAfterRepostChange(queryClient, profileId, ref);
    trackRepost({ name: "simple_repost_success", replayed: result.status === "already_reposted", ...props });

    return { ok: true, replayed: result.status === "already_reposted" };
  } catch {
    return failAmbiguous();
  }
}

/** §128–§131, §238: Rimuovi repost, immediato e senza conferma. */
export async function performRemoveRepost({
  queryClient,
  profileId,
  ref,
  actor,
}: Omit<PerformInput, "operationKey">): Promise<{ ok: true } | { ok: false; failure: SimpleRepostFailure }> {
  const props = { contentId: ref.contentId, contentType: ref.contentType, identityType: actor.type };
  const previous = patchSimpleRepost(queryClient, profileId, ref, actor, false);

  try {
    const outcome = await removeRepost({ identityId: actor.id, identityType: actor.type, ref });

    if (outcome === "forbidden") {
      rollbackSimpleRepost(queryClient, profileId, ref, previous);
      return { failure: "forbidden", ok: false };
    }

    invalidateAfterRepostChange(queryClient, profileId, ref);
    trackRepost({ name: "simple_repost_removed", ...props });

    return { ok: true };
  } catch {
    rollbackSimpleRepost(queryClient, profileId, ref, previous);
    invalidateAfterRepostChange(queryClient, profileId, ref);
    return { failure: "error", ok: false };
  }
}
