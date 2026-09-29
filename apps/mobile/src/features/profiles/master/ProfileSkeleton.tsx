/**
 * Scheletro di caricamento del Master Profile (REV-PROF-03, "Loading").
 *
 * Riproduce l'ingombro reale della pagina — copertina, avatar, righe identità,
 * action bar, informazioni rapide, tab e contenuto — invece di uno spinner
 * centrale. Le misure sono le stesse dell'header vero, quindi quando i dati
 * arrivano il layout non si sposta.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { PROFILE_COVER_HEIGHT } from "./ProfileHeroHeader";

const AVATAR_SIZE = 104;
const AVATAR_OVERLAP = 46;
const QUICK_FACT_SLOTS = [0, 1, 2, 3];
const CONTENT_ROWS = [0, 1, 2];

export function ProfileSkeleton({ testID }: { testID?: string }) {
  return (
    // Un solo nodo accessibile: lo screen reader annuncia "caricamento", non
    // una dozzina di rettangoli vuoti.
    <View
      accessible
      accessibilityLabel="Caricamento del profilo in corso"
      accessibilityRole="progressbar"
      style={styles.container}
      testID={testID}
    >
      <View style={styles.cover} />
      <View style={styles.avatar} />

      <View style={styles.body}>
        <View style={[styles.line, styles.lineName]} />
        <View style={[styles.line, styles.lineRole]} />
        <View style={[styles.line, styles.lineMeta]} />
        <View style={[styles.line, styles.lineMeta]} />

        <View style={styles.actions}>
          <View style={styles.actionPrimary} />
          <View style={styles.actionIcon} />
          <View style={styles.actionIcon} />
        </View>
      </View>

      <View style={styles.quickFacts}>
        {QUICK_FACT_SLOTS.map((slot) => (
          <View key={slot} style={styles.quickFact}>
            <View style={[styles.line, styles.lineValue]} />
            <View style={[styles.line, styles.lineLabel]} />
          </View>
        ))}
      </View>

      <View style={styles.tabs}>
        {CONTENT_ROWS.map((slot) => (
          <View key={slot} style={[styles.line, styles.lineTab]} />
        ))}
      </View>

      <View style={styles.content}>
        {CONTENT_ROWS.map((slot) => (
          <View key={slot} style={styles.contentRow}>
            <View style={styles.contentLogo} />
            <View style={styles.contentText}>
              <View style={[styles.line, styles.lineRole]} />
              <View style={[styles.line, styles.lineMeta]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionIcon: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    width: 36,
  },
  actionPrimary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    flex: 1,
    height: 36,
    maxWidth: 170,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingTop: spacing[10],
  },
  avatar: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 3,
    height: AVATAR_SIZE + 6,
    marginLeft: spacing[16],
    marginTop: -AVATAR_OVERLAP,
    width: AVATAR_SIZE + 6,
  },
  body: {
    gap: spacing[6],
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
  },
  container: {
    backgroundColor: colors.surface,
  },
  content: {
    gap: spacing[18],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  contentLogo: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    width: 36,
  },
  contentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  contentText: {
    flex: 1,
    gap: spacing[8],
  },
  cover: {
    backgroundColor: colors.backgroundStrong,
    height: PROFILE_COVER_HEIGHT,
    width: "100%",
  },
  line: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
  },
  lineLabel: {
    height: 10,
    width: 44,
  },
  lineMeta: {
    height: 12,
    width: "45%",
  },
  lineName: {
    height: 26,
    width: "62%",
  },
  lineRole: {
    height: 16,
    width: "35%",
  },
  lineTab: {
    height: 14,
    width: 64,
  },
  lineValue: {
    height: 20,
    width: 38,
  },
  quickFact: {
    flexGrow: 1,
    gap: spacing[8],
    minWidth: 76,
    paddingHorizontal: spacing[12],
  },
  quickFacts: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[16],
  },
  tabs: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[24],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
});
