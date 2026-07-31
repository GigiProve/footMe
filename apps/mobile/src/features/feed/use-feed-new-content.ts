/**
 * Rilevamento dei contenuti pubblicati mentre l'utente legge (§19).
 *
 * Il vincolo del §19 è netto: "non riportarlo automaticamente in cima" e "non
 * interrompere la lettura con refresh automatici". Questo hook quindi NON tocca
 * mai la lista: interroga solo un conteggio e restituisce lo stato del banner.
 * Chi decide di aggiornare è l'utente, con un tap.
 *
 * Il polling è limitato al focus della schermata e si spegne al blur, così una
 * Home in secondo piano non consuma nulla. Un errore è silenzioso: nessun
 * banner è di gran lunga preferibile a un errore per un'informazione accessoria.
 */

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { FEED_QK } from "./feed-keys";
import { fetchHomeFeedUpdates } from "./feed-meta-service";
import type { FeedScope } from "./feed-types";

/** Due minuti: abbastanza raro da non pesare, abbastanza spesso da restare utile. */
const POLL_INTERVAL_MS = 120_000;

export function useFeedNewContent({
  scope,
  profileId,
  since,
}: {
  scope: FeedScope;
  profileId: string;
  since: string | null;
}) {
  const [isFocused, setFocused] = useState(false);
  const [isDismissed, setDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Un nuovo watermark significa che la lista è stata aggiornata: il banner
  // eventualmente chiuso torna disponibile.
  useEffect(() => {
    setDismissed(false);
  }, [since]);

  const query = useQuery({
    enabled: !!profileId && !!since && isFocused,
    queryFn: () => fetchHomeFeedUpdates(scope, since as string),
    queryKey: [...FEED_QK.updates(scope, profileId), since],
    refetchInterval: isFocused ? POLL_INTERVAL_MS : false,
  });

  const count = query.data?.newItemsCount ?? 0;

  return {
    avatarUrls: query.data?.previewAvatarUrls ?? [],
    count,
    dismiss: () => setDismissed(true),
    isVisible: !isDismissed && count > 0,
  };
}
