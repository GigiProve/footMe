/**
 * Foto e dati personali dello Staff tecnico (REV-PROF-08, schermata 2).
 *
 * La schermata vive in `edit/sections/ProfilePersonalDataScreen`, condivisa
 * con l'Allenatore: copertina, comando fotocamera sovrapposto all'avatar —
 * mai un pulsante separato "Modifica foto" — e form anagrafico sono gli stessi.
 */
import {
  ProfilePersonalDataScreen,
  type ProfilePersonalDataConfig,
} from "../../edit/sections/ProfilePersonalDataScreen";
import {
  useCompleteProfileQuery,
  useStaffSectionSave,
} from "../staff-profile-edit-service";
import { useStaffEditorGuard } from "../use-staff-editor-guard";

const CONFIG: ProfilePersonalDataConfig = {
  profileType: "staff",
  testIDPrefix: "staff",
};

export function StaffPersonalDataScreen() {
  const { userId } = useStaffEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useStaffSectionSave(userId);

  return (
    <ProfilePersonalDataScreen
      config={CONFIG}
      data={profileQuery.data}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      onSave={(data, patch, handlers) => save.mutate({ data, patch }, handlers)}
      saving={save.isPending}
      userId={userId}
    />
  );
}
