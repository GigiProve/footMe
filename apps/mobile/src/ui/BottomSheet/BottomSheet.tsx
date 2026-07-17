import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../AppText/AppText";

export type BottomSheetProps = {
  children: ReactNode;
  onClose: () => void;
  onDismiss?: () => void;
  title?: string;
  visible: boolean;
};

export function BottomSheet({
  children,
  onClose,
  onDismiss,
  title,
  visible,
}: BottomSheetProps) {
  // Il Modal resta montato anche quando non visibile (come ActionSheet):
  // smontarlo impedirebbe la consegna di onDismiss su iOS, su cui si
  // appoggiano gli handoff sheet -> modal full-screen.
  return (
    <Modal
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Chiudi"
        onPress={onClose}
        style={styles.overlay}
      >
        <Pressable style={styles.sheet}>
          {title ? (
            <View style={styles.header}>
              <AppText
                numberOfLines={1}
                style={styles.title}
                variant="titleMd"
              >
                {title}
              </AppText>
              <Pressable
                accessibilityLabel="Chiudi"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons color={colors.textPrimary} name="close" size={22} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.body}>{children}</View>
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
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  title: {
    flex: 1,
  },
  closeButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    gap: spacing[4],
  },
});
