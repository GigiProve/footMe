/**
 * HOM-05 §32–34, §103, §107, §146: gli eventi che nascono all'APERTURA del
 * dettaglio di un contenuto.
 *
 *  • `impression` con la source della provenienza (`origin`, §146): l'apertura
 *    del dettaglio è una visualizzazione; il server deduplica per finestra
 *    temporale, quindi aver già visto il contenuto nel Feed non la raddoppia;
 *  • `article_open` (§103): solo all'apertura EFFETTIVA, cioè a contenuto
 *    caricato e mostrato; non a ogni render e non in precaricamento;
 *  • `article_read` (§107): secondi di lettura ATTIVA, contati solo con la
 *    schermata a fuoco e l'app attiva, emessi all'uscita (blur o smontaggio) e
 *    quando l'app va in background.
 *
 * `isReady` è il momento in cui il contenuto è davvero a schermo. Un guasto di
 * caricamento o un contenuto non disponibile non è un'apertura.
 */

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

import type { ContentOrigin } from "../feed/content-routes";
import {
  createActiveTimeTracker,
  sourceForOrigin,
} from "./content-events-presentation";
import { emitContentEvent, rememberContentSource } from "./content-events-service";

export function useContentDetailEvents({
  contentType,
  postId,
  origin,
  isReady,
  isArticle,
}: {
  contentType: string;
  postId: string | undefined;
  origin: ContentOrigin | null;
  isReady: boolean;
  isArticle: boolean;
}): void {
  const source = sourceForOrigin(origin);

  // Una volta per contenuto aperto: un nuovo caricamento o un cambio di
  // viewer sullo stesso dettaglio non è una nuova apertura.
  const openedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isReady || !postId) {
      return;
    }
    const key = `${contentType}:${postId}`;
    if (openedKeyRef.current === key) {
      return;
    }
    openedKeyRef.current = key;

    rememberContentSource(contentType, postId, source);
    emitContentEvent({ contentType, eventType: "impression", postId, source });
    if (isArticle) {
      emitContentEvent({ contentType, eventType: "article_open", postId, source });
    }
  }, [contentType, isArticle, isReady, postId, source]);

  // Lettura attiva: solo per gli articoli aperti. Il tracker vive per tutta la
  // vita della schermata; `focused` e `appActive` ne decidono la corsa.
  const trackerRef = useRef(createActiveTimeTracker());
  const focusedRef = useRef(false);
  const appActiveRef = useRef(AppState?.currentState !== "background");
  const targetRef = useRef({ contentType, postId, source });
  const trackingRef = useRef(isReady && isArticle);

  useEffect(() => {
    targetRef.current = { contentType, postId, source };
    trackingRef.current = isReady && isArticle;
    if (trackingRef.current && focusedRef.current && appActiveRef.current) {
      trackerRef.current.start();
    }
  }, [contentType, isArticle, isReady, postId, source]);

  const emitRead = useRef(() => {
    const tracker = trackerRef.current;
    tracker.pause();
    const seconds = tracker.take();
    const target = targetRef.current;
    if (!trackingRef.current || !target.postId || seconds <= 0) {
      return;
    }
    emitContentEvent({
      contentType: target.contentType,
      eventType: "article_read",
      postId: target.postId,
      props: { seconds },
      source: target.source,
    });
  });

  // useFocusEffect riesegue l'effetto a ogni nuova identità della callback:
  // useCallback è necessario (stesso motivo di use-feed-video-lifecycle.ts).
  useFocusEffect(
    useCallback(() => {
      const tracker = trackerRef.current;
      focusedRef.current = true;
      if (trackingRef.current && appActiveRef.current) {
        tracker.start();
      }
      return () => {
        // Blur (es. apertura del profilo autore): la lettura si sospende ma la
        // sessione resta aperta; il server media per evento (una sessione = un
        // `article_read`), quindi si spedisce solo a smontaggio o background.
        focusedRef.current = false;
        tracker.pause();
      };
    }, []),
  );

  useEffect(() => {
    const emit = emitRead.current;
    const subscription = AppState?.addEventListener?.("change", (state) => {
      appActiveRef.current = state === "active";
      if (state === "active") {
        if (trackingRef.current && focusedRef.current) {
          trackerRef.current.start();
        }
      } else {
        emit();
      }
    });
    return () => {
      subscription?.remove();
      // Smontaggio: chiude la sessione di lettura.
      emit();
    };
  }, []);
}
