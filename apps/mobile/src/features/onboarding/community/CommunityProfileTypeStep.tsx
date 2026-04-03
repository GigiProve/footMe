import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

type CommunityProfileTypeStepProps = {
  errorMessage?: string;
  onSelect: (value: "fan" | "media") => void;
  selectedValue: "fan" | "media" | "";
};

export function CommunityProfileTypeStep({
  errorMessage,
  onSelect,
  selectedValue,
}: CommunityProfileTypeStepProps) {
  return (
    <OnboardingSectionCard
      title="Media e appassionati"
      subtitle="Scegli il tipo di profilo che descrive meglio il tuo utilizzo di FootMe."
    >
      <View style={styles.options}>
        <ProfileTypeCard
          active={selectedValue === "fan"}
          icon="person-outline"
          label="Profilo base"
          onPress={() => onSelect("fan")}
          subtitle="Per seguire, commentare e interagire velocemente."
        />
        <ProfileTypeCard
          active={selectedValue === "media"}
          icon="newspaper-outline"
          label="Profilo media"
          onPress={() => onSelect("media")}
          subtitle="Per giornalisti, creator, pagine, testate e progetti editoriali."
        />
      </View>

      {errorMessage ? (
        <AppText variant="caption" color="danger">
          {errorMessage}
        </AppText>
      ) : null}
    </OnboardingSectionCard>
  );
}

function ProfileTypeCard({
  active,
  icon,
  label,
  onPress,
  subtitle,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  subtitle: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.card, active ? styles.cardActive : null]}
    >
      <View style={styles.iconShell}>
        <Ionicons
          color={active ? colors.accentStrong : colors.accent}
          name={icon}
          size={22}
        />
      </View>
      <View style={styles.copy}>
        <AppText variant="titleSm" style={active ? styles.activeText : undefined}>
          {label}
        </AppText>
        <AppText variant="bodySm" color="secondary">
          {subtitle}
        </AppText>
      </View>
      {active ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activeText: {
    color: colors.accentStrong,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  cardActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  copy: {
    flex: 1,
    gap: spacing[4],
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  options: {
    gap: spacing[12],
  },
});
