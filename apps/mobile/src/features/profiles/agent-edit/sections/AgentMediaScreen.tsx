/**
 * Media e contenuti del Procuratore (REV-PROF-16, voce dell'hub).
 *
 * Non è una galleria nuova: è `AgentMediaTab`, la stessa superficie Media del
 * Master Profile, dentro la cornice dei moduli di Modifica profilo — app bar,
 * back verso l'hub, nessuna bottom navigation. Griglia, filtri, viewer,
 * pubblicazione ed eliminazione restano quelli condivisi, e la pubblicazione
 * passa da `EditAgentMediaModal`, l'editor di contenuto già in uso.
 *
 * REV-PROF-12 è rispettata di conseguenza: la griglia condivisa non ha
 * bookmark sulle thumbnail — il "Salva" vive nel dettaglio contenuto, e solo
 * per il Visitor — mentre all'owner resta la CTA di pubblicazione.
 */
import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";

import { EditAgentMediaModal } from "../../edit-modals/EditAgentMediaModal";
import { AgentMediaTab } from "../../career/AgentProfileTabView";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useDeleteAgentMedia } from "../agent-media-actions";
import { useCompleteProfileQuery } from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

export function AgentMediaScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const deleteMedia = useDeleteAgentMedia(userId);
  const data = profileQuery.data;

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);

  function openEditor(itemId: string | null) {
    setEditingItemId(itemId);
    setEditorOpen(true);
  }

  function removeItem(itemId: string) {
    if (!data) {
      return;
    }

    deleteMedia.mutate(
      { data, itemId },
      {
        onError: (error) =>
          Alert.alert(
            "Errore",
            error instanceof Error && error.message
              ? error.message
              : "Non è stato possibile salvare le modifiche. Riprova.",
          ),
      },
    );
  }

  return (
    <ProfileEditScaffold
      onBack={() => router.back()}
      testID="agent-profile-edit-media"
      title="Media e contenuti"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="agent-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => void profileQuery.refetch()}
          testID="agent-edit-error"
        />
      ) : null}

      {data && userId ? (
        <>
          <AgentMediaTab
            completeProfile={data}
            isOwner
            onDeleteMedia={(itemId) =>
              Alert.alert(
                "Elimina contenuto",
                "Rimuovere questo contenuto dalla tab Media del procuratore?",
                [
                  { style: "cancel", text: "Annulla" },
                  {
                    onPress: () => removeItem(itemId),
                    style: "destructive",
                    text: "Elimina",
                  },
                ],
              )
            }
            onEditMedia={(itemId) => openEditor(itemId)}
            onManageMedia={() => openEditor(null)}
          />

          <EditAgentMediaModal
            completeProfile={data}
            editingItemId={editingItemId}
            onClose={() => setEditorOpen(false)}
            onSaved={() => {
              setEditorOpen(false);
              // La modale scrive da sé: qui basta rileggere il profilo, così
              // griglia, conteggio dell'hub e Master Profile si allineano.
              void profileQuery.refetch();
            }}
            userId={userId}
            visible={isEditorOpen}
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}
