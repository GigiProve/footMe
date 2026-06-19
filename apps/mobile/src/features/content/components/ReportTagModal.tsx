import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { EditModalShell } from "../../profiles/edit-modals/EditModalShell";
import { spacing } from "../../../styles";
import { AppText, Input, Radio, useToast } from "../../../ui";
import {
  REPORT_REASON_LABELS,
  reportTag,
  type ReportReason,
  type TaggedContentType,
  type TargetType,
} from "../content-tag-service";
import {
  CompactContentModule,
  type CompactContentModuleProps,
} from "./CompactContentModule";

const REASON_ORDER: ReportReason[] = [
  "info_non_corrette",
  "uso_improprio",
  "contenuto_offensivo",
  "spam",
  "altro",
];

type ReportTagModalProps = {
  content?: CompactContentModuleProps;
  contentType: TaggedContentType;
  onClose: () => void;
  onSubmitted?: () => void;
  postId: string;
  taggedId: string;
  targetType?: TargetType;
  visible: boolean;
};

export function ReportTagModal({
  content,
  contentType,
  onClose,
  onSubmitted,
  postId,
  taggedId,
  targetType = "profile",
  visible,
}: ReportTagModalProps) {
  const { showToast } = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setReason(null);
    setNote("");
    setIsSaving(false);
  }

  function handleClose() {
    if (isSaving) {
      return;
    }
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!reason || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await reportTag(
        contentType,
        postId,
        taggedId,
        reason,
        note.trim() || undefined,
        targetType,
      );
      showToast({
        icon: "flag-outline",
        message: "Segnalazione inviata",
        tone: "success",
      });
      reset();
      onSubmitted?.();
      onClose();
    } catch (error) {
      setIsSaving(false);
      const message =
        error instanceof Error ? error.message : "Operazione non riuscita.";
      Alert.alert("Segnalazione non riuscita", message);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={handleClose}
      onSave={handleSubmit}
      saveDisabled={!reason}
      saveLabel="Invia segnalazione"
      title="Segnala contenuto"
      visible={visible}
    >
      {content ? <CompactContentModule {...content} /> : null}

      <View style={styles.reasons}>
        <AppText color="secondary" variant="bodySm">
          Per quale motivo vuoi segnalare questo contenuto?
        </AppText>
        {REASON_ORDER.map((value) => (
          <Radio
            checked={reason === value}
            key={value}
            label={REPORT_REASON_LABELS[value]}
            onPress={() => setReason(value)}
          />
        ))}
      </View>

      <Input
        label="Note (facoltativo)"
        multiline
        onChangeText={setNote}
        placeholder="Aggiungi dettagli sulla segnalazione"
        value={note}
      />
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  reasons: {
    gap: spacing[4],
  },
});
