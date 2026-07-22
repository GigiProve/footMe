import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { ActionSheet, AppText } from "../../../ui";

type ChatComposerProps = {
  blocked?: boolean;
  draft: string;
  isSending: boolean;
  isUploading: boolean;
  onChangeDraft: (value: string) => void;
  onPickDocument: () => void;
  onPickMedia: () => void;
  onSend: () => void;
  onShareContact: () => void;
};

export function ChatComposer({
  blocked = false,
  draft,
  isSending,
  isUploading,
  onChangeDraft,
  onPickDocument,
  onPickMedia,
  onSend,
  onShareContact,
}: ChatComposerProps) {
  const [isAttachSheetVisible, setIsAttachSheetVisible] = useState(false);

  if (blocked) {
    return (
      <View style={styles.blockedBar}>
        <Ionicons color={colors.textMuted} name="ban-outline" size={16} />
        <View style={styles.blockedTextWrap}>
          <AppText color="muted" variant="bodySm">
            Hai bloccato questo utente
          </AppText>
        </View>
      </View>
    );
  }

  const canSend = draft.trim().length > 0 && !isSending;

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Allega file"
        accessibilityRole="button"
        disabled={isUploading}
        onPress={() => setIsAttachSheetVisible(true)}
        style={styles.attachButton}
      >
        {isUploading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <Ionicons color={colors.textPrimary} name="add" size={20} />
        )}
      </Pressable>

      <View style={styles.inputWrap}>
        <TextInput
          multiline
          onChangeText={onChangeDraft}
          placeholder="Scrivi un messaggio..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft}
        />
      </View>

      <Pressable
        accessibilityLabel="Invia messaggio"
        accessibilityRole="button"
        disabled={!canSend}
        onPress={onSend}
        style={[styles.sendButton, !canSend ? styles.sendButtonDisabled : null]}
      >
        {isSending ? (
          <ActivityIndicator color={colors.inkInvert} size="small" />
        ) : (
          <Ionicons color={colors.inkInvert} name="send" size={18} />
        )}
      </Pressable>

      <ActionSheet
        actions={[
          {
            icon: "image-outline",
            label: "Foto o video",
            onPress: onPickMedia,
          },
          {
            icon: "document-text-outline",
            label: "Documento",
            onPress: onPickDocument,
          },
          {
            icon: "call-outline",
            label: "Condividi contatto",
            onPress: onShareContact,
          },
        ]}
        onClose={() => setIsAttachSheetVisible(false)}
        title="Allega"
        visible={isAttachSheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  attachButton: {
    alignItems: "center",
    backgroundColor: colors.chatComposerField,
    borderRadius: radius.full,
    height: sizes.chatComposerButton,
    justifyContent: "center",
    width: sizes.chatComposerButton,
  },
  bar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  blockedBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  blockedTextWrap: {
    flex: 1,
  },
  input: {
    color: colors.textPrimary,
    maxHeight: 96,
    paddingVertical: 0,
  },
  inputWrap: {
    backgroundColor: colors.chatComposerField,
    borderColor: colors.chatComposerBorder,
    borderRadius: radius.full,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: sizes.chatComposerButton,
    justifyContent: "center",
    width: sizes.chatComposerButton,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
