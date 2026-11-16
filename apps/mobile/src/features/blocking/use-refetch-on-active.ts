/**
 * Convergenza cross-device (HOM-12 §208–§210): un Block fatto su un altro device
 * arriva a una sessione con profilo o chat aperti appena l'app torna in primo piano.
 * Il callback si rilegge dal server; lo store (`seed`) riallinea le celle.
 */

import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export function useRefetchOnActive(callback: () => void): void {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  useEffect(() => {
    const subscription = AppState?.addEventListener?.("change", (state) => {
      if (state === "active") {
        ref.current();
      }
    });

    return () => subscription?.remove?.();
  }, []);
}
