/**
 * Uscita dal composer con compilazione non inviata (§39).
 *
 * «L'uscita completa con compilazione significativa non inviata usa il
 * pattern condiviso … Azioni Continua a modificare e Esci. Se il form è
 * vuoto o non ha modifiche da perdere, chiudi direttamente. Non chiamare
 * questa azione Elimina invito: non esiste ancora un pending salvato.»
 *
 * L'avviso vale per l'uscita dal **flusso**, non per il back fra i passi:
 * §39 è esplicito — «Fra i passi del composer il back conserva i dati
 * compatibili senza una conferma a ogni spostamento». Per questo l'hook è
 * chiamato solo dove si esce davvero, e non è agganciato a `beforeRemove`.
 */
import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_COPY } from "../invites-presentation";

export function useComposeExitGuard(input: { isDirty: boolean }): () => void {
  const router = useRouter();

  return useCallback(() => {
    const leave = () => {
      if (router.canGoBack()) {
        router.back();

        return;
      }

      router.replace("/(tabs)/dashboard/invites" as never);
    };

    if (!input.isDirty) {
      leave();

      return;
    }

    trackInvitesEvent("invite_unsaved_exit");

    Alert.alert(INVITES_COPY.exitTitle, INVITES_COPY.exitBody, [
      { style: "cancel", text: INVITES_COPY.exitKeep },
      { onPress: leave, style: "destructive", text: INVITES_COPY.exitLeave },
    ]);
  }, [input.isDirty, router]);
}
