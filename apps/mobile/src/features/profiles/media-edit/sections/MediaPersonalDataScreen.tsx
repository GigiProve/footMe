/**
 * Dati personali (REV-PROF-22, Screen 8).
 *
 * L'unico modulo dell'hub che non riguarda la realtà editoriale. Modifica i
 * dati dell'account autenticato e nient'altro: nome, cognome, sesso, data di
 * nascita, nazionalità, residenza e telefono privato.
 *
 * La schermata è `edit/sections/ProfilePersonalDataScreen`, la stessa degli
 * altri ruoli, con tre differenze dichiarate:
 *
 *  - **niente copertina e niente logo.** Per gli altri ruoli quel blocco
 *    modifica l'immagine del profilo pubblico; per il Media/Creator la
 *    copertina appartiene alla realtà editoriale e si modifica in "Identità
 *    editoriale", insieme al logo. Metterli anche qui significherebbe due
 *    posti per la stessa immagine, e il rischio di confondere il logo della
 *    testata con la foto della persona. Nasconderli non li cancella: il patch
 *    rimanda indietro i valori letti;
 *  - **c'è il telefono.** L'hub del Media/Creator non ha un modulo "Contatti
 *    pubblici" — i suoi canali sono quelli editoriali — quindi il numero
 *    privato dell'account sarebbe altrimenti irraggiungibile. Resta privato:
 *    la preferenza `show_phone` non viene toccata e resta spenta;
 *  - **un'etichetta di privacy in evidenza.** "Visibili solo a te" è scritto,
 *    non affidato a un lucchetto, perché un'icona da sola non dice niente a
 *    uno screen reader.
 *
 * Il motivo per cui questi dati non raggiungono il Visitor non è la nota in
 * fondo: è che `fetch_public_media_profile` non li proietta. La nota lo dice,
 * il backend lo fa.
 *
 * Nessuno di questi campi diventa il nome della realtà, l'autore degli
 * Articoli o il fallback del logo. La residenza, in particolare, non è
 * un'area coperta: quella si dichiara in "Aree coperte" ed è un altro dato
 * anche quando per caso coincidono.
 */
import {
  ProfilePersonalDataScreen,
  type ProfilePersonalDataConfig,
} from "../../edit/sections/ProfilePersonalDataScreen";
import { useProfileSectionSave } from "../../edit/profile-section-save";
import { useCompleteProfileQuery } from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

const CONFIG: ProfilePersonalDataConfig = {
  hiddenFields: ["domicile", "images"],
  includePhone: true,
  privacyBadge: "Visibili solo a te",
  privacyNotice: "Questi dati non compaiono nel profilo pubblico.",
  profileType: "media",
  testIDPrefix: "media",
  title: "Dati personali",
};

export function MediaPersonalDataScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  /*
    `useProfileSectionSave` scrive `profiles`, `profile_contacts` e
    `profile_private_contacts` a partire dallo stato condiviso. Per il ruolo
    `media` `buildFullUpdatePayload` non produce un blocco `mediaProfile`,
    quindi questo modulo non può toccare nome editoriale, logo, descrizione,
    tassonomie o aree nemmeno per sbaglio.
  */
  const save = useProfileSectionSave(userId);

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
