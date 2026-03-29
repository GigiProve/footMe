import React from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../../ui";
import type { OnboardingVisibleStep } from "./onboarding-form";

// ---------------------------------------------------------------------------
// OnboardingScreenHeader — sticky header with back arrow and step label
// ---------------------------------------------------------------------------

type OnboardingScreenHeaderProps = {
  onBack?: () => void;
};

export function OnboardingScreenHeader({
  onBack,
}: OnboardingScreenHeaderProps) {
  return (
    <View style={headerStyles.container}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={onBack}
          style={headerStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={headerStyles.backPlaceholder} />
      )}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[16],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    marginLeft: -spacing[8],
  },
  backPlaceholder: {
    width: 40,
    height: 40,
  },
});

// ---------------------------------------------------------------------------
// OnboardingProgressBar — horizontal pill-bar step indicator (Banani style)
// ---------------------------------------------------------------------------

type OnboardingProgressBarProps = {
  currentIndex: number;
  steps: OnboardingVisibleStep[];
};

export function OnboardingProgressBar({
  currentIndex,
  steps,
}: OnboardingProgressBarProps) {
  return (
    <View style={progressStyles.container}>
      {steps.map((entry, index) => (
        <View
          key={entry.step}
          style={[
            progressStyles.bar,
            index <= currentIndex ? progressStyles.barActive : null,
          ]}
        />
      ))}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
    paddingBottom: spacing[28],
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: "#D5DAE0",
  },
  barActive: {
    backgroundColor: colors.accent,
  },
});

// ---------------------------------------------------------------------------
// OnboardingSectionCard — white card container for form sections
// ---------------------------------------------------------------------------

type OnboardingSectionCardProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export function OnboardingSectionCard({
  children,
  title,
  subtitle,
}: OnboardingSectionCardProps) {
  return (
    <View style={sectionStyles.card}>
      {title ? (
        <View style={sectionStyles.headerGroup}>
          <AppText variant="headingMd">{title}</AppText>
          {subtitle ? (
            <AppText variant="bodySm" color="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    padding: spacing[20],
    gap: spacing[20],
  },
  headerGroup: {
    gap: spacing[8],
  },
});

// ---------------------------------------------------------------------------
// OnboardingInfoCard — notice/info card with icon
// ---------------------------------------------------------------------------

type OnboardingInfoCardProps = {
  message: string;
  icon?: string;
};

export function OnboardingInfoCard({ message }: OnboardingInfoCardProps) {
  return (
    <View style={infoStyles.card}>
      <Ionicons
        name="information-circle-outline"
        size={20}
        color={colors.accent}
      />
      <AppText variant="bodySm" color="secondary" style={infoStyles.text}>
        {message}
      </AppText>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[12],
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    padding: spacing[14],
  },
  text: {
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// OnboardingEyebrow — accent-colored section label above titles
// ---------------------------------------------------------------------------

type OnboardingEyebrowProps = {
  children: string;
};

export function OnboardingEyebrow({ children }: OnboardingEyebrowProps) {
  return (
    <AppText variant="bodySm" style={eyebrowStyles.text}>
      {children}
    </AppText>
  );
}

const eyebrowStyles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
});

// ---------------------------------------------------------------------------
// OnboardingCheckboxRow — Banani-style selectable checkbox row
// ---------------------------------------------------------------------------

type OnboardingCheckboxRowProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

export function OnboardingCheckboxRow({
  active,
  label,
  onPress,
}: OnboardingCheckboxRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[checkboxStyles.row, active ? checkboxStyles.rowActive : null]}
    >
      <AppText
        variant="bodyLg"
        style={checkboxStyles.label}
      >
        {label}
      </AppText>
      <View
        style={[
          checkboxStyles.icon,
          active ? checkboxStyles.iconActive : null,
        ]}
      >
        {active ? (
          <Ionicons name="checkmark" size={16} color={colors.inkInvert} />
        ) : null}
      </View>
    </Pressable>
  );
}

const checkboxStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
  },
  rowActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(10,102,194,0.04)",
  },
  label: {
    fontWeight: "600",
    flex: 1,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});

// ---------------------------------------------------------------------------
// OnboardingToggleRow — Banani-style toggle switch row
// ---------------------------------------------------------------------------

type OnboardingToggleRowProps = {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

const TOGGLE_WIDTH = 48;
const TOGGLE_HEIGHT = 28;
const THUMB_SIZE = 22;
const TOGGLE_PADDING = 3;

export function OnboardingToggleRow({
  label,
  onValueChange,
  value,
}: OnboardingToggleRowProps) {
  const translateX = React.useRef(
    new Animated.Value(value ? TOGGLE_WIDTH - THUMB_SIZE - TOGGLE_PADDING : TOGGLE_PADDING),
  ).current;

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? TOGGLE_WIDTH - THUMB_SIZE - TOGGLE_PADDING : TOGGLE_PADDING,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  return (
    <View style={toggleRowStyles.container}>
      <AppText variant="bodySm" style={toggleRowStyles.title}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={[
          toggleRowStyles.track,
          value ? toggleRowStyles.trackOn : toggleRowStyles.trackOff,
        ]}
      >
        <Animated.View
          style={[
            toggleRowStyles.thumb,
            { transform: [{ translateX }] },
          ]}
        />
      </Pressable>
    </View>
  );
}

const toggleRowStyles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
  },
  title: {
    fontWeight: "600",
    flex: 1,
  },
  track: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    borderRadius: TOGGLE_HEIGHT / 2,
  },
  trackOn: {
    backgroundColor: colors.accent,
  },
  trackOff: {
    backgroundColor: "#D5DAE0",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    position: "absolute",
    top: TOGGLE_PADDING,
  },
});
