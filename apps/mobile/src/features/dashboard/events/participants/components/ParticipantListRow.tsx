/**
 * Riga del centro Partecipanti (DAS-REV-30 §22, §26; screen 11, 17, 23).
 *
 * Tre target distinti, mai sovrapposti (§22): l'area identità apre il
 * profilo live, la stella è quella Shortlist (§26, non una valutazione) e
 * «⋮» apre le azioni dell'evento. Senza comandi evento il terzo target
 * diventa un chevron verso il profilo (screen 23). Riga leggera: niente
 * card, voti, presenze o contatti.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import { PARTICIPANTS_COPY, PARTICIPANT_STATUS_LABELS, participantSubtitle } from "../participants-presentation";
import type { ParticipantRow } from "../participants-types";

export function ParticipantListRow({
  first,
  onManage,
  onOpenProfile,
  onStar,
  row,
}: {
  first: boolean;
  onManage: (() => void) | null;
  onOpenProfile: () => void;
  onStar: (() => void) | null;
  row: ParticipantRow;
}) {
  const subtitle = participantSubtitle(row);
  const status = PARTICIPANT_STATUS_LABELS[row.status];

  return (
    <View style={[styles.row, first ? null : styles.divider]} testID={`participant-${row.participationId}`}>
      <Pressable
        accessibilityHint={PARTICIPANTS_COPY.viewProfile}
        accessibilityLabel={[row.fullName, subtitle, status].filter(Boolean).join(", ")}
        accessibilityRole="button"
        onPress={onOpenProfile}
        style={({ pressed }) => [styles.identity, pressed ? styles.pressed : null]}
        testID={`participant-profile-${row.participationId}`}
      >
        <Avatar name={row.fullName} size="md" uri={row.avatarUrl ?? undefined} />
        <View style={styles.text}>
          <AppText color="neutral" numberOfLines={1} variant="titleSm">
            {row.fullName}
          </AppText>
          {subtitle ? (
            <AppText color="neutralMuted" numberOfLines={1} variant="meta">
              {subtitle}
            </AppText>
          ) : null}
          {/* §22: stato testuale sobrio, mai solo colore. */}
          <AppText color="neutral" numberOfLines={1} variant="metaStrong">
            {status}
          </AppText>
        </View>
      </Pressable>

      {onStar ? (
        <Pressable
          accessibilityLabel={
            row.star === "filled" ? `${row.fullName}: nella Shortlist` : `Aggiungi ${row.fullName} alla Shortlist`
          }
          accessibilityRole="button"
          hitSlop={4}
          onPress={onStar}
          style={({ pressed }) => [styles.target, pressed ? styles.pressed : null]}
          testID={`participant-star-${row.participationId}`}
        >
          {/* DAS-REV-26 §30: nero neutro, piena/vuota distinte dalla forma. */}
          <Ionicons
            color={colors.textNeutral}
            name={row.star === "filled" ? "star" : "star-outline"}
            size={20}
          />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityLabel={onManage ? PARTICIPANTS_COPY.manage(row.fullName) : PARTICIPANTS_COPY.openProfile(row.fullName)}
        accessibilityRole="button"
        hitSlop={4}
        onPress={onManage ?? onOpenProfile}
        style={({ pressed }) => [styles.target, pressed ? styles.pressed : null]}
        testID={onManage ? `participant-manage-${row.participationId}` : `participant-chevron-${row.participationId}`}
      >
        <Ionicons
          color={onManage ? colors.textNeutral : colors.textNeutralMuted}
          name={onManage ? "ellipsis-vertical" : "chevron-forward"}
          size={onManage ? 20 : 18}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  identity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  target: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  text: {
    flex: 1,
    gap: spacing[0],
  },
});
