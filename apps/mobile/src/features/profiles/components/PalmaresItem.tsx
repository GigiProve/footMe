import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type PalmaresItemProps = {
  clubName: string;
  competitionName: string;
  seasonLabel: string;
  type: "trophy" | "medal" | "top_scorer";
};

function getIconName(type: PalmaresItemProps["type"]): string {
  switch (type) {
    case "trophy": return "trophy-outline";
    case "medal": return "medal-outline";
    case "top_scorer": return "football-outline";
  }
}

export function PalmaresItem({ clubName, competitionName, seasonLabel, type }: PalmaresItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons
          color={colors.gold}
          name={getIconName(type) as "trophy-outline"}
          size={24}
        />
      </View>
      <View style={styles.details}>
        <AppText variant="titleSm">{competitionName}</AppText>
        <AppText variant="bodySm" color="secondary">{seasonLabel}</AppText>
        <AppText variant="bodySm" style={styles.clubName}>{clubName}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clubName: {
    fontWeight: "600",
  },
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[4],
  },
  details: {
    flex: 1,
    gap: spacing[4],
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 48,
    justifyContent: "center",
    width: 48,
  },
});
