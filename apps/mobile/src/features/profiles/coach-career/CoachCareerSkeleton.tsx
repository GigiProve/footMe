/**
 * Caricamento della gestione carriera (REV-PROF-04).
 *
 * Skeleton e non uno spinner centrale: la app bar e la struttura sono già a
 * schermo, quindi quello che manca è il contenuto delle card — ed è quello che
 * va rappresentato.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { Skeleton } from "../../../ui";

export function CoachCareerSkeleton() {
  return (
    <View
      accessibilityLabel="Caricamento della carriera"
      accessible
      style={styles.container}
      testID="coach-career-skeleton"
    >
      <Skeleton.Row style={styles.eyebrow} />

      {[0, 1].map((index) => (
        <View key={index} style={styles.card}>
          <View style={styles.header}>
            <Skeleton.Circle style={styles.logo} />
            <View style={styles.headerText}>
              <Skeleton.Row style={styles.title} />
              <Skeleton.Row style={styles.meta} />
            </View>
          </View>
          <Skeleton.Row style={styles.summary} />
        </View>
      ))}

      <Skeleton.Row style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  eyebrow: {
    height: 12,
    marginBottom: 0,
    width: "40%",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    padding: spacing[16],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  logo: {
    height: 40,
    width: 40,
  },
  headerText: {
    flex: 1,
  },
  title: {
    marginBottom: spacing[6],
    width: "60%",
  },
  meta: {
    height: 12,
    marginBottom: 0,
    width: "40%",
  },
  summary: {
    height: 12,
    marginBottom: 0,
    marginTop: spacing[12],
    width: "35%",
  },
  cta: {
    borderRadius: radius.full,
    height: 44,
    marginBottom: 0,
  },
});
