/**
 * Profilo non disponibile (HOM-12 §82–§85, §223, §245, Screen Master 4).
 *
 * Stesso linguaggio neutro dello stato «Contenuto non disponibile» di HOM-04: icona
 * sobria con segno di divieto, titolo e una frase. Ancora più neutro del lato blocker
 * (§223): nessun motivo, nessuna CTA, nessun colore. È lo stato di un profilo bloccato
 * (da chi?), sospeso o inesistente, e non li distingue (§84, §245).
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { BLOCK_COPY } from "../blocking-presentation";

export function ProfileUnavailableState() {
  return (
    <View style={styles.container} testID="profile-unavailable-state">
      <View style={styles.icon}>
        <Ionicons color={colors.textMuted} name="person-outline" size={52} />
        <View style={styles.ban}>
          <Ionicons color={colors.textMuted} name="ban-outline" size={24} />
        </View>
      </View>
      <AppText accessibilityRole="header" align="center" variant="headingMd">
        {BLOCK_COPY.unavailableTitle}
      </AppText>
      <AppText align="center" color="secondary" variant="bodyLg">
        {BLOCK_COPY.unavailableBody}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  ban: {
    bottom: 0,
    position: "absolute",
    right: 0,
  },
  container: {
    alignItems: "center",
    gap: spacing[12],
    justifyContent: "center",
    minHeight: 320,
    padding: spacing[24],
  },
  icon: {
    alignItems: "center",
    height: 72,
    justifyContent: "center",
    marginBottom: spacing[8],
    width: 72,
  },
});
