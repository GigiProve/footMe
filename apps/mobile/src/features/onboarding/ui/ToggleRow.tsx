import { type ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from "react-native";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingMotion,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";
import { useReduceMotion } from "./use-reduce-motion";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_INSET = 3;

type ToggleRowProps = {
  label: string;
  /** Una o due righe al massimo. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /**
   * Contenuto rivelato quando il toggle è attivo. Quando torna spento la
   * schermata si ricompatta: nessuno spazio vuoto residuo (§O.5, §O.6).
   */
  children?: ReactNode;
  testID?: string;
};

/**
 * Riga con interruttore booleano (§O). È l'unico modo in cui l'onboarding
 * pone una domanda sì/no che governa contenuto aggiuntivo.
 */
export function ToggleRow({
  children,
  description,
  disabled = false,
  label,
  onValueChange,
  testID,
  value,
}: ToggleRowProps) {
  const reduceMotion = useReduceMotion();
  const translateX = useRef(
    new Animated.Value(value ? TRACK_WIDTH - THUMB_SIZE - THUMB_INSET : THUMB_INSET),
  ).current;

  useEffect(() => {
    const toValue = value
      ? TRACK_WIDTH - THUMB_SIZE - THUMB_INSET
      : THUMB_INSET;

    if (reduceMotion) {
      translateX.setValue(toValue);
      return;
    }

    Animated.timing(translateX, {
      duration: onboardingMotion.fast,
      toValue,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateX, value]);

  function handleToggle() {
    if (children && !reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    onValueChange(!value);
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={handleToggle}
        style={[styles.row, disabled ? styles.disabled : null]}
        testID={testID}
      >
        <View style={styles.text}>
          <AppText variant="titleSm">{label}</AppText>
          {description ? (
            <AppText color="secondary" numberOfLines={2} variant="meta">
              {description}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.track, value ? styles.trackOn : null]}>
          <Animated.View
            style={[styles.thumb, { transform: [{ translateX }] }]}
          />
        </View>
      </Pressable>

      {value && children ? <View style={styles.revealed}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingLayout.fieldGap,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    minHeight: onboardingLayout.rowMinHeight,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s + 2,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  track: {
    backgroundColor: colors.borderStrong,
    borderRadius: onboardingRadius.pill,
    height: TRACK_HEIGHT,
    justifyContent: "center",
    width: TRACK_WIDTH,
  },
  trackOn: {
    backgroundColor: colors.accent,
  },
  thumb: {
    backgroundColor: colors.inkInvert,
    borderRadius: onboardingRadius.pill,
    height: THUMB_SIZE,
    left: 0,
    position: "absolute",
    width: THUMB_SIZE,
  },
  revealed: {
    gap: onboardingLayout.fieldGap,
  },
});
