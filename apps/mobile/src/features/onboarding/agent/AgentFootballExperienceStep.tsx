import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Toggle } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import { AGENT_FOOTBALL_ROLE_OPTIONS } from "./agent-options";

type AgentFootballExperienceStepProps = {
  hasOtherFootballExperience: boolean;
  isBusy: boolean;
  otherFootballRoles: string[];
  errorMessage?: string;
  onContinue: () => void;
  onToggleExperience: (value: boolean) => void;
  onUpdateRoles: (roles: string[]) => void;
};

export function AgentFootballExperienceStep({
  hasOtherFootballExperience,
  isBusy,
  otherFootballRoles,
  errorMessage,
  onContinue,
  onToggleExperience,
  onUpdateRoles,
}: AgentFootballExperienceStepProps) {
  function toggleRole(role: string) {
    const nextRoles = otherFootballRoles.includes(role)
      ? otherFootballRoles.filter((entry) => entry !== role)
      : [...otherFootballRoles, role];
    onUpdateRoles(nextRoles);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Esperienze nel calcio</AppText>
        <AppText variant="bodySm" color="secondary">
          Aggiungi eventuali ruoli gia' ricoperti per rendere il profilo piu'
          credibile e completo.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <Toggle
          label="Ho altre esperienze nel calcio"
          onValueChange={onToggleExperience}
          subtitle="Attiva il toggle se hai avuto altri ruoli nel mondo del calcio."
          value={hasOtherFootballExperience}
        />

        {hasOtherFootballExperience ? (
          <View style={styles.fieldGroup}>
            <AppText variant="caption" color="muted">
              Ruoli ricoperti
            </AppText>
            <View style={styles.chips}>
              {AGENT_FOOTBALL_ROLE_OPTIONS.map((option) => {
                const active = otherFootballRoles.includes(option);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={option}
                    onPress={() => toggleRole(option)}
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
            {errorMessage ? (
              <AppText variant="bodySm" color="danger">
                {errorMessage}
              </AppText>
            ) : null}
          </View>
        ) : null}
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
