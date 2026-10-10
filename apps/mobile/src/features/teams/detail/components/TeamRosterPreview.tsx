import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import {
  rosterSummaryAccessibilityLabel,
  rosterSummaryLine,
} from "../team-detail-presentation";
import type { TeamRosterAvatar } from "../team-detail-service";

/** §11: «Mostrare massimo quattro avatar circolari». */
const MAX_AVATARS = 4;

/**
 * Anteprima dell'Organico (§11, §12).
 *
 * Gli avatar sono **una preview del modulo**, non quattro scorciatoie ai
 * profili: non sono tappabili, non portano nome, ruolo, numero di maglia o
 * badge +N, e per lo screen reader sono decorativi — l'informazione
 * annunciata è il conteggio, una volta sola.
 *
 * Un errore degli avatar non elimina il conteggio e un conteggio non
 * disponibile non diventa zero: sono tre stati distinti e il componente non
 * li fonde mai.
 */
export function TeamRosterPreview({
  avatars,
  onInvite,
  playersCount,
  staffCount,
}: {
  avatars: TeamRosterAvatar[];
  /** `null` quando invitare non è consentito: niente pulsante impossibile. */
  onInvite: (() => void) | null;
  playersCount: number | null;
  staffCount: number | null;
}) {
  const summary = rosterSummaryLine({
    rosterPlayersCount: playersCount,
    rosterStaffCount: staffCount,
  });

  // Vuoto **reale**: entrambi i conteggi noti e pari a zero. Un conteggio
  // assente significa "non consultabile" e non autorizza questa frase (§12).
  if (playersCount === 0 && staffCount === 0) {
    return (
      <View style={styles.empty} testID="team-roster-empty">
        <View style={styles.emptyHeader}>
          <Ionicons color={colors.textMuted} name="people-outline" size={22} />

          <View style={styles.emptyBody}>
            <AppText variant="titleSm">Nessuna persona ancora collegata</AppText>

            <AppText color="secondary" variant="bodySm">
              Invita calciatori, allenatori, staff e dirigenti.
            </AppText>
          </View>
        </View>

        {onInvite ? (
          <Button
            fullWidth
            label="Invita persona"
            onPress={onInvite}
            testID="team-roster-invite"
            textStyle={styles.outlineLabel}
            variant="outline"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {avatars.length > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.avatars}
          testID="team-roster-avatars"
        >
          {avatars.slice(0, MAX_AVATARS).map((avatar) => (
            <Avatar
              initials={avatar.initials}
              key={avatar.id}
              size="md"
              uri={avatar.avatarUrl ?? undefined}
            />
          ))}
        </View>
      ) : null}

      {summary ? (
        <AppText
          accessibilityLabel={
            rosterSummaryAccessibilityLabel({
              rosterPlayersCount: playersCount,
              rosterStaffCount: staffCount,
            }) ?? undefined
          }
          color="muted"
          variant="caption"
        >
          {summary}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[10],
  },
  avatars: {
    flexDirection: "row",
    gap: spacing[8],
  },
  empty: {
    gap: spacing[12],
  },
  emptyHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  emptyBody: {
    flex: 1,
    gap: spacing[4],
  },
  outlineLabel: {
    color: colors.textPrimary,
  },
});
