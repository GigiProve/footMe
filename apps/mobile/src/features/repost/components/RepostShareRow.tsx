/**
 * La riga «Repost» del pannello Condividi (HOM-10 §2–§5, §120–§123, §273–§274;
 * mockup 1 e 7).
 *
 * È la prima azione, quella pubblica, sopra «Invia su PROLINK» (§2–§3). Estende il
 * pannello HOM-09: non è un secondo share sheet (§5). Due stati dello stesso
 * elemento: «Repost» / «Condividi questo contenuto con la tua rete» e, con un
 * Simple Repost già attivo, «Repost ✓» / «Hai già ripostato questo contenuto» (§122).
 * In entrambi il tap apre il composer (§14, §123): lo stato già ripostato non
 * sostituisce l'entry point con «Rimuovi repost» (§120–§121).
 *
 * Nessun colore per tipo di identità (§256): l'unico accento è quello PROLINK.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ShareRepostRow } from "../repost-presentation";

type RepostShareRowProps = {
  row: ShareRepostRow;
  onPress: () => void;
};

export function RepostShareRow({ row, onPress }: RepostShareRowProps) {
  return (
    <Pressable
      accessibilityLabel={row.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: row.active }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID="share-repost"
    >
      <View style={styles.icon}>
        <Ionicons color={colors.accent} name="repeat-outline" size={22} />
      </View>
      <View style={styles.text}>
        <AppText variant="titleSm">{row.title}</AppText>
        <AppText color="secondary" variant="bodySm">
          {row.subtitle}
        </AppText>
      </View>
      {row.active ? (
        <Ionicons color={colors.accent} name="checkmark" size={22} testID="share-repost-active" />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
