import { Pressable, StyleSheet, View } from "react-native";

import {
  AGENT_OPERATING_MACRO_AREA_OPTIONS,
  AGENT_OPERATIONAL_FOCUS_OPTIONS,
} from "../../profiles/agent-profile";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

type AgentPortfolioStepProps = {
  isBusy: boolean;
  onContinue: () => void;
  onUpdateMacroAreas: (values: string[]) => void;
  onUpdateNote: (value: string) => void;
  onUpdateOperationalFocuses: (values: string[]) => void;
  onUpdateOperatingRegions: (value: string) => void;
  operationalFocuses: string[];
  operationalNote: string;
  operatingMacroAreas: string[];
  operatingRegions: string;
  validationErrors: Partial<Record<string, string>>;
};

export function AgentPortfolioStep({
  isBusy,
  onContinue,
  onUpdateMacroAreas,
  onUpdateNote,
  onUpdateOperationalFocuses,
  onUpdateOperatingRegions,
  operationalFocuses,
  operationalNote,
  operatingMacroAreas,
  operatingRegions,
  validationErrors,
}: AgentPortfolioStepProps) {
  function toggleValue(
    value: string,
    currentValues: string[],
    onChange: (values: string[]) => void,
  ) {
    onChange(
      currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Modalità operativa</AppText>
        <AppText variant="bodySm" color="secondary">
          Definisci come lavori con club e calciatori e in quali aree operi più spesso.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <View style={styles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Focus operativi
          </AppText>
          <View style={styles.chips}>
            {AGENT_OPERATIONAL_FOCUS_OPTIONS.map((option) => {
              const isActive = operationalFocuses.includes(option);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  key={option}
                  onPress={() =>
                    toggleValue(option, operationalFocuses, onUpdateOperationalFocuses)
                  }
                  style={[styles.chip, isActive ? styles.chipActive : null]}
                >
                  <AppText
                    color={isActive ? "inverse" : "primary"}
                    variant="bodySm"
                  >
                    {option}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {validationErrors.agentOperationalFocuses ? (
            <AppText color="danger" variant="bodySm">
              {validationErrors.agentOperationalFocuses}
            </AppText>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Macro aree operative
          </AppText>
          <View style={styles.chips}>
            {AGENT_OPERATING_MACRO_AREA_OPTIONS.map((option) => {
              const isActive = operatingMacroAreas.includes(option);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  key={option}
                  onPress={() =>
                    toggleValue(option, operatingMacroAreas, onUpdateMacroAreas)
                  }
                  style={[styles.chip, isActive ? styles.chipActive : null]}
                >
                  <AppText
                    color={isActive ? "inverse" : "primary"}
                    variant="bodySm"
                  >
                    {option}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Regioni in cui operi"
          onChangeText={onUpdateOperatingRegions}
          placeholder="Es. Lombardia, Veneto, Emilia-Romagna"
          value={operatingRegions}
        />

        <Input
          label="Nota operativa"
          multiline
          onChangeText={onUpdateNote}
          placeholder="Es. Inserimento in prima squadra e valorizzazione Under tra Serie D ed Eccellenza."
          value={operationalNote}
        />
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        fullWidth
        label="Continua"
        onPress={onContinue}
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
