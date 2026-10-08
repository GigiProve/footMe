/**
 * Bottom sheet "Crea" del Master Profile Tifoso (REV-PROF-19, Screen 3).
 *
 * Quattro destinazioni, sempre le stesse quattro, in quest'ordine. Il foglio
 * non crea niente: sceglie quale composer già esistente aprire.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet } from "../../../ui";

/**
 * Le quattro azioni. `photo` apre l'uploader Media condiviso: foto e video
 * sono la stessa destinazione, come nel mockup.
 */
export type FanCreateAction = "opinion" | "poll" | "formation" | "photo";

type FanCreateOption = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: FanCreateAction;
};

const OPTIONS: readonly FanCreateOption[] = [
  { icon: "create-outline", label: "Scrivi un'opinione", value: "opinion" },
  { icon: "stats-chart-outline", label: "Crea un sondaggio", value: "poll" },
  { icon: "football-outline", label: "Crea una formazione", value: "formation" },
  { icon: "videocam-outline", label: "Pubblica foto o video", value: "photo" },
];

type FanCreateSheetProps = {
  /**
   * Azioni non disponibili: restano visibili e annunciate come disattivate,
   * invece di sparire e far cambiare forma al foglio fra una sessione e
   * l'altra.
   */
  disabledActions?: readonly FanCreateAction[];
  onClose: () => void;
  onSelect: (action: FanCreateAction) => void;
  visible: boolean;
};

export function FanCreateSheet({
  disabledActions = [],
  onClose,
  onSelect,
  visible,
}: FanCreateSheetProps) {
  const disabled = new Set(disabledActions);

  return (
    <BottomSheet onClose={onClose} title="Crea" visible={visible}>
      <View testID="fan-create-sheet">
        {OPTIONS.map((option) => {
          const isDisabled = disabled.has(option.value);

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              disabled={isDisabled}
              key={option.value}
              onPress={() => {
                onClose();
                onSelect(option.value);
              }}
              style={({ pressed }) => [
                styles.row,
                isDisabled ? styles.rowDisabled : null,
                pressed && !isDisabled ? styles.rowPressed : null,
              ]}
              testID={`fan-create-option-${option.value}`}
            >
              <View style={styles.iconShell}>
                <Ionicons color={colors.accent} name={option.icon} size={20} />
              </View>
              <AppText style={styles.label} variant="titleSm">
                {option.label}
              </AppText>
              <Ionicons
                color={colors.textMuted}
                name="chevron-forward"
                size={18}
              />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[12],
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  label: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    // 44x44 di area toccabile anche con Dynamic Type al minimo.
    minHeight: 56,
    paddingVertical: spacing[8],
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowPressed: {
    opacity: 0.6,
  },
});
