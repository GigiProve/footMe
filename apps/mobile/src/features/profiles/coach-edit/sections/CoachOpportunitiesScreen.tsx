/**
 * Opportunità dell'Allenatore (REV-PROF-05, schermata 4).
 *
 * La schermata vive in `edit/sections/ProfileOpportunitiesScreen`, condivisa
 * con lo Staff tecnico: qui restano la copy dell'Allenatore e le colonne di
 * `coach_profiles` su cui la disponibilità viene scritta.
 */
import {
  ProfileOpportunitiesScreen,
  normalizeAvailabilityType,
  type ProfileOpportunitiesConfig,
} from "../../edit/sections/ProfileOpportunitiesScreen";
import { toDelimitedString } from "../../profile-edit-helpers";
import {
  useCoachSectionSave,
  useCompleteProfileQuery,
} from "../coach-profile-edit-service";
import { useCoachEditorGuard } from "../use-coach-editor-guard";

const CONFIG: ProfileOpportunitiesConfig = {
  availabilityDescription:
    "Il tuo profilo può comparire tra gli allenatori disponibili sul mercato.",
  availabilityLabel: "Disponibile per una nuova squadra",
  profileType: "coach",
  // Il Dirigente ha i destinatari, questo ruolo no: la sezione non esiste.
  read: (data) => ({
    audiences: [],
    availability: {
      mode: normalizeAvailabilityType(data.coachProfile?.availability_type),
      provinces: data.coachProfile?.preferred_provinces ?? [],
      regions: data.coachProfile?.preferred_regions ?? [],
    },
    availableFrom: data.coachProfile?.available_from ?? "",
    isAvailable: data.coachProfile?.open_to_new_role ?? false,
  }),
  testIDPrefix: "coach",
  write: (draft, active) => ({
    coachAvailabilityType: draft.availability.mode,
    coachAvailableFrom: draft.availableFrom,
    coachPreferredProvinces: toDelimitedString(active.provinces),
    openToNewRole: draft.isAvailable,
    preferredRegions: toDelimitedString(active.regions),
  }),
};

export function CoachOpportunitiesScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachSectionSave(userId);

  return (
    <ProfileOpportunitiesScreen
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
