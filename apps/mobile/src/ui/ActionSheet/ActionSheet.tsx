import { Modal, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../AppText/AppText";

export type ActionSheetAction = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  destructive?: boolean;
  onPress: () => void;
};

type ActionSheetProps = {
  actions: ActionSheetAction[];
  cancelLabel?: string;
  message?: string;
  onClose: () => void;
  title?: string;
  visible: boolean;
};

export function ActionSheet({
  actions,
  cancelLabel = "Annulla",
  message,
  onClose,
  title,
  visible,
}: ActionSheetProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Chiudi menu"
        onPress={onClose}
        style={styles.overlay}
      >
        <Pressable style={styles.sheet}>
          {title ? (
            <AppText align="center" style={styles.title} variant="titleMd">
              {title}
            </AppText>
          ) : null}
          {message ? (
            <AppText
              align="center"
              color="muted"
              style={styles.message}
              variant="bodySm"
            >
              {message}
            </AppText>
          ) : null}
          {actions.map((action) => (
            <Pressable
              accessibilityRole="button"
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.row,
                pressed ? styles.pressed : null,
              ]}
            >
              {action.icon ? (
                <Ionicons
                  color={action.destructive ? colors.danger : colors.textPrimary}
                  name={action.icon}
                  size={20}
                />
              ) : null}
              <View style={styles.rowText}>
                <AppText
                  color={action.destructive ? "danger" : "primary"}
                  variant="bodyLg"
                >
                  {action.label}
                </AppText>
                {action.subtitle ? (
                  <AppText color="muted" variant="caption">
                    {action.subtitle}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              pressed ? styles.pressed : null,
            ]}
          >
            <AppText variant="titleSm">{cancelLabel}</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 16, 37, 0.45)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
    paddingBottom: spacing[32],
    gap: spacing[4],
  },
  title: {
    marginBottom: spacing[8],
  },
  message: {
    marginBottom: spacing[16],
    paddingHorizontal: spacing[16],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
    paddingVertical: spacing[14],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[12],
    paddingVertical: spacing[14],
  },
});
