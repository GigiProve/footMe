import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import {
  AGENT_PLAYER_ROLE_OPTIONS,
  AGENT_PLAYER_TYPE_OPTIONS,
} from "./agent-options";
import type { PlayerPosition } from "../../profiles/player-sports";

type AgentPortfolioStepProps = {
  isBusy: boolean;
  mainPlayerRoles: PlayerPosition[];
  onContinue: () => void;
  onUpdateMainRoles: (roles: PlayerPosition[]) => void;
  onUpdatePlayerTypes: (types: string[]) => void;
  playerTypes: string[];
  validationErrors: Partial<Record<string, string>>;
};

export function AgentPortfolioStep({
  isBusy,
  mainPlayerRoles,
  onContinue,
  onUpdateMainRoles,
  onUpdatePlayerTypes,
  playerTypes,
  validationErrors,
}: AgentPortfolioStepProps) {
  function toggleType(type: string) {
    const nextTypes = playerTypes.includes(type)
      ? playerTypes.filter((entry) => entry !== type)
      : [...playerTypes, type];
    onUpdatePlayerTypes(nextTypes);
  }

  function toggleRole(role: PlayerPosition) {
    const nextRoles = mainPlayerRoles.includes(role)
      ? mainPlayerRoles.filter((entry) => entry !== role)
      : [...mainPlayerRoles, role];
    onUpdateMainRoles(nextRoles);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Profilo calciatori</AppText>
        <AppText variant="bodySm" color="secondary">
          Specifica quali calciatori rappresenti o segui piu' spesso.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <View style={styles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Tipologia calciatori
          </AppText>
          <View style={styles.chips}>
            {AGENT_PLAYER_TYPE_OPTIONS.map((option) => {
              const active = playerTypes.includes(option);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option}
                  onPress={() => toggleType(option)}
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
          {validationErrors.agentPlayerTypes ? (
            <AppText variant="bodySm" color="danger">
              {validationErrors.agentPlayerTypes}
            </AppText>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Ruoli principali
          </AppText>
          <View style={styles.chips}>
            {AGENT_PLAYER_ROLE_OPTIONS.map((option) => {
              const active = mainPlayerRoles.includes(option.value);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option.value}
                  onPress={() => toggleRole(option.value)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <AppText
                    variant="bodySm"
                    style={active ? styles.chipTextActive : undefined}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {validationErrors.agentMainPlayerRoles ? (
            <AppText variant="bodySm" color="danger">
              {validationErrors.agentMainPlayerRoles}
            </AppText>
          ) : null}
        </View>
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
