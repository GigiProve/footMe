import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";

type Props = {
  /** Azione testuale a destra ("Modifica") prima della chevron o del menu. */
  action?: ReactNode;
  /** Stemma effettivo; assente quando la squadra non ne ha uno (§10). */
  avatarName?: string;
  avatarUrl?: string | null;
  meta?: string | null;
  onPress?: (() => void) | null;
  showAvatar?: boolean;
  showChevron?: boolean;
  showDivider?: boolean;
  testID?: string;
  title: string;
  /** Terza riga, es. "4 stagioni" o "2 nuove · 2 già presenti". */
  trailingLine?: string | null;
};

/**
 * Riga compatta con divisore, usata da tutti gli elenchi del pack: squadre
 * del Centro, stagioni precedenti, periodi del riepilogo, squadre non attive.
 *
 * §22 è esplicito sul formato: «Utilizzare righe compatte con divisori, non
 * grandi card». Una sola riga per quattro elenchi tiene la stessa altezza,
 * lo stesso divisore e lo stesso comportamento del tap — «L'intera riga è
 * tappabile quando dispone di una destinazione reale» — invece di quattro
 * varianti che divergono alla prima modifica.
 *
 * Senza `onPress` la riga non è un pulsante e la chevron **non** viene
 * disegnata: una freccia inerte prometterebbe una destinazione che non c'è.
 */
export function SeasonsListRow({
  action,
  avatarName,
  avatarUrl,
  meta,
  onPress,
  showAvatar = false,
  showChevron = true,
  showDivider = false,
  testID,
  title,
  trailingLine,
}: Props) {
  const accessibilityLabel = [title, meta, trailingLine]
    .filter(Boolean)
    .join(", ");

  const body = (
    <>
      {showAvatar ? (
        <Avatar
          name={avatarName ?? title}
          size="md"
          square
          tone="ink"
          uri={avatarUrl ?? undefined}
        />
      ) : null}

      <View style={styles.body}>
        <AppText color="neutral" numberOfLines={2} variant="titleSm">
          {title}
        </AppText>

        {meta ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="meta">
            {meta}
          </AppText>
        ) : null}

        {trailingLine ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="caption">
            {trailingLine}
          </AppText>
        ) : null}
      </View>

      {action}

      {onPress && showChevron ? (
        <Ionicons
          color={colors.textNeutralMuted}
          name="chevron-forward"
          size={18}
        />
      ) : null}
    </>
  );

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      {onPress ? (
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          testID={testID}
        >
          {body}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={accessibilityLabel}
          style={styles.row}
          testID={testID}
        >
          {body}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
    paddingVertical: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
});
