/**
 * Visibilità reale di una chat (DAS-REV-34 §11, §16).
 *
 * «Visibile» = la schermata è in primo piano (non coperta da Info o da un'altra
 * route) **e** l'app è attiva. Solo allora la chat pubblica il proprio id in
 * `visible-conversation` (per non duplicare con una Push OS la conversazione
 * che l'utente sta leggendo) e può confermare la lettura. Blur, smontaggio e
 * background azzerano l'id.
 */
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";

import { clearVisibleConversation, setVisibleConversation } from "./visible-conversation";

function isAppActive(): boolean {
  // Dove AppState non esiste (test, web) l'app conta come attiva.
  return (AppState?.currentState ?? "active") === "active";
}

export function useVisibleConversation(conversationId: string, enabled: boolean): boolean {
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(isAppActive);

  useEffect(() => {
    const subscription = AppState?.addEventListener?.("change", (state) => {
      setAppActive(state === "active");
    });

    return () => subscription?.remove?.();
  }, []);

  const isVisible = enabled && !!conversationId && isFocused && appActive;

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    setVisibleConversation(conversationId);

    return () => clearVisibleConversation(conversationId);
  }, [conversationId, isVisible]);

  return isVisible;
}
