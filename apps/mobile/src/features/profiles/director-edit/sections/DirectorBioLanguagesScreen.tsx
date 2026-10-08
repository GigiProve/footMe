/**
 * Bio e lingue del Dirigente (REV-PROF-11, schermata 6).
 *
 * La schermata vive in `edit/sections/ProfileBioLanguagesScreen`, estratta
 * con REV-PROF-16 e condivisa con il Procuratore: bio su `profiles`, limite a
 * 300 caratteri senza troncamenti silenziosi, lingue dal selector condiviso.
 * Qui resta soltanto la copy del Dirigente.
 */
import {
  PROFILE_BIO_MAX_LENGTH,
  ProfileBioLanguagesScreen,
  type ProfileBioLanguagesConfig,
} from "../../edit/sections/ProfileBioLanguagesScreen";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

/** Conservato per compatibilità: il limite è quello condiviso. */
export const DIRECTOR_PROFILE_BIO_MAX_LENGTH = PROFILE_BIO_MAX_LENGTH;

const CONFIG: ProfileBioLanguagesConfig = {
  bioDescription:
    "Racconta in modo sintetico la tua esperienza e il tuo approccio.",
  bioPlaceholder:
    "Racconta la tua esperienza dirigenziale, i club con cui hai lavorato e il tuo modo di lavorare.",
  profileType: "director",
  testIDPrefix: "director",
};

export function DirectorBioLanguagesScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);

  return (
    <ProfileBioLanguagesScreen
      config={CONFIG}
      data={profileQuery.data}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      onSave={(data, patch, handlers) => save.mutate({ data, patch }, handlers)}
      saving={save.isPending}
    />
  );
}
