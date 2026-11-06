/**
 * Uscita da un form con modifiche non salvate (§46).
 *
 * «Un form con cambiamenti non inviati usa la conferma condivisa: Uscire
 * senza salvare? / Le modifiche effettuate andranno perse. / Continua a
 * modificare | Esci senza salvare. Applicala a back, gesture, chiusura,
 * navigazione esterna e cambio di percorso rilevante. Se non ci sono
 * modifiche non chiedere conferma.»
 *
 * Non è agganciata a `beforeRemove`: il back **fra** form e riepilogo non è
 * un'uscita — §14 vuole che «Modifica torni al form senza perdere i valori»
 * — e una guardia sul navigatore chiederebbe conferma anche lì.
 */
import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { trackRoleLinkEvent } from "./role-link-analytics";
import { ROLE_LINK_COPY } from "./role-link-presentation";

export function useRoleLinkExitGuard(input: {
  fallbackHref: string;
  isDirty: boolean;
}): () => void {
  const router = useRouter();

  return useCallback(() => {
    const leave = () => {
      if (router.canGoBack()) {
        router.back();

        return;
      }

      router.replace(input.fallbackHref as never);
    };

    if (!input.isDirty) {
      leave();

      return;
    }

    trackRoleLinkEvent("role_link_unsaved_exit");

    Alert.alert(ROLE_LINK_COPY.exitTitle, ROLE_LINK_COPY.exitBody, [
      { style: "cancel", text: ROLE_LINK_COPY.exitKeep },
      { onPress: leave, style: "destructive", text: ROLE_LINK_COPY.exitLeave },
    ]);
  }, [input.fallbackHref, input.isDirty, router]);
}
