import { SHORTLIST_QK_PREFIXES } from "../../dashboard/shortlist/shortlist-keys";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EditModalShell } from "../../profiles/edit-modals/EditModalShell";
import { useToast } from "../../../ui";
import {
  updateShortlistEntry,
  type ShortlistEntry,
  type ShortlistEvaluationStatus,
  type ShortlistPriority,
} from "../shortlist-service";
import { EvaluationFields } from "./EvaluationFields";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

type EditEvaluationModalProps = {
  canAddNotes: boolean;
  canEditStatus: boolean;
  clubId: string;
  entry: ShortlistEntry;
  listId: string;
  listName: string;
  onClose: () => void;
  visible: boolean;
};

export function EditEvaluationModal({
  canAddNotes,
  canEditStatus,
  clubId,
  entry,
  listId,
  listName,
  onClose,
  visible,
}: EditEvaluationModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [priority, setPriority] = useState<ShortlistPriority | null>(
    entry.priority,
  );
  const [status, setStatus] = useState<ShortlistEvaluationStatus>(
    entry.evaluation_status,
  );
  const [note, setNote] = useState(entry.internal_note ?? "");

  useEffect(() => {
    if (visible) {
      setPriority(entry.priority);
      setStatus(entry.evaluation_status);
      setNote(entry.internal_note ?? "");
    }
  }, [visible, entry]);

  const mutation = useMutation({
    mutationFn: () => {
      const patch: {
        /* §17: `null` significa «togli la priorità», non «lascia com'è» —
           la distinzione la fa `p_set_priority` lato RPC. */
        priority?: ShortlistPriority | null;
        evaluationStatus?: ShortlistEvaluationStatus;
        internalNote?: string | null;
      } = {};

      if (canEditStatus) {
        patch.priority = priority;
        patch.evaluationStatus = status;
      }

      if (canAddNotes) {
        const trimmedNote = note.trim();
        const originalNote = (entry.internal_note ?? "").trim();

        if (trimmedNote !== originalNote) {
          patch.internalNote = trimmedNote.length > 0 ? trimmedNote : null;
        }
      }

      return updateShortlistEntry(entry.id, patch);
    },
    onError: (error) => {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile salvare la valutazione.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortlist-entries", listId] });
      queryClient.invalidateQueries({ queryKey: ["shortlists", clubId] });
      queryClient.invalidateQueries({ queryKey: ["shortlist-overview", clubId] });

      /* §28: dopo modifica di valutazione o nota il Centro Shortlist deve riflettere count,
         righe e stella. Le sue chiavi vivono nel modulo della Dashboard e
         non sono raggiunte dai prefissi legacy qui sopra. */
      for (const prefix of SHORTLIST_QK_PREFIXES) {
        queryClient.invalidateQueries({ queryKey: [prefix] });
      }
      queryClient.invalidateQueries({
        queryKey: ["shortlist-memberships", entry.player_profile_id],
      });
      onClose();
      showToast({ message: "Valutazione aggiornata", tone: "success" });
    },
  });

  return (
    <EditModalShell
      isSaving={mutation.isPending}
      onClose={onClose}
      onSave={() => mutation.mutate()}
      saveLabel="Salva modifiche"
      title="Modifica valutazione"
      visible={visible}
    >
      <ProfileSummaryCard
        avatarUrl={entry.avatar_url}
        fullName={entry.full_name ?? "Profilo"}
        subtitle={`Lista: ${listName}`}
      />
      <EvaluationFields
        canEditNote={canAddNotes}
        canEditStatus={canEditStatus}
        note={note}
        onNoteChange={setNote}
        onPriorityChange={setPriority}
        onStatusChange={setStatus}
        priority={priority}
        status={status}
      />
    </EditModalShell>
  );
}
