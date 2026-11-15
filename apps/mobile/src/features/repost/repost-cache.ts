/**
 * Cache dopo Repost e Rimuovi repost (HOM-10 §70, §239–§242, §289–§290).
 *
 * Due passi, come `features/post-composer/composer-cache.ts` (HOM-06.1):
 *  • patch ottimistica dello stato Repost del contenuto (`has_simple_repost` della
 *    sola identità che agisce): il pannello Condividi e il composer convergono
 *    SENZA un reload completo del Feed (§289);
 *  • invalidazione per prefisso delle superfici che mostrano il contenuto: stato
 *    Repost, Feed (stale, SENZA refetch: la Home aperta non salta §248), dettaglio,
 *    interazioni del dettaglio legacy, statistiche HOM-05 (la metrica Repost la
 *    calcola il server §272).
 *
 * Il Simple Repost non crea un Post (§67): niente riga ottimistica nel Feed di chi
 * lo fa (D2: il Simple Repost compare solo nei Seguiti di chi segue il reposter).
 */

import type { QueryClient } from "@tanstack/react-query";

import { INSIGHTS_ROOT_KEY } from "../content-insights/insights-keys";
import { FEED_QK } from "../feed/feed-keys";
import type { FeedScope } from "../feed/feed-types";
import { REPOST_QK } from "./repost-keys";
import type { RepostContentRef, RepostState } from "./repost-types";

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

type Actor = { type: string; id: string };

/** Lo stato con `has_simple_repost` dell'identità cambiato; le altre restano com'erano. */
export function withSimpleRepost(state: RepostState, actor: Actor, value: boolean): RepostState {
  return {
    ...state,
    identities: state.identities.map((identity) =>
      identity.type === actor.type && identity.id === actor.id ? { ...identity, hasSimpleRepost: value } : identity,
    ),
  };
}

/** §70: aggiorna lo stato locale; restituisce il precedente per un eventuale rollback (§72). */
export function patchSimpleRepost(
  queryClient: QueryClient,
  profileId: string,
  ref: RepostContentRef,
  actor: Actor,
  value: boolean,
): RepostState | undefined {
  const key = REPOST_QK.state(profileId, ref.contentType, ref.contentId);
  const previous = queryClient.getQueryData<RepostState>(key);

  if (previous) {
    queryClient.setQueryData<RepostState>(key, withSimpleRepost(previous, actor, value));
  }

  return previous;
}

/** §72: ripristina lo stato precedente; senza uno stato in cache lo si rilegge. */
export function rollbackSimpleRepost(
  queryClient: QueryClient,
  profileId: string,
  ref: RepostContentRef,
  previous: RepostState | undefined,
): void {
  const key = REPOST_QK.state(profileId, ref.contentType, ref.contentId);

  if (previous) {
    queryClient.setQueryData<RepostState>(key, previous);
  } else {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

/** §239–§240: ciò che mostra il contenuto o il suo stato Repost si rilegge. */
export function invalidateAfterRepostChange(queryClient: QueryClient, profileId: string, ref: RepostContentRef): void {
  void queryClient.invalidateQueries({ queryKey: REPOST_QK.state(profileId, ref.contentType, ref.contentId) });

  for (const scope of SCOPES) {
    void queryClient.invalidateQueries({ queryKey: FEED_QK.feed(scope, profileId), refetchType: "none" });
  }

  void queryClient.invalidateQueries({ queryKey: FEED_QK.postDetail(ref.contentId) });
  void queryClient.invalidateQueries({ queryKey: FEED_QK.interaction(ref.contentType, ref.contentId) });
  void queryClient.invalidateQueries({
    queryKey: [INSIGHTS_ROOT_KEY, profileId, ref.contentType, ref.contentId],
  });
}
