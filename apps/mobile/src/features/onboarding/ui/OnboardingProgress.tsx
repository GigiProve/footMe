import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import {
  onboardingLayout,
  onboardingMotion,
  onboardingRadius,
} from "./onboarding-tokens";
import { useReduceMotion } from "./use-reduce-motion";

type OnboardingProgressProps = {
  /** Passo corrente, a base 1. */
  current: number;
  /** Numero totale di passi del ramo di ruolo corrente. */
  total: number;
};

/**
 * Barra di avanzamento dell'onboarding: 3px, accent sul riempito, neutro
 * leggerissimo sul resto. Identica per ogni ruolo (§F).
 */
export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal);
  const ratio = safeCurrent / safeTotal;
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(ratio);
      return;
    }

    Animated.timing(progress, {
      duration: onboardingMotion.base,
      toValue: ratio,
      useNativeDriver: false,
    }).start();
  }, [progress, ratio, reduceMotion]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ text: `Passaggio ${safeCurrent} di ${safeTotal}` }}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: onboardingRadius.pill,
    height: onboardingLayout.progressTrackHeight,
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    backgroundColor: colors.accent,
    borderRadius: onboardingRadius.pill,
    height: "100%",
  },
});
