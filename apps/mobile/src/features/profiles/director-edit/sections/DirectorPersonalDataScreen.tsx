/**
 * Foto e dati personali del Dirigente (REV-PROF-11, schermata 2).
 *
 * La schermata vive in `edit/sections/ProfilePersonalDataScreen`, condivisa
 * con Allenatore e Staff tecnico: copertina con "Modifica copertina", comando
 * fotocamera sovrapposto all'avatar — mai un pulsante separato "Modifica
 * foto" — e form anagrafico con il toggle del domicilio sono gli stessi.
 */
import {
  ProfilePersonalDataScreen,
  type ProfilePersonalDataConfig,
} from "../../edit/sections/ProfilePersonalDataScreen";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

const CONFIG: ProfilePersonalDataConfig = {
  profileType: "director",
  testIDPrefix: "director",
};

export function DirectorPersonalDataScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);

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
