import { type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";
import { Button } from "../Button/Button";

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
  children?: ReactNode;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  onConfirm,
  onCancel,
  isBusy = false,
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Chiudi"
        onPress={onCancel}
        style={styles.backdrop}
      />
      <View style={styles.centeredWrapper} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.body}>
            <AppText variant="headingSm" align="center">
              {title}
            </AppText>
            {message ? (
              <AppText
                variant="bodySm"
                color="secondary"
                align="center"
                style={styles.message}
              >
                {message}
              </AppText>
            ) : null}
            {children ? (
              <View style={styles.childrenSlot}>{children}</View>
            ) : null}
          </View>
          <View style={styles.footer}>
            <Button
              fullWidth
              label={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              disabled={isBusy}
            />
            <Button
              fullWidth
              label={isBusy ? "..." : confirmLabel}
              loading={isBusy}
              onPress={onConfirm}
              variant="primary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  centeredWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    width: "100%",
  },
  body: {
    padding: spacing[24],
    gap: spacing[8],
  },
  message: {
    marginTop: spacing[4],
  },
  childrenSlot: {
    marginTop: spacing[12],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
});
