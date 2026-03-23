import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type CareerCardProps = {
  appearances?: number;
  assists?: number;
  category: string;
  goals?: number;
  season: string;
  teamInitials: string;
  teamName: string;
};

export function CareerCard({
  appearances,
  assists,
  category,
  goals,
  season,
  teamInitials,
  teamName,
}: CareerCardProps) {
  const hasStats =
    appearances !== undefined || goals !== undefined || assists !== undefined;

  return (
    <View style={styles.card}>
      <View style={styles.logoBox}>
        <AppText variant="bodySm" color="muted">
          {teamInitials}
        </AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <AppText variant="bodySm">{teamName}</AppText>
          <AppText variant="caption" color="muted" style={styles.season}>
            {season}
          </AppText>
        </View>
        <AppText variant="bodySm" color="muted" style={styles.category}>
          {category}
        </AppText>
        {hasStats ? (
          <View style={styles.statsRow}>
            {appearances !== undefined ? (
              <StatCell label="Pres" value={appearances} />
            ) : null}
            {goals !== undefined ? (
              <StatCell label="Gol" value={goals} />
            ) : null}
            {assists !== undefined ? (
              <StatCell label="Assist" value={assists} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCell}>
      <AppText variant="titleSm" color="accent">
        {String(value)}
      </AppText>
      <AppText variant="bodySm" color="muted" style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
    backgroundColor: colors.background,
    borderRadius: radius[8],
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: radius[8],
    backgroundColor: colors.backgroundStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  season: {
    fontSize: typography.fontSize[12],
  },
  category: {
    fontSize: typography.fontSize[12],
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing[16],
    marginTop: spacing[8],
  },
  statCell: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: typography.fontSize[10],
  },
});
