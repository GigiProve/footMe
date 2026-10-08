/**
 * Stato comune ai cinque moduli dell'editor Società (REV-PROF-18
 * §"Architettura dell'editor", §"Salvataggio e persistenza").
 *
 * Ogni modulo ha il proprio draft, la propria validazione e la propria CTA:
 * quello che hanno in comune è il contorno — da dove arrivano i dati, come si
 * salva una sezione sola, cosa succede quando un altro amministratore ha
 * toccato il club nel frattempo, e quali eventi si tracciano.
 *
 * Il salvataggio porta con sé `updatedAt`: in caso di conflitto non si
 * sovrascrive, si offre "Ricarica". E non si perde il draft — l'utente ha
 * ancora davanti quello che aveva scritto.
 */
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";

import { trackProfileEvent } from "../../../profiles/profile-analytics";
import {
  isSocietyConflictError,
  resolveSocietySaveErrorMessage,
  useSocietyProfileEditorQuery,
  useSocietySectionSave,
} from "../society-profile-edit-service";
import type {
  SocietyEditSectionId,
  SocietyEditableClub,
  SocietyProfileEditor,
} from "../society-edit-types";
import {
  useSocietyAccessRevokedGuard,
  useSocietyEditorGuard,
} from "../use-society-editor-guard";

type SocietySectionEditor = {
  canOpenClubAdmin: boolean;
  clearError: () => void;
  club: SocietyEditableClub | null;
  clubId: string | null;
  editor: SocietyProfileEditor | null;
  errorMessage: string | null;
  hasConflict: boolean;
  isError: boolean;
  isPending: boolean;
  reload: () => void;
  save: (payload: Record<string, unknown>, onSaved: () => void) => void;
  saving: boolean;
  setErrorMessage: (message: string | null) => void;
  trackUnsavedExit: (isDirty: boolean) => void;
};

export function useSocietySectionEditor(
  section: SocietyEditSectionId,
): SocietySectionEditor {
  const { canOpenClubAdmin, clubId } = useSocietyEditorGuard();
  const editorQuery = useSocietyProfileEditorQuery(clubId);
  const editor = editorQuery.data ?? null;
  const save = useSocietySectionSave(clubId, editor?.club.updatedAt ?? null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  useSocietyAccessRevokedGuard({
    isAllowed: editor !== null,
    isLoaded: editorQuery.isSuccess,
  });

  useFocusEffect(
    useCallback(() => {
      trackProfileEvent("profile_edit_section_opened", {
        profileType: "society",
        section,
      });
    }, [section]),
  );

  const reload = useCallback(() => {
    setErrorMessage(null);
    setHasConflict(false);
    void editorQuery.refetch();
    // `refetch` cambia identità a ogni render: dipendere da essa farebbe
    // ricreare il callback a vuoto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  return {
    canOpenClubAdmin,
    clearError: () => setErrorMessage(null),
    club: editor?.club ?? null,
    clubId,
    editor,
    errorMessage,
    hasConflict,
    isError: editorQuery.isError,
    isPending: editorQuery.isPending,
    reload,
    save: (payload, onSaved) => {
      // Doppio submit: la mutation è già in volo, la seconda non parte.
      if (save.isPending) {
        return;
      }

      setErrorMessage(null);

      save.mutate(
        { payload, section },
        {
          onError: (error) => {
            setHasConflict(isSocietyConflictError(error));
            trackProfileEvent(
              isSocietyConflictError(error)
                ? "society_profile_conflict"
                : "profile_edit_section_save_failed",
              {
                profileType: "society",
                section,
                success: false,
              },
            );
            setErrorMessage(resolveSocietySaveErrorMessage(error));
          },
          onSuccess: () => {
            setHasConflict(false);
            trackProfileEvent("profile_edit_section_saved", {
              profileType: "society",
              section,
              success: true,
            });
            onSaved();
            router.back();
          },
        },
      );
    },
    saving: save.isPending,
    setErrorMessage,
    trackUnsavedExit: (isDirty: boolean) => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "society",
          section,
        });
      }
    },
  };
}
