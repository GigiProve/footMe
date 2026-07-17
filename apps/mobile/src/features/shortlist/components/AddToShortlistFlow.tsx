import { useEffect, useRef, useState } from "react";
import { InteractionManager, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useSession } from "../../auth/use-session";
import type { MyShortlistPermissions } from "../shortlist-permissions-service";
import {
  fetchClubShortlists,
  fetchProfileShortlistMemberships,
  fetchShortlistEntries,
  type ProfileShortlistMembership,
  type ShortlistEntry,
} from "../shortlist-service";
import { AddEvaluationModal } from "./AddEvaluationModal";
import { CreateListModal } from "./CreateListModal";
import { EditEvaluationModal } from "./EditEvaluationModal";
import { ShortlistManageSheet } from "./ShortlistManageSheet";
import { ShortlistPickerSheet } from "./ShortlistPickerSheet";

type AddToShortlistFlowProfile = {
  avatarUrl?: string | null;
  fullName: string;
  id: string;
  subtitle: string;
};

type FixedList = { id: string; name: string };

type AddToShortlistFlowProps = {
  clubId: string;
  /**
   * When provided, the flow skips the "choose a list" picker entirely and
   * goes straight to the evaluation step for this list (used when adding a
   * profile from inside a shortlist's own detail screen, where the target
   * list is already known). Backward compatible: existing callers (e.g.
   * `PublicProfileScreen`) never pass this and keep the picker/manage
   * behavior driven by `initialMode`.
   */
  fixedList?: FixedList;
  initialMode: "picker" | "manage";
  onClose: () => void;
  open: boolean;
  permissions: MyShortlistPermissions;
  profile: AddToShortlistFlowProfile;
};

type FlowStep =
  | "closed"
  | "picker"
  | "manage"
  | "createList"
  | "evaluate"
  | "editEvaluation";

type SelectedList = { id: string; name: string };

type EditingEntryState = {
  entry: ShortlistEntry;
  listId: string;
  listName: string;
};

/**
 * Orchestrates the "add to / manage shortlist" flow triggered by the star on
 * a public profile. Sheet → full-screen Modal transitions are risky on iOS
 * (both are RN <Modal>): we always fully hide the current sheet first and
 * only mount the next step once its `onDismiss` fires. Android's `onDismiss`
 * is unreliable, so `InteractionManager.runAfterInteractions` is used there
 * as a fallback; `pendingStepRef` makes applying the pending step idempotent
 * so both paths can safely race.
 */
