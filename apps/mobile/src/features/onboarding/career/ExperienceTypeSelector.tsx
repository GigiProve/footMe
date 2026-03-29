import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { CareerExperienceType } from "./career-types";

type ExperienceTypeSelectorProps = {
  onSelect: (type: CareerExperienceType) => void;
};

const typeOptions: {
  type: CareerExperienceType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    type: "FIRST_TEAM",
    title: "Prima Squadra",
    subtitle:
      "Esperienze maturate in prima squadra (dilettanti o professionisti)",
    icon: "football-outline",
  },
  {
    type: "YOUTH",
    title: "Settore Giovanile",
    subtitle: "Esperienze nei campionati giovanili (Primavera, Under 19, ecc.)",
    icon: "people-outline",
  },
];

export function ExperienceTypeSelector({
  onSelect,
}: ExperienceTypeSelectorProps) {
  return (
    <View style={selectorStyles.container}>
      <AppText variant="headingMd">Aggiungi esperienza</AppText>
      <AppText variant="bodySm" color="secondary">
        Che tipo di esperienza vuoi inserire nel tuo profilo?
      </AppText>

      <View style={selectorStyles.optionsContainer}>
        {typeOptions.map((option) => (
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
              <Ionicons name={option.icon} size={28} color={colors.hero} />
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
    backgroundColor: colors.heroSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
  },
});
