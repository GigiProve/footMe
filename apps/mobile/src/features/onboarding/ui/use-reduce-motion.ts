import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * `true` quando l'utente ha attivato "Riduci movimento" a livello di sistema.
 * Le micro-interazioni dell'onboarding (progress, espansione di un toggle,
 * selezione) devono saltare l'animazione quando questo è vero (§AQ).
 */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
