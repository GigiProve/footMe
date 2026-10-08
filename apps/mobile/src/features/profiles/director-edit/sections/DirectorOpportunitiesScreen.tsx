/**
 * Opportunità del Dirigente (REV-PROF-11, schermata 5).
 *
 * La schermata vive in `edit/sections/ProfileOpportunitiesScreen`, condivisa
 * con Allenatore e Staff tecnico: stesse tre modalità geografiche, stesso
 * picker, stessa tassonomia di regioni e province. Qui restano la copy del
 * Dirigente, i destinatari e le colonne di `director_profiles` su cui la
 * disponibilità viene scritta.
 *
 * Tre cose valgono la pena di essere dette:
 *
 *  - **la disponibilità è un dato suo, i destinatari un altro.** Spegnendo il
 *    toggle i quattro destinatari restano salvati come sono: riaccendendolo si
 *    ritrovano, invece di dover essere ridichiarati. È la ragione per cui
 *    `open_to_work` esiste come colonna separata e non come "almeno uno dei
 *    quattro acceso";
 *  - **"Disponibile da" non compare.** Il Dirigente non lo raccoglie né
 *    nell'onboarding né nel mockup, e una data di inizio inventata qui
 *    sarebbe l'unico posto del prodotto a conoscerla;
 *  - **residenza e area operativa restano distinte.** Questa schermata non
 *    legge e non scrive la residenza: cambiare le aree non sposta dove si
 *    abita, e viceversa.
 */
import {
  ProfileOpportunitiesScreen,
  normalizeAvailabilityType,
  type ProfileOpportunitiesConfig,
} from "../../edit/sections/ProfileOpportunitiesScreen";
import {
  DIRECTOR_CONTACT_AUDIENCE_OPTIONS,
  type DirectorContactAudience,
} from "../../../onboarding/director/director-taxonomy";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
  type DirectorSectionPatch,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

/** Colonna di `director_profiles` che rappresenta ciascun destinatario. */
const AUDIENCE_FIELDS = {
  clubs: "open_to_clubs",
  others: "open_to_others",
  players: "open_to_players",
  staff: "open_to_staff",
} as const satisfies Record<DirectorContactAudience, string>;

const CONFIG: ProfileOpportunitiesConfig<DirectorSectionPatch> = {
  audienceOptions: DIRECTOR_CONTACT_AUDIENCE_OPTIONS,
  audienceTitle: "Disponibile per",
  availabilityDescription:
    "Il tuo profilo può comparire tra i dirigenti disponibili.",
  availabilityLabel: "Disponibile per nuove opportunità",
  profileType: "director",
  read: (data) => ({
    audiences: DIRECTOR_CONTACT_AUDIENCE_OPTIONS.filter(
      (option) => data.directorProfile?.[AUDIENCE_FIELDS[option.value]],
    ).map((option) => option.value),
    availability: {
      mode: normalizeAvailabilityType(data.directorProfile?.availability_type),
      provinces: data.directorProfile?.preferred_provinces ?? [],
      regions: data.directorProfile?.preferred_regions ?? [],
    },
    availableFrom: "",
    preferences: [],
    isAvailable: data.directorProfile?.open_to_work ?? false,
  }),
  recapActionLabel: "Modifica aree",
  recapTitle: "Aree selezionate",
  regionsModeTitle: "In una o più aree",
  showAvailableFrom: false,
  testIDPrefix: "director",
  write: (draft, active) => ({
    directorProfile: {
      availability_type: draft.availability.mode,
      /*
        I destinatari si scrivono sempre, anche a disponibilità spenta: è
        quello che permette di ritrovarli riaccendendola. A dire se il profilo
        è disponibile è `open_to_work`, da solo.
      */
      open_to_clubs: draft.audiences.includes("clubs"),
      open_to_others: draft.audiences.includes("others"),
      open_to_players: draft.audiences.includes("players"),
      open_to_staff: draft.audiences.includes("staff"),
      open_to_work: draft.isAvailable,
      preferred_provinces: active.provinces,
      preferred_regions: active.regions,
    },
  }),
  zonesTitle: "Area operativa",
};

export function DirectorOpportunitiesScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);

  return (
    <ProfileOpportunitiesScreen<DirectorSectionPatch>
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
