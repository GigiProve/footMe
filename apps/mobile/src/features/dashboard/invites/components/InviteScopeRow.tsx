import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  label: string;
  /** `null` quando non esiste più di un ambito: testo in chiaro, non un dropdown. */
  onPress: (() => void) | null;
};

/**
 * Riga del filtro di ambito, sotto le tab (§14, screen 01).
 *
 * «Sotto le tab, la riga filtro mostra Tutti gli ambiti quando non esiste
 * una restrizione sulle squadre.» Non è un chip rimovibile e non ha un
 * secondo sistema di reset: §14 li vieta entrambi.
 */
export function InviteScopeRow({ label, onPress }: Props) {
  const content = (
    <View style={styles.row}>
      <AppText
        color="neutral"
        numberOfLines={1}
        style={styles.label}
        variant="bodyLg"
      >
        {label}
      </AppText>

      {onPress ? (
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`Ambito: ${label}`} style={styles.wrap}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint="Apre il filtro per squadra"
      accessibilityLabel={`Filtro: ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed ? styles.pressed : null]}
      testID="invites-scope-row"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
