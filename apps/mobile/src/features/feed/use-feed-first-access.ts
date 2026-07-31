/**
 * Modulo di primo accesso "Personalizza il tuo Feed" (§6).
 *
 * Il §6 è categorico su due punti e questo hook li rispetta entrambi:
 *  • non è una pagina esterna né un onboarding separato: è un modulo temporaneo
 *    dentro la Home, reso nel `ListHeaderComponent` della tab Per te;
 *  • dopo il completamento o la chiusura non deve occupare permanentemente il
 *    Feed. Lo stato autorevole è server-side (`feed_preferences.intro_state`),
 *    così sopravvive alla reinstallazione; una copia locale evita che il modulo
 *    lampeggi durante il primo caricamento.
 *
 * La personalizzazione non è obbligatoria: "Lo farò più tardi" chiude il modulo
 * e la Home resta pienamente usabile con i dati già presenti nel profilo.
 */

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trackFeed } from "./feed-analytics";
import { saveFeedCacheMeta, type CachedFeedFirstAccess } from "./feed-cache";
import { FEED_QK } from "./feed-keys";
import {
  dismissFeedIntro,
  fetchMyFeedIntro,
  setFeedPreferences,
} from "./feed-preferences-service";
import type { FeedPreferenceKey } from "./feed-types";

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

  const resolve = useCallback(
    (patch: Partial<CachedFeedFirstAccess>) => {
      setResolvedLocally(true);
      if (profileId) {
        void saveFeedCacheMeta(profileId, { firstAccess: patch });
      }
      void queryClient.invalidateQueries({ queryKey: FEED_QK.intro(profileId) });
    },
    [profileId, queryClient],
  );

  const save = useMutation({
    mutationFn: (selected: readonly FeedPreferenceKey[]) => setFeedPreferences(selected),
    onMutate: (selected) => {
      trackFeed({ name: "feed_personalize_tap", options: selected.join(",") });
      trackFeed({ name: "feed_personalize_dismiss", reason: "completed" });
      resolve({ personalizeCompletedAt: new Date().toISOString() });
    },
    onSuccess: () => {
      // Le preferenze cambiano i suggerimenti: vanno ricaricati.
      void queryClient.invalidateQueries({
        queryKey: FEED_QK.suggestedProfiles(profileId),
      });
      void queryClient.invalidateQueries({
        queryKey: FEED_QK.suggestedClubs(profileId),
      });
    },
  });

  const dismiss = useMutation({
    mutationFn: dismissFeedIntro,
    onMutate: () => {
      trackFeed({ name: "feed_personalize_dismiss", reason: "later" });
      resolve({ personalizeDismissedAt: new Date().toISOString() });
    },
  });

  const locallyResolved =
    isResolvedLocally ||
    !!cachedFirstAccess?.personalizeCompletedAt ||
    !!cachedFirstAccess?.personalizeDismissedAt;

  return {
    // Un errore sull'intro non deve MAI bloccare il Feed: il modulo si nasconde
    // e basta (§23).
    isVisible: introQuery.data?.shouldShow === true && !locallyResolved,
    options: introQuery.data?.options ?? [],
    dismiss: () => dismiss.mutate(),
    save: (selected: readonly FeedPreferenceKey[]) => save.mutate(selected),
    isSaving: save.isPending,
  };
}
