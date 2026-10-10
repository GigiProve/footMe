import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { teamRowLines } from "../teams-presentation";
import type { TeamsCenterRow } from "../teams-service";

type Props = {
  /** Assente quando la riga non ha una destinazione reale (§9, §12). */
  onPress?: (() => void) | null;
  row: TeamsCenterRow;
  showDivider?: boolean;
};

/**
 * Riga del Centro Squadre (§9).
 *
 * «L'intera riga è tappabile quando dispone di una destinazione reale; la
 * chevron non è l'unico target.» Quando la destinazione non c'è, la riga non
 * è un pulsante e la chevron **non viene disegnata**: §12 vieta le frecce
 * verso pagine inesistenti, e una freccia inerte è esattamente quella.
 *
 * Nome e classificazione restano su righe distinte: a 320pt un nome lungo e
 * "Under 18 · Élite" sulla stessa riga collidono, e §31 non ammette
 * troncamenti che rendano la classificazione incomprensibile.
 */
export function TeamRow({ onPress, row, showDivider = false }: Props) {
  const lines = teamRowLines(row);

  const body = (
    <>
      <Avatar
        name={row.name}
        size="md"
        square
        tone="ink"
        uri={row.crestUrl ?? undefined}
      />

      <View style={styles.body}>
        <AppText numberOfLines={2} variant="titleMd">
          {row.name}
        </AppText>

        {lines.meta ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {lines.meta}
          </AppText>
        ) : null}

        {lines.counts ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {lines.counts}
          </AppText>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      {onPress ? (
        <Pressable
          accessibilityLabel={[row.name, lines.meta, lines.counts]
            .filter(Boolean)
            .join(", ")}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          testID={`team-row-${row.teamId}`}
        >
          {body}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={[row.name, lines.meta, lines.counts]
            .filter(Boolean)
            .join(", ")}
          style={styles.row}
          testID={`team-row-${row.teamId}`}
        >
          {body}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[14],
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
