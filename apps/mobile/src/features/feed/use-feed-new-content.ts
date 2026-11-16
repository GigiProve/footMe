/**
 * Rilevamento dei contenuti pubblicati mentre l'utente legge (§19; HOM-13 §90–§92, §232).
 *
 * Il vincolo è netto: "non riportarlo automaticamente in cima" e "non interrompere la
 * lettura con refresh automatici". Questo hook quindi NON tocca mai la lista:
 * interroga solo un conteggio e restituisce lo stato della pill. Chi decide di
 * aggiornare è l'utente, con un tap (che in entrambe le tab crea una sessione nuova).
 *
 *  • Per te: `fetch_home_for_you_updates(session_id)` — contenuti eleggibili dopo
 *    l'`as_of` della SESSIONE e non già emessi (HOM-13 contratto §2);
 *  • Seguiti: `fetch_home_feed_updates('seguiti', since)`, invariata.
 *
 * Il polling è limitato al focus della schermata e si spegne al blur, così una
 * Home in secondo piano non consuma nulla. Un errore è silenzioso: nessuna pill è
 * di gran lunga preferibile a un errore per un'informazione accessoria.
 */

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { FEED_QK } from "./feed-keys";
import { fetchHomeFeedUpdates, fetchHomeForYouUpdates } from "./feed-meta-service";
import type { FeedScope } from "./feed-types";

/** Due minuti: abbastanza raro da non pesare, abbastanza spesso da restare utile. */
const POLL_INTERVAL_MS = 120_000;

export function useFeedNewContent({
  scope,
  profileId,
  since,
  sessionId,
}: {
  scope: FeedScope;
  profileId: string;
  /** Seguiti: il watermark `as_of`. */
  since: string | null;
  /** Per te: la sessione corrente. */
  sessionId: string | null;
}) {
  const [isFocused, setFocused] = useState(false);
  const [isDismissed, setDismissed] = useState(false);
  const isForYou = scope === "per_te";
  // Il riferimento di confronto: la sessione (Per te) o il watermark (Seguiti).
  const reference = isForYou ? sessionId : since;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Un nuovo riferimento significa che la lista è stata aggiornata: la pill
  // eventualmente chiusa torna disponibile.
  useEffect(() => {
    setDismissed(false);
  }, [reference]);

  const query = useQuery({
    enabled: !!profileId && !!reference && isFocused,
    queryFn: () =>
      isForYou
        ? fetchHomeForYouUpdates(reference as string)
        : fetchHomeFeedUpdates(scope, reference as string),
    queryKey: isForYou
      ? FEED_QK.updatesForSession(profileId, reference ?? "")
      : [...FEED_QK.updates(scope, profileId), reference],
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
