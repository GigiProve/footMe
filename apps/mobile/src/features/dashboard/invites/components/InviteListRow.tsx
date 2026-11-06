import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import { INVITES_COPY, contextLine, stateLine } from "../invites-presentation";
import type { InviteRow } from "../invites-types";

type Props = {
  now?: Date;
  onPress: () => void;
  row: InviteRow;
  showDivider: boolean;
};

/**
 * Riga del Centro (§12, screen 01 e 02).
 *
 * «Avatar quando disponibile, nome della persona, ruolo/contesto
 * professionale necessario, squadra oppure Intera società, stato, data e
 * apertura … La priorità visuale è sul nome e sull'incarico.»
 *
 * Un solo target: §12 vieta azioni inline — «Non mostrare Accetta, Rifiuta,
 * Approva, Annulla, Reinvia o Messaggia come azioni inline nella lista». Il
 * chevron è decorativo e la riga intera apre il record.
 *
 * `Nuova` è un **indicatore di lettura**, distinto dallo stato operativo
 * (§5, §15): compare accanto al nome, mentre «In attesa» resta nella riga di
 * stato. Non è comunicato dal solo colore — è una parola, ed entra
 * nell'etichetta annunciata dal lettore di schermo (§45).
 */
export function InviteListRow({ now, onPress, row, showDivider }: Props) {
  const context = contextLine(row);
  const state = stateLine(row, now);
  const unread = row.isUnread;

  return (
    <Pressable
      accessibilityLabel={[
        row.personName,
        unread ? INVITES_COPY.newBadge : null,
        context,
        state,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider ? styles.divided : null,
        pressed ? styles.pressed : null,
      ]}
      testID={`invite-row-${row.id}`}
    >
      <Avatar name={row.personName} size="md" uri={row.avatarUrl ?? undefined} />

      <View style={styles.body}>
        <View style={styles.nameLine}>
          <AppText
            color="neutral"
            numberOfLines={1}
            style={styles.name}
            variant="titleSm"
          >
            {row.personName}
          </AppText>

          {unread ? (
            <View style={styles.newBadge}>
              <View style={styles.newDot} />
              <AppText color="accent" variant="meta">
                {INVITES_COPY.newBadge}
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText color="neutralMuted" numberOfLines={2} variant="bodySm">
          {context}
        </AppText>

        <AppText color="neutralSoft" numberOfLines={1} variant="meta">
          {state}
        </AppText>
      </View>

      <Ionicons
        color={colors.textNeutralSoft}
        name="chevron-forward"
        size={18}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  nameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  name: {
    flexShrink: 1,
    fontWeight: "600",
  },
  newBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  newDot: {
    backgroundColor: colors.accent,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  pressed: {
    opacity: 0.6,
  },
});
