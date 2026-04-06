import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { POSITION_ROLE_MAP, type PlayerPosition } from "../player-sports";

const pitchSlots: {
  abbreviation: string;
  id: string;
  key: keyof typeof POSITION_ROLE_MAP;
  row: number;
}[] = [
  { abbreviation: "AS", id: "left-winger", key: "left_winger", row: 0 },
  { abbreviation: "ATT", id: "striker", key: "striker", row: 0 },
  { abbreviation: "AD", id: "right-winger", key: "right_winger", row: 0 },
  { abbreviation: "TRQ", id: "attacking-midfielder", key: "attacking_midfielder", row: 1 },
  { abbreviation: "CEN", id: "central-midfielder", key: "central_midfielder", row: 2 },
  { abbreviation: "MED", id: "defensive-midfielder", key: "defensive_midfielder", row: 2 },
  { abbreviation: "TS", id: "left-back", key: "left_back", row: 3 },
  { abbreviation: "DIF", id: "center-back-left", key: "center_back", row: 3 },
  { abbreviation: "DIF", id: "center-back-right", key: "center_back", row: 3 },
  { abbreviation: "TD", id: "right-back", key: "right_back", row: 3 },
  { abbreviation: "POR", id: "goalkeeper", key: "goalkeeper", row: 4 },
];

type ReadonlyPositionPitchProps = {
  primaryPosition: PlayerPosition;
  secondaryPositions: PlayerPosition[];
};

export function ReadonlyPositionPitch({
  primaryPosition,
  secondaryPositions,
}: ReadonlyPositionPitchProps) {
  const slotsByRow = pitchSlots.reduce<Record<number, typeof pitchSlots>>(
    (acc, slot) => {
      (acc[slot.row] = acc[slot.row] ?? []).push(slot);
      return acc;
    },
    {},
  );

  return (
    <View>
      <View style={styles.pitch}>
        <View pointerEvents="none" style={styles.centerLine} />
        <View pointerEvents="none" style={styles.centerCircle} />
        <View pointerEvents="none" style={styles.penaltyAreaTop} />
        <View pointerEvents="none" style={styles.penaltyAreaBottom} />

        <View style={styles.pitchRows}>
          {[0, 1, 2, 3, 4].map((rowIndex) => (
            <View key={rowIndex} style={styles.pitchRow}>
              {(slotsByRow[rowIndex] ?? []).map((slot) => {
                const role = POSITION_ROLE_MAP[slot.key];
                const isPrimary = role === primaryPosition;
                const isSecondary = !isPrimary && secondaryPositions.includes(role);

                return (
                  <View
                    key={slot.id}
                    style={[
                      styles.node,
                      isPrimary
                        ? styles.nodePrimary
                        : isSecondary
                          ? styles.nodeSecondary
                          : styles.nodeUnselected,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotPrimary]} />
          <AppText variant="bodySm" style={styles.legendLabel}>
            Principale
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotSecondary]} />
          <AppText variant="bodySm" style={styles.legendLabel}>
            Secondari
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerCircle: {
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 30,
    borderWidth: 2,
    height: 60,
    left: "50%",
    marginLeft: -30,
    marginTop: -30,
    position: "absolute",
    top: "50%",
    width: 60,
  },
  centerLine: {
    borderColor: "rgba(255,255,255,0.4)",
    borderTopWidth: 2,
    left: 0,
    position: "absolute",
    right: 0,
    top: "50%",
  },
  legend: {
    flexDirection: "row",
    gap: spacing[24],
    justifyContent: "center",
    marginTop: spacing[12],
  },
  legendDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  legendDotPrimary: {
    backgroundColor: "#1e3a8a",
  },
  legendDotSecondary: {
    backgroundColor: "#60a5fa",
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  legendLabel: {
    color: colors.textSecondary,
  },
  node: {
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  nodePrimary: {
    backgroundColor: "#1e3a8a",
    borderColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    width: 24,
  },
  nodeSecondary: {
    backgroundColor: "#60a5fa",
    borderColor: "#fff",
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  nodeUnselected: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
  },
  penaltyAreaBottom: {
    borderColor: "rgba(255,255,255,0.4)",
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    bottom: 0,
    height: "16%",
    left: "25%",
    position: "absolute",
    right: "25%",
  },
  penaltyAreaTop: {
    borderBottomWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    borderLeftWidth: 2,
    borderRightWidth: 2,
    height: "16%",
    left: "25%",
    position: "absolute",
    right: "25%",
    top: 0,
  },
  pitch: {
    backgroundColor: "#15803d",
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: radius[8],
    borderWidth: 2,
    minHeight: 220,
    overflow: "hidden",
    padding: spacing[16],
  },
  pitchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "center",
    minHeight: 28,
  },
  pitchRows: {
    gap: spacing[12],
  },
});
