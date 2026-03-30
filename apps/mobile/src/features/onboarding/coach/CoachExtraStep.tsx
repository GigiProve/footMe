import { Pressable, StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const FORMATION_OPTIONS: { label: string; value: string }[] = [
  { label: "4-3-3", value: "4-3-3" },
  { label: "4-4-2", value: "4-4-2" },
  { label: "4-2-3-1", value: "4-2-3-1" },
  { label: "3-5-2", value: "3-5-2" },
  { label: "3-4-3", value: "3-4-3" },
  { label: "5-3-2", value: "5-3-2" },
  { label: "4-1-4-1", value: "4-1-4-1" },
  { label: "4-3-1-2", value: "4-3-1-2" },
];

const PLAY_STYLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Costruzione dal basso", value: "Costruzione dal basso" },
  { label: "Pressing alto", value: "Pressing alto" },
  { label: "Contropiede", value: "Contropiede" },
  { label: "Possesso palla", value: "Possesso palla" },
  { label: "Gioco diretto", value: "Gioco diretto" },
  { label: "Misto", value: "Misto" },
];

const LANGUAGE_OPTIONS: string[] = [
  "Italiano",
  "Inglese",
  "Spagnolo",
  "Francese",
  "Tedesco",
  "Portoghese",
  "Arabo",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CoachExtraStepProps = {
  bio: string;
  formation: string;
  isBusy: boolean;
  languages: string[];
  playStyle: string;
  onFinish: () => void;
  onSkip: () => void;
  onUpdate: (
    patch: Partial<{
      bio: string;
      coachFormation: string;
      coachPlayStyle: string;
      coachLanguages: string[];
    }>,
  ) => void;
};

// ---------------------------------------------------------------------------
// CoachExtraStep
// ---------------------------------------------------------------------------

export function CoachExtraStep({
  bio,
  formation,
  isBusy,
  languages,
  playStyle,
  onFinish,
  onSkip,
  onUpdate,
}: CoachExtraStepProps) {
  function toggleLanguage(lang: string) {
    const next = languages.includes(lang)
      ? languages.filter((l) => l !== lang)
      : [...languages, lang];
    onUpdate({ coachLanguages: next });
  }

  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title="Filosofia e stile di gioco"
        subtitle="Aggiungi informazioni aggiuntive per completare il tuo profilo da allenatore."
      >
        {/* Bio / filosofia */}
        <Input
          label="Biografia (Filosofia di gioco)"
          multiline
          onChangeText={(val) => onUpdate({ bio: val })}
          placeholder="Descrivi la tua filosofia di gioco, metodologia e obiettivi..."
          style={styles.bioInput}
          value={bio}
        />

        {/* Modulo preferito */}
        <SelectField
          allowClear
          clearLabel="Rimuovi modulo"
          label="Modulo preferito"
          onChange={(val) => onUpdate({ coachFormation: val })}
          options={FORMATION_OPTIONS}
          placeholder="Seleziona modulo"
          value={formation}
        />

        {/* Stile di gioco */}
        <SelectField
          allowClear
          clearLabel="Rimuovi stile"
          label="Stile di gioco"
          onChange={(val) => onUpdate({ coachPlayStyle: val })}
          options={PLAY_STYLE_OPTIONS}
          placeholder="Seleziona stile"
          value={playStyle}
        />

        {/* Lingue parlate */}
        <View style={styles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Lingue parlate
          </AppText>
          <View style={styles.chipRow}>
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSelected = languages.includes(lang);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={lang}
                  onPress={() => toggleLanguage(lang)}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : null,
                  ]}
                >
                  <AppText
                    variant="bodySm"
                    style={
                      isSelected ? styles.chipTextSelected : styles.chipText
                    }
                  >
                    {lang}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        label={isBusy ? "Salvataggio..." : "Termina"}
        onPress={onFinish}
        variant="primary"
      />
      <Button
        disabled={isBusy}
        label="Salta"
        onPress={onSkip}
        variant="tertiary"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  bioInput: {
    height: 110,
    textAlignVertical: "top",
  },
  fieldGroup: {
    gap: spacing[8],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  chip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
});
