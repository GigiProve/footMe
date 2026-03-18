import { useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../theme/tokens";
import {
  POSITION_ROLE_MAP,
  getPlayerPositionLabel,
  getPlayerPositionLabels,
  type FootballPositionSlot,
  type PlayerPosition,
} from "./player-sports";

const pitchSlots: {
  abbreviation: string;
  id: string;
  key: FootballPositionSlot;
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

type FootballPositionPickerProps = {
  errorMessage?: string;
  mode: "single" | "multiple";
  onSelect: (positions: PlayerPosition[]) => void;
  selectedPositions: PlayerPosition[];
  title: string;
};

function FootballNode({
  abbreviation,
  onPress,
  roleLabel,
  selected,
  testID,
}: {
  abbreviation: string;
  onPress: () => void;
  roleLabel: string;
  selected: boolean;
  testID: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animate(toValue: number, nextOpacity: number) {
    Animated.timing(scale, {
      duration: 120,
      toValue,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      duration: 120,
      toValue: nextOpacity,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ scale }],
      }}
    >
      <Pressable
        accessibilityLabel={roleLabel}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={() => animate(0.96, 0.86)}
        onPressOut={() => animate(1, 1)}
        style={[styles.nodeButton, selected ? styles.nodeButtonSelected : null]}
        testID={testID}
      >
        <Text style={[styles.nodeButtonText, selected ? styles.nodeButtonTextSelected : null]}>
          {abbreviation}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function FootballPositionPicker({
  errorMessage,
  mode,
  onSelect,
  selectedPositions,
  title,
}: FootballPositionPickerProps) {
  const normalizedSelected = useMemo(
    () => [...new Set(selectedPositions)],
    [selectedPositions],
  );

  const slotsByRow = useMemo(() => {
    return pitchSlots.reduce<Record<number, typeof pitchSlots>>((accumulator, slot) => {
      (accumulator[slot.row] = accumulator[slot.row] ?? []).push(slot);
      return accumulator;
    }, {});
  }, []);

  const selectedLabels = useMemo(
    () => getPlayerPositionLabels(normalizedSelected),
    [normalizedSelected],
  );

  function handleSlotPress(slot: FootballPositionSlot) {
    const nextPosition = POSITION_ROLE_MAP[slot];

    if (mode === "single") {
      onSelect([nextPosition]);
      return;
    }

    onSelect(
      normalizedSelected.includes(nextPosition)
        ? normalizedSelected.filter((entry) => entry !== nextPosition)
        : [...normalizedSelected, nextPosition],
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.pitchSurface}>
        <View pointerEvents="none" style={styles.centerLine} />
        <View pointerEvents="none" style={styles.centerCircle} />
        <View pointerEvents="none" style={styles.penaltyAreaTop} />
        <View pointerEvents="none" style={styles.penaltyAreaBottom} />

        <View style={styles.pitchRows}>
          {[0, 1, 2, 3, 4].map((rowIndex) => (
            <View key={rowIndex} style={styles.pitchRow}>
              {(slotsByRow[rowIndex] ?? []).map((slot) => {
                const role = POSITION_ROLE_MAP[slot.key];
                const selected = normalizedSelected.includes(role);

                return (
                  <FootballNode
                    abbreviation={slot.abbreviation}
                    key={slot.id}
                    onPress={() => handleSlotPress(slot.key)}
                    roleLabel={getPlayerPositionLabel(role)}
                    selected={selected}
                    testID={`football-position-${slot.id}`}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {mode === "single" ? (
        <View style={styles.feedbackBlock}>
          <Text style={styles.feedbackLabel}>Ruolo selezionato</Text>
          <Text style={styles.feedbackValue}>
            {selectedLabels[0] ?? "Seleziona il tuo ruolo principale per continuare."}
          </Text>
        </View>
      ) : (
        <View style={styles.feedbackBlock}>
          <Text style={styles.feedbackLabel}>Ruoli secondari selezionati</Text>
          {selectedLabels.length > 0 ? (
            <View style={styles.feedbackList}>
              {selectedLabels.map((label) => (
                <Text key={label} style={styles.feedbackListItem}>
                  {`• ${label}`}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.feedbackValue}>Nessun ruolo secondario selezionato.</Text>
          )}
        </View>
      )}

      {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[12],
  },
  label: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  pitchSurface: {
    overflow: "hidden",
    borderRadius: radius[24],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#0F7A3D",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[16],
  },
  centerLine: {
    position: "absolute",
    left: spacing[16],
    right: spacing[16],
    top: "50%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  centerCircle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 66,
    height: 66,
    marginLeft: -33,
    marginTop: -33,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  penaltyAreaTop: {
    position: "absolute",
    top: 0,
    left: "22%",
    right: "22%",
    height: 56,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  penaltyAreaBottom: {
    position: "absolute",
    bottom: 0,
    left: "22%",
    right: "22%",
    height: 56,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  pitchRows: {
    gap: spacing[12],
  },
  pitchRow: {
    minHeight: sizes.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[12],
  },
  nodeButton: {
    minWidth: 58,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.42)",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: spacing[10],
  },
  nodeButtonSelected: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  nodeButtonText: {
    color: colors.inkInvert,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.heavy,
    letterSpacing: typography.letterSpacing.sm,
  },
  nodeButtonTextSelected: {
    color: colors.accentStrong,
  },
  feedbackBlock: {
    gap: spacing[6],
    borderRadius: radius[16],
    backgroundColor: colors.surfaceMuted,
    padding: spacing[14],
  },
  feedbackLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  feedbackValue: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[22],
  },
  feedbackList: {
    gap: spacing[4],
  },
  feedbackListItem: {
    color: colors.textPrimary,
    lineHeight: typography.lineHeight[22],
  },
  errorMessage: {
    color: colors.danger,
    fontWeight: typography.fontWeight.bold,
  },
});
