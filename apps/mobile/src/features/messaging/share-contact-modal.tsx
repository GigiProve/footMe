import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../../ui";

type ShareContactModalProps = {
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  phone: string;
  visible: boolean;
};

export function ShareContactModal({
  isLoading = false,
  onCancel,
  onConfirm,
  phone,
  visible,
}: ShareContactModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable onPress={onCancel} style={styles.overlay}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>Vuoi condividere il tuo numero di telefono con questo utente?</Text>
            <Text style={styles.body}>
              Il numero non è pubblico nel profilo. Verrà inviato solo in questa chat dopo la tua conferma esplicita.
            </Text>
            <Text style={styles.phone}>{phone}</Text>
          </View>
          <View style={styles.actions}>
            <Button
              label="Annulla"
              onPress={onCancel}
              style={styles.actionButton}
              variant="secondary"
            />
            <Button
              disabled={isLoading}
              label={isLoading ? "Condivisione..." : "Condividi"}
              onPress={onConfirm}
              style={styles.actionButton}
              variant="primary"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[12],
  },
  body: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  copyBlock: {
    gap: spacing[10],
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    padding: spacing[18],
  },
  phone: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
  },
  sheet: {
    gap: spacing[18],
    borderRadius: radius[24],
    backgroundColor: colors.surface,
    padding: spacing[20],
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[20],
    lineHeight: typography.lineHeight[28],
    fontWeight: typography.fontWeight.heavy,
  },
});
