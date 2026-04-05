import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { PlayerCareerType } from "./player-career-types";

type PlayerExperienceTypeSelectorProps = {
  options?: {
    icon: keyof typeof Ionicons.glyphMap;
    subtitle: string;
    title: string;
    type: PlayerCareerType;
  }[];
  subtitle?: string;
  title?: string;
  onSelect: (type: PlayerCareerType) => void;
};

const typeOptions: {
  type: PlayerCareerType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    type: "MULTI_SEASON",
    title: "Più stagioni complete",
    subtitle:
      "Es. 2022/23, 2023/24 nella stessa squadra con la stessa categoria.",
    icon: "layers-outline",
  },
  {
    type: "SINGLE_SEASON",
    title: "Singola stagione",
    subtitle: "Es. 2023/24, una sola stagione sportiva.",
    icon: "calendar-outline",
  },
  {
    type: "CUSTOM_PERIOD",
    title: "Periodo personalizzato",
    subtitle:
      "Es. da Gennaio 2023 a Maggio 2023. Utile per prestiti o periodi brevi.",
    icon: "time-outline",
  },
];

export function PlayerExperienceTypeSelector({
  options = typeOptions,
  subtitle = "Che tipo di esperienza vuoi inserire?",
  title = "Aggiungi esperienza",
  onSelect,
}: PlayerExperienceTypeSelectorProps) {
  return (
    <View style={selectorStyles.container}>
      <AppText variant="headingMd">{title}</AppText>
      <AppText variant="bodySm" color="secondary">
        {subtitle}
      </AppText>

      <View style={selectorStyles.optionsContainer}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.type}
            onPress={() => onSelect(option.type)}
            style={({ pressed }) => [
              selectorStyles.optionCard,
              pressed ? selectorStyles.optionCardPressed : null,
            ]}
          >
            <View style={selectorStyles.optionIcon}>
              <Ionicons name={option.icon} size={24} color={colors.accentStrong} />
            </View>
            <View style={selectorStyles.optionText}>
              <AppText variant="titleMd">{option.title}</AppText>
              <AppText variant="bodySm" color="secondary">
                {option.subtitle}
              </AppText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const selectorStyles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  optionsContainer: {
    gap: spacing[12],
    marginTop: spacing[8],
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[14],
    padding: spacing[18],
    backgroundColor: colors.surface,
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
  },
});
