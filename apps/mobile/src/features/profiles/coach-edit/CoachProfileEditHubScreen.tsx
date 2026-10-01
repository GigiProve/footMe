/**
 * Hub "Modifica profilo" dell'Allenatore (REV-PROF-05, schermata 1).
 *
 * Il comportamento vive in `edit/ProfileEditHubScreen`, lo stesso indice che
 * serve lo Staff tecnico: qui restano la sorgente dei dati, il registro delle
 * voci e la copy dell'Allenatore.
 */
import { ProfileEditHubScreen } from "../edit/ProfileEditHubScreen";
import { COACH_EDIT_SECTION_GROUPS } from "./coach-edit-sections";
import { buildCoachSectionSummary } from "./coach-hub-summaries";
import { useCompleteProfileQuery } from "./coach-profile-edit-service";
import { useCoachEditorGuard } from "./use-coach-editor-guard";

export function CoachProfileEditHubScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);

  return (
    <ProfileEditHubScreen
      buildSummary={buildCoachSectionSummary}
      data={profileQuery.data}
      groups={COACH_EDIT_SECTION_GROUPS}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      openedEvent="coach_profile_edit_opened"
      profileType="coach"
      roleLabel="Allenatore"
      testIDPrefix="coach"
    />
  );
}
