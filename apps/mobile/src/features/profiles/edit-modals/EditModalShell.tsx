import { Modal, SafeAreaView, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { colors, spacing } from "../../../theme/tokens";
import { Button, ModalHeader } from "../../../ui";

type EditModalShellProps = {
  children: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  title: string;
  visible: boolean;
};

export function EditModalShell({
  children,
  isSaving,
  onClose,
  onSave,
  saveLabel = "Salva",
  title,
  visible,
}: EditModalShellProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.root}>
        <ModalHeader onClose={onClose} title={title} />

        <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
          {children}
        </KeyboardAwareForm>

        <View style={styles.footer}>
          <Button
            disabled={isSaving}
            label={isSaving ? "Salvataggio..." : saveLabel}
            onPress={onSave}
            variant="primary"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: spacing[16],
    padding: spacing[20],
  },
});
