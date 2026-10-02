/**
 * Contatti pubblici del Dirigente (REV-PROF-11, schermata 8).
 *
 * La schermata vive in `edit/sections/ProfilePublicContactsScreen`, condivisa
 * con Allenatore e Staff tecnico: i toggle governano solo la visibilità, il
 * valore resta salvato e la privacy è applicata anche dal backend
 * (`get_profile_public_contacts` restituisce NULL per i canali spenti, e
 * `profile_contacts` ha una RLS owner-only).
 *
 * I canali sono i sette canonici del prodotto — telefono, email, Instagram,
 * TikTok, Facebook, YouTube, sito web. Il mockup ne illustra quattro, LinkedIn
 * compreso: non esiste nel modello dati e inventare una colonna per una
 * schermata dimostrativa avrebbe creato un canale che nessun'altra superficie
 * sa leggere.
 */
import { ProfilePublicContactsScreen } from "../../edit/sections/ProfilePublicContactsScreen";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

export function DirectorPublicContactsScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);

  return (
    <ProfilePublicContactsScreen
      data={profileQuery.data}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      onSave={(data, patch, handlers) => save.mutate({ data, patch }, handlers)}
      profileType="director"
      saving={save.isPending}
      testIDPrefix="director"
    />
  );
}