export function AddToShortlistFlow({
  clubId,
  fixedList,
  initialMode,
  onClose,
  open,
  permissions,
  profile,
}: AddToShortlistFlowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile: sessionProfile } = useSession();
  const currentUserId = sessionProfile?.id ?? null;

  const [step, setStep] = useState<FlowStep>("closed");
  const [selectedList, setSelectedList] = useState<SelectedList | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditingEntryState | null>(null);
  const pendingStepRef = useRef<FlowStep | null>(null);

  useEffect(() => {
    if (open) {
      if (fixedList) {
        setSelectedList(fixedList);
        setStep("evaluate");
      } else {
        setStep(initialMode);
      }
    } else {
      setStep("closed");
      setSelectedList(null);
      setEditingEntry(null);
      pendingStepRef.current = null;
    }
    // initialMode/fixedList are intentionally read only when `open` flips to true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const membershipsQuery = useQuery({
    enabled: open && !!profile.id && !!clubId,
    queryFn: () => fetchProfileShortlistMemberships(profile.id, clubId),
    queryKey: ["shortlist-memberships", profile.id],
  });

  const shortlistsQuery = useQuery({
    enabled: open && !!clubId,
    queryFn: () => fetchClubShortlists(clubId),
    queryKey: ["shortlists", clubId],
  });

  function applyPendingStep() {
    if (pendingStepRef.current) {
      const next = pendingStepRef.current;
      pendingStepRef.current = null;
      setStep(next);
    }
  }

  function transitionAfterSheetClose(next: FlowStep) {
    pendingStepRef.current = next;
    setStep("closed");

    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(() => {
        applyPendingStep();
      });
    }
  }

  function handleClose() {
    setStep("closed");
    setSelectedList(null);
    setEditingEntry(null);
    pendingStepRef.current = null;
    onClose();
  }

  async function handleCreateListCreated(newListId: string) {
    let listName = "Lista";
    try {
      const shortlists = await queryClient.fetchQuery({
        queryFn: () => fetchClubShortlists(clubId),
        queryKey: ["shortlists", clubId],
      });
      const created = shortlists.find((list) => list.id === newListId);
      if (created) {
        listName = created.name;
      }
    } catch {
      // fall back to the generic label — the AddEvaluationModal still works.
    }

    setSelectedList({ id: newListId, name: listName });
    // Chiude la CreateListModal e apre la valutazione con lo stesso handoff
    // onDismiss/InteractionManager degli altri passaggi (evita la corsa con
    // il pending "picker" che onClose imposterebbe in caso di annullo).
    transitionAfterSheetClose("evaluate");
  }

  async function handleRequestEditEvaluation(membership: ProfileShortlistMembership) {
    pendingStepRef.current = "editEvaluation";
    setStep("closed");

    try {
      const entries = await queryClient.fetchQuery({
        queryFn: () => fetchShortlistEntries(membership.shortlist_id),
        queryKey: ["shortlist-entries", membership.shortlist_id],
      });
      const entry = entries.find((row) => row.id === membership.entry_id);

      if (entry) {
        setEditingEntry({
          entry,
          listId: membership.shortlist_id,
          listName: membership.shortlist_name,
        });
      } else {
        pendingStepRef.current = null;
        handleClose();
        return;
      }
    } catch {
      pendingStepRef.current = null;
      handleClose();
      return;
    }

    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(() => {
        applyPendingStep();
      });
    }
  }

  if (!open || !currentUserId) {
    return null;
  }

  return (
    <>
      <ShortlistPickerSheet
        canCreateLists={permissions.can_create_lists}
        clubId={clubId}
        onClose={handleClose}
        onContinue={(listId) => {
          const list = (shortlistsQuery.data ?? []).find((row) => row.id === listId);
          setSelectedList({
            id: listId,
            name: list?.name ?? "Lista",
          });
          transitionAfterSheetClose("evaluate");
        }}
        onCreateNewList={() => transitionAfterSheetClose("createList")}
        onDismiss={applyPendingStep}
        profile={profile}
        visible={step === "picker"}
      />

      <ShortlistManageSheet
        canAddToOtherList={permissions.can_add_profiles}
        canEditEvaluation={permissions.can_edit_status || permissions.can_add_notes}
        memberships={membershipsQuery.data ?? []}
        onAddToOtherList={() => transitionAfterSheetClose("picker")}
        onClose={handleClose}
        onDismiss={applyPendingStep}
        onEditEvaluation={handleRequestEditEvaluation}
        onViewInShortlist={(membership) => {
          handleClose();
          router.push(
            `/shortlist/entry/${membership.entry_id}?listId=${membership.shortlist_id}` as never,
          );
        }}
        profileFullName={profile.fullName}
        visible={step === "manage"}
      />

      <CreateListModal
        clubId={clubId}
        createdByProfileId={currentUserId}
        onClose={() => transitionAfterSheetClose("picker")}
        onCreated={handleCreateListCreated}
        onDismiss={applyPendingStep}
        successMode="skip"
        visible={step === "createList"}
      />

      {selectedList ? (
        <AddEvaluationModal
          canAddNotes={permissions.can_add_notes}
          clubId={clubId}
          currentUserId={currentUserId}
          listId={selectedList.id}
          listName={selectedList.name}
          onBackToPicker={
            fixedList ? handleClose : () => transitionAfterSheetClose("picker")
          }
          onCloseFlow={handleClose}
          onDismiss={applyPendingStep}
          profile={profile}
          visible={step === "evaluate"}
        />
      ) : null}

      {editingEntry ? (
        <EditEvaluationModal
          canAddNotes={permissions.can_add_notes}
          canEditStatus={permissions.can_edit_status}
          clubId={clubId}
          entry={editingEntry.entry}
          listId={editingEntry.listId}
          listName={editingEntry.listName}
          onClose={handleClose}
          visible={step === "editEvaluation"}
        />
      ) : null}
    </>
  );
}
