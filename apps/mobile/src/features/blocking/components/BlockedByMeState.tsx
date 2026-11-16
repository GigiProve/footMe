/**
 * Profilo lato blocker (HOM-12 §79–§81, §143, §222, §244, Screen Master 3).
 *
 * Pulito e centrato, senza card (§222): titolo, testo, una sola CTA primaria «Sblocca»
 * (accent PROLINK, §228). Il profilo completo NON si renderizza sotto (§81): chi lo usa
 * mostra questo stato al posto del contenuto. Lo screen reader legge titolo e CTA (§244).
 */

import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { BLOCK_COPY } from "../blocking-presentation";

type BlockedByMeStateProps = {
  isBusy?: boolean;
  onUnblock: () => void;
};

export function BlockedByMeState({ isBusy = false, onUnblock }: BlockedByMeStateProps) {
  useEffect(() => {
    AccessibilityInfo?.announceForAccessibility?.(BLOCK_COPY.blockedByMeTitle);
  }, []);

  return (
    <View style={styles.container} testID="blocked-by-me-state">
      <Ionicons color={colors.textMuted} name="ban-outline" size={40} />
      <AppText accessibilityRole="header" align="center" variant="headingMd">
        {BLOCK_COPY.blockedByMeTitle}
      </AppText>
      <AppText align="center" color="secondary" variant="bodyLg">
        {BLOCK_COPY.blockedByMeBody}
      </AppText>
      <Button
        accessibilityLabel={BLOCK_COPY.unblock}
        disabled={isBusy}
        label={BLOCK_COPY.unblock}
        loading={isBusy}
        onPress={onUnblock}
        size="lg"
        testID="blocked-by-me-unblock"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing[12],
    justifyContent: "center",
    minHeight: 320,
    padding: spacing[24],
  },
});
