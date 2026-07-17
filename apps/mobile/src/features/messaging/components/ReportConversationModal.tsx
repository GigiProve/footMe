import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, ChipGroup, Input } from "../../../ui";
import { EditModalShell } from "../../profiles/edit-modals/EditModalShell";
import { REPORT_REASONS } from "../chat-helpers";
import type { ConversationReportReason } from "../messaging-service";

type ReportConversationModalProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: { reason: ConversationReportReason; details?: string }) => void;
  visible: boolean;
};

export function ReportConversationModal({
  isSubmitting,
  onClose,
  onSubmit,
  visible,
}: ReportConversationModalProps) {
  const [reason, setReason] = useState<ConversationReportReason | null>(null);
  const [details, setDetails] = useState("");

  function handleClose() {
    setReason(null);
    setDetails("");
    onClose();
  }

  function handleSubmit() {
    if (!reason) {
      return;
    }

    onSubmit({ details: details.trim() || undefined, reason });
  }

  return (
    <EditModalShell
      isSaving={isSubmitting}
      onClose={handleClose}
      onSave={handleSubmit}
      saveDisabled={!reason}
      saveLabel="Invia segnalazione"
      title="Segnala conversazione"
      visible={visible}
    >
      <View style={styles.content}>
        <AppText color="muted" variant="bodySm">
          Scegli il motivo principale della segnalazione
        </AppText>
        <ChipGroup
          onChange={(value) => setReason(value)}
          options={REPORT_REASONS}
          value={reason}
        />
        <Input
          label="Aggiungi dettagli opzionali"
          multiline
          onChangeText={setDetails}
          placeholder="Scrivi qui ulteriori dettagli..."
          value={details}
        />
      </View>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
  },
});
