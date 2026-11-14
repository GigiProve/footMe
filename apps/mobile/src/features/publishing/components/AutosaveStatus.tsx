/**
 * Stato discreto dell'autosave (HOM-06.2 §119–§120, §247, §251; mockup 2–3):
 * «Salvataggio…» poi «Bozza salvata», mai un toast. Il verde non è un giudizio
 * di performance: è il trattamento «success» del design system per uno stato
 * tecnico, limitato a icona ed etichetta (§247). Annunciato agli screen reader
 * come regione viva (§251).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import type { AutosaveStatus as AutosaveState } from "../publishing-types";
import { autosaveLabel } from "../use-autosave";

type Props = { status: AutosaveState };

const ICONS: Record<AutosaveState["status"], keyof typeof Ionicons.glyphMap | null> = {
  conflict: "alert-circle-outline",
  error: "alert-circle-outline",
  idle: null,
  offline: "cloud-offline-outline",
  saved: "cloud-done-outline",
  saving: "sync-outline",
};

export function AutosaveStatus({ status }: Props) {
  const label = autosaveLabel(status);
  if (!label) {
    return null;
  }
  const icon = ICONS[status.status];
  const tone =
    status.status === "saved"
      ? colors.success
      : status.status === "error" || status.status === "conflict"
        ? colors.danger
        : colors.textMuted;

  return (
    <View accessibilityLabel={label} accessibilityLiveRegion="polite" accessible style={styles.row} testID="autosave-status">
      {icon ? <Ionicons color={tone} name={icon} size={16} /> : null}
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
});
