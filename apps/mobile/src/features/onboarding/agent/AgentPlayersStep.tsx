import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import { AGENT_MANAGED_PLAYERS_OPTIONS } from "./agent-options";

type AgentPlayersStepProps = {
  managedPlayersCount: string;
  errorMessage?: string;
  isBusy: boolean;
  onContinue: () => void;
  onUpdate: (value: string) => void;
};

export function AgentPlayersStep({
  managedPlayersCount,
  errorMessage,
  isBusy,
  onContinue,
  onUpdate,
}: AgentPlayersStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">I tuoi calciatori</AppText>
        <AppText variant="bodySm" color="secondary">
          Seleziona la fascia che descrive meglio il numero di profili che segui
          attivamente.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <View style={styles.list}>
          {AGENT_MANAGED_PLAYERS_OPTIONS.map((option) => {
            const active = managedPlayersCount === option;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                key={option}
                onPress={() => onUpdate(option)}
                style={[styles.option, active ? styles.optionActive : null]}
              >
                <AppText variant="titleSm">{option}</AppText>
                <Ionicons
                  color={active ? colors.accent : colors.textMuted}
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                />
              </Pressable>
            );
          })}
        </View>
        {errorMessage ? (
          <AppText variant="bodySm" color="danger">
            {errorMessage}
          </AppText>
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
  container: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[8],
  },
  list: {
    gap: spacing[10],
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
});
