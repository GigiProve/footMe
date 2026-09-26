import { StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import {
  OnboardingMultiSelectField,
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui";
import {
  CLUB_SOCIAL_COLOR_OPTIONS,
  getClubSocialColorHex,
} from "./club-taxonomy";

type ClubColorsFieldProps = {
  values: string[];
  onChange: (values: string[]) => void;
  errorMessage?: string;
};

/**
 * Colori sociali (REV-ONB-05 §L, §M).
 *
 * Un solo selector, multi-selezione, senza colore principale e secondario:
 * i colori di una società non hanno una gerarchia e l'ordine in cui vengono
 * scelti non ne crea una. La preview sotto al campo mostra le pastiglie
 * accanto al nome, così la scelta non si legge dal solo colore (§BH) — e
 * nulla di tutto questo tocca il tema di ProLink.
 */
export function ClubColorsField({
  errorMessage,
  onChange,
  values,
}: ClubColorsFieldProps) {
  return (
    <View style={styles.container}>
      <OnboardingMultiSelectField
        errorMessage={errorMessage}
        label="Colori sociali"
        onChange={onChange}
        options={CLUB_SOCIAL_COLOR_OPTIONS}
        placeholder="Seleziona colori sociali"
        sheetTitle="Colori sociali"
        testID="club-colors-field"
        values={values}
      />

      {values.length > 0 ? (
        <View style={styles.preview}>
          {values.map((value) => (
            <View key={value} style={styles.chip}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: getClubSocialColorHex(value) ?? colors.surfaceMuted },
                ]}
              />
              <AppText color="secondary" variant="meta">
                {value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.s,
  },
  preview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: onboardingSpacing.s,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.xs + 2,
    paddingHorizontal: onboardingSpacing.s + 2,
    paddingVertical: onboardingSpacing.xs + 1,
  },
  swatch: {
    borderColor: colors.borderStrong,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.hairline,
    height: 14,
    width: 14,
  },
});
