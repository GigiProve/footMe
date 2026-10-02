/**
 * Hub "Modifica profilo" del Dirigente (REV-PROF-11, schermata 1).
 *
 * Il comportamento vive in `edit/ProfileEditHubScreen`, lo stesso indice che
 * serve Allenatore e Staff tecnico: qui restano la sorgente dei dati, il
 * registro delle voci e la copy del Dirigente.
 *
 * L'hub non salva niente e non ha una CTA globale: ogni riga porta a un
 * modulo che possiede il proprio stato, la propria validazione e il proprio
 * "Salva modifiche".
 */
import { ProfileEditHubScreen } from "../edit/ProfileEditHubScreen";
import { DIRECTOR_EDIT_SECTION_GROUPS } from "./director-edit-sections";
import { buildDirectorSectionSummary } from "./director-hub-summaries";
import { useCompleteProfileQuery } from "./director-profile-edit-service";
import { useDirectorEditorGuard } from "./use-director-editor-guard";

export function DirectorProfileEditHubScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);

  return (
    <ProfileEditHubScreen
      buildSummary={buildDirectorSectionSummary}
      data={profileQuery.data}
      groups={DIRECTOR_EDIT_SECTION_GROUPS}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      openedEvent="director_profile_edit_opened"
      profileType="director"
      roleLabel="Dirigente"
      testIDPrefix="director"
    />
  );
}
