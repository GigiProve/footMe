/**
 * Hub "Modifica profilo" dello Staff tecnico (REV-PROF-08, schermata 1).
 *
 * Il comportamento vive in `edit/ProfileEditHubScreen`, lo stesso indice che
 * serve l'Allenatore: qui restano la sorgente dei dati, il registro delle voci
 * e la copy dello Staff tecnico.
 */
import { ProfileEditHubScreen } from "../edit/ProfileEditHubScreen";
import { STAFF_EDIT_SECTION_GROUPS } from "./staff-edit-sections";
import { buildStaffSectionSummary } from "./staff-hub-summaries";
import { useCompleteProfileQuery } from "./staff-profile-edit-service";
import { useStaffEditorGuard } from "./use-staff-editor-guard";

export function StaffProfileEditHubScreen() {
  const { userId } = useStaffEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);

  return (
    <ProfileEditHubScreen
      buildSummary={buildStaffSectionSummary}
      data={profileQuery.data}
      groups={STAFF_EDIT_SECTION_GROUPS}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      openedEvent="staff_profile_edit_opened"
      profileType="staff"
      roleLabel="Staff tecnico"
      testIDPrefix="staff"
    />
  );
}
