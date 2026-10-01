/**
 * Contatti pubblici dello Staff tecnico (REV-PROF-08, schermata 6).
 *
 * La schermata vive in `edit/sections/ProfilePublicContactsScreen`, condivisa
 * con l'Allenatore: i toggle governano solo la visibilità, il valore resta
 * salvato e la privacy è applicata anche dal backend
 * (`get_profile_public_contacts` restituisce NULL per i canali spenti).
 */
import { ProfilePublicContactsScreen } from "../../edit/sections/ProfilePublicContactsScreen";
import {
  useCompleteProfileQuery,
  useStaffSectionSave,
} from "../staff-profile-edit-service";
import { useStaffEditorGuard } from "../use-staff-editor-guard";

export function StaffPublicContactsScreen() {
  const { userId } = useStaffEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useStaffSectionSave(userId);

  return (
    <ProfilePublicContactsScreen
      data={profileQuery.data}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      onSave={(data, patch, handlers) => save.mutate({ data, patch }, handlers)}
      profileType="staff"
      saving={save.isPending}
      testIDPrefix="staff"
    />
  );
}
