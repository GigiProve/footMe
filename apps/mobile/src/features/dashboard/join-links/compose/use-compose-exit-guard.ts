/**
 * Uscita dal composer dei Link di invito con bozza non inviata.
 *
 * Stesso pattern condiviso dei flussi di invito (DAS-REV-19): «L'uscita
 * completa con compilazione significativa non inviata mostra Continua a
 * modificare / Esci senza salvare. Se il form è vuoto o non ha modifiche da
 * perdere, chiudi direttamente.»
 *
 * Vale per l'uscita dal **flusso**, non per il back fra i passi del
 * composer: muoversi fra Configura → Ruoli → Riepilogo conserva la bozza
 * senza conferma a ogni spostamento, perché prima di "Genera link" non
 * esiste comunque nulla da perdere lato server.
 */
import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { trackJoinLinksEvent } from "../join-links-analytics";
import { JOIN_LINKS_COPY } from "../join-links-presentation";
import { JOIN_LINKS_HREFS } from "../join-links-routes";

export function useComposeExitGuard(input: { isDirty: boolean }): () => void {
  const router = useRouter();

  return useCallback(() => {
    const leave = () => {
      if (router.canGoBack()) {
        router.back();

        return;
      }

      router.replace(JOIN_LINKS_HREFS.center() as never as Parameters<typeof router.replace>[0]);
    };

    if (!input.isDirty) {
      leave();

      return;
    }

    trackJoinLinksEvent("join_link_unsaved_exit");

    Alert.alert(JOIN_LINKS_COPY.exitTitle, JOIN_LINKS_COPY.exitBody, [
      { style: "cancel", text: JOIN_LINKS_COPY.exitStay },
      { onPress: leave, style: "destructive", text: JOIN_LINKS_COPY.exitLeave },
    ]);
  }, [input.isDirty, router]);
}
