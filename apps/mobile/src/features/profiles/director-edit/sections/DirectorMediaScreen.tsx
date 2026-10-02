/**
 * Media e contenuti del Dirigente (REV-PROF-11, voce dell'hub).
 *
 * Non è una galleria nuova: è `DirectorMediaTab`, la stessa superficie Media
 * del Master Profile, dentro la cornice dei moduli di Modifica profilo —
 * app bar, back verso l'hub, nessuna bottom navigation. Griglia, filtri,
 * viewer, pubblicazione, evidenza ed eliminazione restano quelli condivisi, e
 * la pubblicazione passa da `EditDirectorMediaModal`, l'editor di contenuto
 * già in uso.
 *
 * REV-PROF-12 è rispettata di conseguenza: la griglia non ha bookmark sulle
 * thumbnail — il "Salva" vive nel dettaglio contenuto, e solo per il Visitor —
 * mentre all'owner resta la CTA di pubblicazione.
 */
import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";

import { EditDirectorMediaModal } from "../../edit-modals/EditDirectorMediaModal";
import { DirectorMediaTab } from "../../career/DirectorProfileTabView";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useDirectorMediaAction } from "../director-media-actions";
import { useCompleteProfileQuery } from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

export function DirectorMediaScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const mediaAction = useDirectorMediaAction(userId);
  const data = profileQuery.data;

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);

  function openEditor(itemId: string | null) {
    setEditingItemId(itemId);
    setEditorOpen(true);
  }

  function runAction(action: Parameters<typeof mediaAction.mutate>[0]["action"]) {
    if (!data) {
      return;
    }

    mediaAction.mutate(
      { action, data },
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
      testID="director-profile-edit-media"
      title="Media e contenuti"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="director-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => void profileQuery.refetch()}
          testID="director-edit-error"
        />
      ) : null}

      {data && userId ? (
        <>
          <DirectorMediaTab
            completeProfile={data}
            isOwner
            onDeleteMedia={(itemId) =>
              Alert.alert(
                "Elimina contenuto",
                "Rimuovere questo contenuto dalla tab Media del dirigente?",
                [
                  { style: "cancel", text: "Annulla" },
                  {
                    onPress: () => runAction({ itemId, type: "delete" }),
                    style: "destructive",
                    text: "Elimina",
                  },
                ],
              )
            }
            onEditMedia={(itemId) => openEditor(itemId)}
            onManageMedia={() => openEditor(null)}
            onToggleMediaFeatured={(itemId) =>
              runAction({ itemId, type: "toggleFeatured" })
            }
          />

          <EditDirectorMediaModal
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
