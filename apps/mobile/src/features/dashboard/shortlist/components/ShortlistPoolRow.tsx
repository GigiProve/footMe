/**
 * Riga del pool misto (§14, screen 11).
 *
 * «Righe compatte con avatar, nome, ruolo, contesto pubblico corrente, stato
 * di valutazione interno se autorizzato, priorità soltanto se presente ed
 * eventuale informazione discreta sulla candidatura collegata.»
 *
 * Nessuna segmentazione per origine: §14 — «Il pool contiene insieme persone
 * con e senza Application. Nessuna tab Candidati/Scouting, nessuna
 * segmentazione automatica, nessuna priorità di ranking assegnata in base
 * all'origine.»
 *
 * «Da candidatura» e «Aggiunto dal profilo» sono metadati grigi, non badge
 * colorati, e la nota interna non compare mai qui — §14: «Non caricare o
 * mostrare note complete nella riga.»
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import { poolRowMeta } from "../shortlist-presentation";
import type { ShortlistPoolRow as Row } from "../shortlist-types";

type Props = {
  canSeeEvaluation: boolean;
  onPress: () => void;
  row: Row;
  showDivider?: boolean;
};

/** §14: «ruolo, contesto pubblico corrente». Senza contesto, niente puntino. */
function identityLine(row: Row): string {
  return [row.role, row.currentTeam]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");
}

export function ShortlistPoolRowView({
  canSeeEvaluation,
  onPress,
  row,
  showDivider = false,
}: Props) {
  const identity = identityLine(row);
  const meta = poolRowMeta({
    canSeeEvaluation,
    createdSource: row.createdSource,
    evaluationStatus: row.evaluationStatus,
    hasApplication: row.hasApplication,
    priority: row.priority,
  });

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <Pressable
        accessibilityLabel={[row.name, identity, ...meta]
          .filter((part) => part.length > 0)
          .join(". ")}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={`shortlist-pool-${row.personId}`}
      >
        <Avatar name={row.name} size="md" uri={row.avatarUrl ?? undefined} />

        <View style={styles.body}>
          <AppText color="neutral" numberOfLines={1} variant="titleMd">
            {row.name}
          </AppText>

          {identity ? (
            <AppText color="neutralMuted" numberOfLines={1} variant="meta">
              {identity}
            </AppText>
          ) : null}

          {meta.length > 0 ? (
            <AppText color="neutralMuted" numberOfLines={2} variant="meta">
              {meta.join(" · ")}
            </AppText>
          ) : null}
        </View>

        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      </Pressable>
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
    minHeight: sizes.touchTarget + spacing[12],
    paddingVertical: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
});
