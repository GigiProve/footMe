import { type ComponentProps, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { AppText, ConfirmModal, useToast } from "../../../ui";
import {
  hideTag,
  removeTag,
  type TaggedContentType,
  type TargetType,
} from "../content-tag-service";
import {
  CompactContentModule,
  type CompactContentModuleProps,
} from "./CompactContentModule";
import { ReportTagModal } from "./ReportTagModal";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

type ConfirmAction = "hide" | "remove";

type TagManageSheetProps = {
  content?: CompactContentModuleProps;
  contentType: TaggedContentType;
  onActionDone?: () => void;
  onClose: () => void;
  postId: string;
  taggedId: string;
  targetType?: TargetType;
  visible: boolean;
};

const ACTIONS: { action: "hide" | "remove" | "report"; icon: IoniconsName; label: string }[] = [
  { action: "hide", icon: "eye-off-outline", label: "Nascondi dal mio profilo" },
  { action: "remove", icon: "remove-circle-outline", label: "Rimuovi tag" },
  { action: "report", icon: "flag-outline", label: "Segnala contenuto" },
];

const CONFIRM_COPY: Record<
  ConfirmAction,
  { confirmLabel: string; message: string; successMessage: string; title: string; successIcon: IoniconsName }
> = {
  hide: {
    confirmLabel: "Nascondi",
    message:
      "Il contenuto resta pubblicato e il tag rimane nel post, ma non comparirà più nella tua sezione Media.",
    successIcon: "eye-off-outline",
    successMessage: "Contenuto nascosto dal tuo profilo",
    title: "Nascondi dal tuo profilo",
  },
  remove: {
    confirmLabel: "Rimuovi",
    message:
      "Il tuo profilo non sarà più collegato a questo contenuto e non comparirà più nella tua sezione Media.",
    successIcon: "remove-circle-outline",
    successMessage: "Tag rimosso",
    title: "Rimuovi tag",
  },
};

export function TagManageSheet({
  content,
  contentType,
  onActionDone,
  onClose,
  postId,
  taggedId,
  targetType = "profile",
  visible,
}: TagManageSheetProps) {
  const { showToast } = useToast();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isReportOpen, setReportOpen] = useState(false);
  const [isBusy, setBusy] = useState(false);

  function closeAll() {
    setConfirmAction(null);
    setReportOpen(false);
    setBusy(false);
    onClose();
  }

  async function handleConfirm() {
    if (!confirmAction || isBusy) {
      return;
    }

    const copy = CONFIRM_COPY[confirmAction];
    setBusy(true);
    try {
      if (confirmAction === "hide") {
        await hideTag(contentType, postId, taggedId, targetType);
      } else {
        await removeTag(contentType, postId, taggedId, targetType);
      }
      showToast({
        icon: copy.successIcon,
        message: copy.successMessage,
        tone: "success",
      });
      onActionDone?.();
      closeAll();
    } catch (error) {
      setBusy(false);
      setConfirmAction(null);
      const message =
        error instanceof Error ? error.message : "Operazione non riuscita.";
      Alert.alert("Operazione non riuscita", message);
    }
  }

  function handleAction(action: "hide" | "remove" | "report") {
    if (action === "report") {
      setReportOpen(true);
      return;
    }
    setConfirmAction(action);
  }

  const confirmCopy = confirmAction ? CONFIRM_COPY[confirmAction] : null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable accessibilityLabel="Chiudi" onPress={onClose} style={styles.overlay} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <AppText style={styles.heading} variant="titleSm">
          Gestisci tag
        </AppText>
        {content ? (
          <View style={styles.contentBlock}>
            <CompactContentModule {...content} />
          </View>
        ) : null}

        <View style={styles.actions}>
          {ACTIONS.map(({ action, icon, label }) => (
            <Pressable
              accessibilityRole="button"
              key={action}
              onPress={() => handleAction(action)}
              style={styles.actionRow}
            >
              <Ionicons color={colors.textSecondary} name={icon} size={20} />
              <AppText style={styles.actionLabel} variant="bodyLg">
                {label}
              </AppText>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
            </Pressable>
          ))}
        </View>
      </View>

      {confirmCopy ? (
        <ConfirmModal
          confirmLabel={confirmCopy.confirmLabel}
          isBusy={isBusy}
          message={confirmCopy.message}
          onCancel={() => (isBusy ? undefined : setConfirmAction(null))}
          onConfirm={handleConfirm}
          title={confirmCopy.title}
          visible={confirmAction !== null}
        >
          {content ? <CompactContentModule {...content} /> : null}
        </ConfirmModal>
      ) : null}

      <ReportTagModal
        content={content}
        contentType={contentType}
        onClose={() => setReportOpen(false)}
        onSubmitted={() => {
          onActionDone?.();
          closeAll();
        }}
        postId={postId}
        taggedId={taggedId}
        targetType={targetType}
        visible={isReportOpen}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    bottom: 0,
    left: 0,
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    position: "absolute",
    right: 0,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: 4,
    marginBottom: spacing[16],
    width: 40,
  },
  heading: {
    marginBottom: spacing[12],
  },
  contentBlock: {
    marginBottom: spacing[16],
  },
  actions: {
    gap: spacing[4],
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[14],
  },
  actionLabel: {
    flex: 1,
  },
});
