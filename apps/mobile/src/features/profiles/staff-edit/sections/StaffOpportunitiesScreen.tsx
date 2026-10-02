/**
 * Opportunità dello Staff tecnico (REV-PROF-08, schermata 4).
 *
 * La schermata vive in `edit/sections/ProfileOpportunitiesScreen`, condivisa
 * con l'Allenatore: qui restano la copy dello Staff tecnico e le colonne di
 * `staff_profiles` su cui la disponibilità viene scritta.
 *
 * La copy non è un dettaglio: lo Staff tecnico non cerca "una nuova squadra"
 * ma "nuove collaborazioni", e la task lo chiede esplicitamente.
 */
import {
  ProfileOpportunitiesScreen,
  normalizeAvailabilityType,
  type ProfileOpportunitiesConfig,
} from "../../edit/sections/ProfileOpportunitiesScreen";
import { toDelimitedString } from "../../profile-edit-helpers";
import {
  useCompleteProfileQuery,
  useStaffSectionSave,
} from "../staff-profile-edit-service";
import { useStaffEditorGuard } from "../use-staff-editor-guard";

const CONFIG: ProfileOpportunitiesConfig = {
  availabilityDescription:
    "Il tuo profilo può comparire tra i profili dello staff disponibili.",
  availabilityLabel: "Disponibile per nuove collaborazioni",
  profileType: "staff",
  // Il Dirigente ha i destinatari, questo ruolo no: la sezione non esiste.
  read: (data) => ({
    audiences: [],
    availability: {
      mode: normalizeAvailabilityType(data.staffProfile?.availability_type),
      provinces: data.staffProfile?.preferred_provinces ?? [],
      regions: data.staffProfile?.preferred_regions ?? [],
    },
    availableFrom: data.staffProfile?.available_from ?? "",
    isAvailable: data.staffProfile?.open_to_work ?? false,
  }),
  testIDPrefix: "staff",
  write: (draft, active) => ({
    openToWork: draft.isAvailable,
    preferredRegions: toDelimitedString(active.regions),
    staffAvailabilityType: draft.availability.mode,
    staffAvailableFrom: draft.availableFrom,
    staffPreferredProvinces: toDelimitedString(active.provinces),
  }),
};

export function StaffOpportunitiesScreen() {
  const { userId } = useStaffEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useStaffSectionSave(userId);

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
