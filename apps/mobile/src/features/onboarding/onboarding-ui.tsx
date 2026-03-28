import { Pressable, StyleSheet, View } from "react-native";
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
