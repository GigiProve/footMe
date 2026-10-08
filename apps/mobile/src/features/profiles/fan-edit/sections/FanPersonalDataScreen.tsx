/**
 * Foto e dati personali del Tifoso (REV-PROF-20, schermata 2).
 *
 * La schermata vive in `edit/sections/ProfilePersonalDataScreen`, la stessa
 * di Allenatore, Staff tecnico e Dirigente: copertina con "Modifica
 * copertina", comando fotocamera sovrapposto all'avatar — mai un pulsante
 * testuale separato — crop, upload e CTA sticky sono quelli condivisi.
 *
 * Il salvataggio passa da `useProfileSectionSave`, che scrive `profiles` e
 * nient'altro: per il Tifoso `buildFullUpdatePayload` non produce un blocco
 * `fanProfile`, quindi questo modulo non può toccare squadra del cuore,
 * interessi, categorie o aree nemmeno per sbaglio.
 *
 * Due differenze rispetto agli altri ruoli, entrambe dichiarate e non
 * reimplementate:
 *
 *  - il modello Tifoso non prevede sesso né domicilio in questo modulo, e un
 *    campo non previsto non si aggiunge per analogia. Nasconderli non li
 *    cancella: il patch rimanda indietro il valore letto, quindi il sesso
 *    raccolto in onboarding (REV-ONB-08) resta dov'è;
 *  - la nota di privacy dice che data di nascita e residenza non sono
 *    pubbliche. È una spiegazione, non la protezione: quei due campi non
 *    entrano nel payload pubblico perché `fetch_public_fan_profile` non li
 *    proietta, non perché una nota lo annuncia.
 */
import {
  ProfilePersonalDataScreen,
  type ProfilePersonalDataConfig,
} from "../../edit/sections/ProfilePersonalDataScreen";
import { useProfileSectionSave } from "../../edit/profile-section-save";
import { useCompleteProfileQuery } from "../fan-profile-edit-service";
import { useFanEditorGuard } from "../use-fan-editor-guard";

const CONFIG: ProfilePersonalDataConfig = {
  hiddenFields: ["gender", "domicile"],
  privacyNotice: "Data di nascita e residenza non sono pubbliche.",
  profileType: "fan",
  testIDPrefix: "fan",
};

export function FanPersonalDataScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
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
