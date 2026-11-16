import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { ActionSheet } from "../../../ui";

type ChatComposerProps = {
  /** DAS-REV-32 §25: nei GROUP la condivisione contatto non esiste (il server la rifiuta). */
  allowContactShare?: boolean;
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
  allowContactShare = true,
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

  /*
    HOM-12 §90, §98, §113, §246: con un Block attivo il composer resta al suo posto ma
    disabilitato (in sola lettura, semanticamente esplicito). Il testo già digitato NON
    si cancella: la bozza vive nella schermata e qui si mostra com'è. Lo stato del Block
    lo racconta la riga sopra il composer (blocker) o l'avviso neutro (bloccato).
  */
  const canSend = !blocked && draft.trim().length > 0 && !isSending;

  return (
    <View
      accessibilityState={{ disabled: blocked }}
      style={[styles.bar, blocked ? styles.barDisabled : null]}
      testID={blocked ? "chat-composer-disabled" : undefined}
    >
      <Pressable
        accessibilityLabel="Allega file"
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked || isUploading }}
        disabled={blocked || isUploading}
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
          accessibilityHint={blocked ? "Non puoi scrivere in questa conversazione." : undefined}
          accessibilityState={{ disabled: blocked }}
          editable={!blocked}
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
        accessibilityState={{ disabled: !canSend }}
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
          ...(allowContactShare
            ? [
                {
                  icon: "call-outline" as const,
                  label: "Condividi contatto",
                  onPress: onShareContact,
                },
              ]
            : []),
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
  barDisabled: {
    opacity: 0.5,
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
