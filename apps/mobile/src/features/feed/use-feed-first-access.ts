/**
 * Stato di primo accesso del Feed (HOM-13 D1, §135–§146; evoluzione di HOM-01.1 §27–§31).
 *
 * Due punti del brief restano e questo hook li rispetta:
 *  • non è una pagina esterna né un onboarding: è un modulo dentro la Home, reso nel
 *    `ListHeaderComponent` della tab Per te (§135, §237);
 *  • compare UNA volta sola. Lo stato autorevole è server-side (`should_show`, vero solo
 *    con `intro_state = 'pending'`), quindi sopravvive alla reinstallazione; una copia
 *    locale evita che il modulo lampeggi tra il tap e il refetch.
 *
 * «Inizia» e l'accesso rapido chiamano la stessa RPC `acknowledge_feed_intro` (§143–§144):
 * nessuna selezione obbligatoria (§145), nessuna riproposta (§146, §148).
 */

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trackFeed } from "./feed-analytics";
import { saveFeedCacheMeta, type CachedFeedFirstAccess } from "./feed-cache";
import { shouldShowIntro } from "./feed-intro-presentation";
import { acknowledgeFeedIntro, fetchMyFeedIntro } from "./feed-intro-service";
import { FEED_QK } from "./feed-keys";

export type FeedIntroDismissReason = "start" | "close";

export function useFeedFirstAccess({
  profileId,
  cachedFirstAccess,
}: {
  profileId: string;
  cachedFirstAccess: CachedFeedFirstAccess | undefined;
}) {
  const queryClient = useQueryClient();
  /** Chiusura immediata: l'utente non deve attendere la rete per vedere l'effetto. */
  const [isResolvedLocally, setResolvedLocally] = useState(false);

  const introQuery = useQuery({
    enabled: !!profileId,
    queryFn: fetchMyFeedIntro,
    queryKey: FEED_QK.intro(profileId),
  });

  const acknowledge = useMutation({
    mutationFn: acknowledgeFeedIntro,
    onMutate: () => {
      setResolvedLocally(true);
      if (profileId) {
        void saveFeedCacheMeta(profileId, {
          firstAccess: { personalizeCompletedAt: new Date().toISOString() },
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_QK.intro(profileId) });
    },
  });

  const resolve = useCallback(
    (reason: FeedIntroDismissReason) => {
      trackFeed({ name: reason === "start" ? "home_intro_start" : "home_intro_close" });
      acknowledge.mutate();
    },
    [acknowledge],
  );

  const locallyResolved = isResolvedLocally || !!cachedFirstAccess?.personalizeCompletedAt;

  return {
    areas: introQuery.data?.areas ?? [],
    // Un errore sull'intro non deve MAI bloccare il Feed: il modulo si nasconde e basta (§23).
    isVisible: shouldShowIntro(introQuery.data, locallyResolved),
    start: () => resolve("start"),
    close: () => resolve("close"),
  };
}
