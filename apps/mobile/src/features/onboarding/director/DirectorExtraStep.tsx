import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import { DIRECTOR_LANGUAGE_OPTIONS } from "../onboarding-types";

type DirectorExtraStepProps = {
  bio: string;
  isBusy: boolean;
  languages: string[];
  onFinish: () => void;
  onSkip: () => void;
  onUpdate: (patch: { directorBio?: string; directorLanguages?: string[] }) => void;
};

export function DirectorExtraStep({
  bio,
  isBusy,
  languages,
  onFinish,
  onSkip,
  onUpdate,
}: DirectorExtraStepProps) {
  function toggleLanguage(language: string) {
    const nextLanguages = languages.includes(language)
      ? languages.filter((entry) => entry !== language)
      : [...languages, language];
    onUpdate({ directorLanguages: nextLanguages });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Informazioni aggiuntive</AppText>
        <AppText variant="bodySm" color="secondary">
          Aggiungi una breve bio e le lingue parlate prima di completare la
          registrazione.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <Input
          label="Bio"
          multiline
          onChangeText={(value) => onUpdate({ directorBio: value })}
          placeholder="Racconta la tua esperienza dirigenziale, i club con cui hai lavorato e la tua visione."
          style={styles.bioInput}
          value={bio}
        />

        <View style={styles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Lingue
          </AppText>
          <View style={styles.chips}>
            {DIRECTOR_LANGUAGE_OPTIONS.map((option) => {
              const active = languages.includes(option);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option}
                  onPress={() => toggleLanguage(option)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <AppText
                    variant="bodySm"
                    style={active ? styles.chipTextActive : undefined}
                  >
                    {option}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        fullWidth
        label={isBusy ? "Salvataggio..." : "Completa registrazione"}
        onPress={onFinish}
        variant="primary"
      />
      <Button
        disabled={isBusy}
        fullWidth
        label="Salta"
        onPress={onSkip}
        variant="tertiary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bioInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipTextActive: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  container: {
    gap: spacing[16],
  },
  fieldGroup: {
    gap: spacing[8],
  },
  header: {
    gap: spacing[8],
  },
});
