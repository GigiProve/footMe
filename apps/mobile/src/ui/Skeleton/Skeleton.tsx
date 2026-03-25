import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "../../styles";

type SkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

function SkeletonRow({ style }: SkeletonProps) {
  return <View style={[styles.row, style]} />;
}

function SkeletonCircle({ style }: SkeletonProps) {
  return <View style={[styles.circle, style]} />;
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonCircle />
        <View style={styles.cardHeaderText}>
          <SkeletonRow style={styles.rowShort} />
          <SkeletonRow style={styles.rowShorter} />
        </View>
      </View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow style={styles.rowMedium} />
    </View>
  );
}

export const Skeleton = {
  Card: SkeletonCard,
  Circle: SkeletonCircle,
  Row: SkeletonRow,
};

const styles = StyleSheet.create({
  row: {
    height: 16,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    marginBottom: spacing[8],
    width: "100%",
  },
  rowShort: {
    width: "60%",
  },
  rowShorter: {
    width: "40%",
    height: 12,
    marginTop: spacing[6],
  },
  rowMedium: {
    width: "70%",
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    padding: spacing[16],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    marginBottom: spacing[12],
  },
  cardHeaderText: {
    flex: 1,
  },
});
