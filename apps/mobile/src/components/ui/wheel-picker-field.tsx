import { useState } from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../../ui/AppText/AppText";
import { Button } from "../../ui/Button/Button";
import { WheelPicker } from "./wheel-picker";

type WheelPickerFieldProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  unit: string;
  value: number | null | undefined;
};

export function WheelPickerField({
  label,
  max,
  min,
  onChange,
  step = 1,
  unit,
  value,
}: WheelPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<number>(
    value ?? Math.round((min + max) / 2),
  );

  const hasValue = value !== null && value !== undefined;
  const displayValue = hasValue ? `${value} ${unit}` : `-- ${unit}`;

  function handleOpen() {
    setDraftValue(value ?? Math.round((min + max) / 2));
    setIsOpen(true);
  }

  function handleConfirm() {
    onChange(draftValue);
    setIsOpen(false);
  }

  return (
    <>
      <View style={styles.wrapper}>
        <AppText variant="caption" color="primary" style={styles.label}>
          {label}
        </AppText>
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          onPress={handleOpen}
          style={styles.field}
        >
          <AppText
            variant="bodyLg"
            color={hasValue ? "primary" : "muted"}
            style={styles.fieldValue}
          >
            {displayValue}
          </AppText>
          <Ionicons
            name="chevron-expand"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <View style={styles.overlay}>
          <Pressable
            onPress={() => setIsOpen(false)}
            style={styles.overlayBackdrop}
          />
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetContent}>
              <AppText variant="headingSm" style={styles.sheetTitle}>
                {label}
              </AppText>
              <WheelPicker
                label=""
                max={max}
                min={min}
                onChange={setDraftValue}
                step={step}
                unit={unit}
                value={draftValue}
              />
              <Button
                label="Conferma"
                onPress={handleConfirm}
                variant="primary"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[8],
  },
  label: {
    fontWeight: "600",
  },
  field: {
    minHeight: 56,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[6],
    paddingHorizontal: spacing[16],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  fieldValue: {
    flex: 1,
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius[12],
    borderTopRightRadius: radius[12],
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing[8],
  },
  sheetContent: {
    padding: spacing[20],
    gap: spacing[20],
  },
  sheetTitle: {
    textAlign: "center",
  },
});
