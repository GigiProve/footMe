import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { onboardingRadius, onboardingSpacing } from "./onboarding-tokens";

type InfoMessageProps = {
  message: string;
  tone?: "info" | "warning";
};

/**
 * Nota informativa discreta. Da usare solo quando aiuta davvero l'utente:
 * non è il posto per spiegare come funziona il salvataggio (§K).
 */
export function InfoMessage({ message, tone = "info" }: InfoMessageProps) {
  const isWarning = tone === "warning";

  return (
    <View style={[styles.container, isWarning ? styles.warning : styles.info]}>
      <Ionicons
        color={isWarning ? colors.warningForeground : colors.accent}
        name={isWarning ? "alert-circle-outline" : "information-circle-outline"}
        size={17}
      />
      <AppText
        color={isWarning ? "warning" : "secondary"}
        style={styles.text}
        variant="meta"
      >
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    borderRadius: onboardingRadius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: onboardingSpacing.s + 2,
    paddingHorizontal: onboardingSpacing.m - 4,
    paddingVertical: onboardingSpacing.s + 2,
  },
  info: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
  },
  warning: {
    backgroundColor: colors.noticeWarnSurface,
    borderColor: colors.noticeWarnBorder,
  },
  text: {
    flex: 1,
  },
});
