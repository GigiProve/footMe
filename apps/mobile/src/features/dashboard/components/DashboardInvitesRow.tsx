import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  /** Frasi già al plurale corretto, una per aggregato consultabile. */
  lines: string[];
  onPress: () => void;
};

/**
 * Riepilogo compatto di "Inviti e richieste" (DAS-REV-07 §14).
 *
 * Una riga sola con le quantità che il dominio sa davvero distinguere. La
 * prima riga è il titolo operativo, la seconda il dettaglio: con un solo
 * aggregato consultabile la seconda sparisce invece di mostrare uno zero che
 * nessuno ha calcolato.
 *
 * §14 vieta di sommare in un unico totale candidature a posizioni, inviti
 * amministrativi e inviti all'organico: le frasi arrivano già separate dal
 * chiamante e questo componente non le fonde.
 */
export function DashboardInvitesRow({ lines, onPress }: Props) {
  if (lines.length === 0) {
    return null;
  }

  const [primary, ...rest] = lines;

  return (
    <Pressable
      accessibilityLabel={lines.join(", ")}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconCircle}>
        <Ionicons color={colors.accent} name="people-outline" size={18} />
      </View>

      <View style={styles.body}>
        <AppText numberOfLines={2} variant="titleMd">
          {primary}
        </AppText>

        {rest.length > 0 ? (
          <AppText color="secondary" numberOfLines={2} variant="meta">
            {rest.join(" · ")}
          </AppText>
        ) : null}
      </View>

      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
});
