import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { onboardingSpacing } from "./onboarding-tokens";

type InlineErrorProps = {
  message?: string;
};

/**
 * Errore di validazione inline (§AC). Mai un modal per un errore di campo.
 * L'icona è necessaria: lo stato di errore non può dipendere dal solo colore.
 */
export function InlineError({ message }: InlineErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <Ionicons color={colors.danger} name="alert-circle" size={14} />
      <AppText color="danger" style={styles.text} variant="meta">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: onboardingSpacing.xs + 2,
  },
  text: {
    flex: 1,
  },
});
