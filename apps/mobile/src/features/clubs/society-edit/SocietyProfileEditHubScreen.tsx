/**
 * Hub "Modifica profilo" della Società (REV-PROF-18, schermata 1).
 *
 * Il comportamento vive in `profiles/edit/ProfileEditHubScreen`, lo stesso
 * indice che serve Allenatore, Staff tecnico, Dirigente e Procuratore: qui
 * restano la sorgente dei dati, il registro delle voci e la copy della
 * Società.
 *
 * L'hub non salva niente e non ha una CTA globale: ogni riga porta a un
 * modulo che possiede il proprio stato, la propria validazione e il proprio
 * "Salva modifiche" — oppure a un flusso gestionale che esisteva già.
 *
 * L'unica differenza rispetto agli altri ruoli è il dato: non un profilo
 * persona, ma la riga `clubs` letta dall'RPC dell'editor con i contatori dei
 * flussi collegati. Tornando da uno di quei flussi la query si rilegge, così
 * "8 squadre" non resta indietro di un'operazione.
 */
import { useCallback, useMemo } from "react";
import { useFocusEffect } from "expo-router";

import { ProfileEditHubScreen } from "../../profiles/edit/ProfileEditHubScreen";
import type { ProfileEditSectionKey } from "../../profiles/profile-analytics";
import { buildSocietyEditSectionGroups } from "./society-edit-sections";
import type { SocietyProfileEditor } from "./society-edit-types";
import { buildSocietySectionSummary } from "./society-hub-summaries";
import { useSocietyProfileEditorQuery } from "./society-profile-edit-service";
import {
  useSocietyAccessRevokedGuard,
  useSocietyEditorGuard,
} from "./use-society-editor-guard";

export function SocietyProfileEditHubScreen() {
  const { canOpenClubAdmin, clubId } = useSocietyEditorGuard();
  const editorQuery = useSocietyProfileEditorQuery(clubId);

  /*
    I contatori appartengono a flussi che vivono fuori da qui: tornare da
    "Gestisci squadre" o dalle Posizioni deve mostrare il numero nuovo, e
    l'unico momento in cui lo sappiamo è il focus.
  */
  useFocusEffect(
    useCallback(() => {
      void editorQuery.refetch();
      // La query è stabile: rifetchare al focus non deve ricrearne l'effetto.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clubId]),
  );

  // Permesso revocato durante la sessione: la RPC smette di restituire il club.
  useSocietyAccessRevokedGuard({
    isAllowed: editorQuery.data !== null,
    isLoaded: editorQuery.isSuccess,
  });

  const groups = useMemo(
    () => buildSocietyEditSectionGroups(clubId, { canOpenClubAdmin }),
    [canOpenClubAdmin, clubId],
  );

  const buildSummary = useCallback(
    (sectionId: ProfileEditSectionKey, data: SocietyProfileEditor) =>
      buildSocietySectionSummary(sectionId, data),
    [],
  );

  return (
    <ProfileEditHubScreen
      buildSummary={buildSummary}
      data={editorQuery.data ?? undefined}
      getIdentity={(editor) => ({
        avatarUrl: editor.club.logoUrl,
        name: editor.club.name,
      })}
      groups={groups}
      isError={editorQuery.isError}
      isPending={editorQuery.isPending}
      loadErrorMessage="Non è stato possibile caricare i dati del profilo. Riprova."
      onRetry={() => {
        void editorQuery.refetch();
      }}
      openedEvent="society_profile_edit_opened"
      profileType="society"
      roleLabel="Società"
      testIDPrefix="society"
    />
  );
}
