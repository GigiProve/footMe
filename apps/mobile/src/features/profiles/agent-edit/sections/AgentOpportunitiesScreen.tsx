/**
 * Opportunità del Procuratore (REV-PROF-16, schermata 5).
 *
 * La schermata vive in `edit/sections/ProfileOpportunitiesScreen`, condivisa
 * con gli altri ruoli professionali: stesse tre modalità geografiche, stesso
 * picker, stessa tassonomia di regioni e province dell'onboarding. Non esiste
 * un secondo modello geografico per il profilo.
 *
 * Tre differenze rispetto agli altri ruoli, tutte volute:
 *
 *  - **non c'è un interruttore generale.** Le due preferenze — richieste di
 *    rappresentanza e collaborazioni con club — sono autonome: spegnerne una
 *    non tocca l'altra, non chiude la messaggistica, non cancella i rapporti
 *    già in essere e non ritira le richieste già ricevute. Sono due colonne
 *    separate (`open_to_players`, `open_to_clubs`) proprio per questo;
 *  - **l'area operativa resta sempre visibile.** È un dato del profilo, non
 *    una conseguenza della disponibilità: un procuratore che non accetta
 *    nuove richieste opera comunque da qualche parte;
 *  - **"Disponibile da" non compare.** Il Procuratore non lo raccoglie né
 *    nell'onboarding né nel mockup, e una data di inizio inventata qui sarebbe
 *    l'unico posto del prodotto a conoscerla.
 *
 * Residenza e area operativa restano distinte: questa schermata non legge e
 * non scrive la residenza.
 */
import {
  ProfileOpportunitiesScreen,
  normalizeAvailabilityType,
  type ProfileOpportunitiesConfig,
  type ProfileOpportunityPreference,
} from "../../edit/sections/ProfileOpportunitiesScreen";
import type { AgentProfilePatchInput } from "../../profile-service";
import {
  useAgentProfilePatch,
  useCompleteProfileQuery,
} from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

/** Colonna di `agent_profiles` che rappresenta ciascuna preferenza. */
const PREFERENCE_FIELDS = {
  clubs: "open_to_clubs",
  players: "open_to_players",
} as const;

const PREFERENCES: readonly ProfileOpportunityPreference[] = [
  {
    description: "I calciatori possono contattarti.",
    label: "Aperto a richieste di rappresentanza",
    value: "players",
  },
  {
    description: "I club possono proporti collaborazioni.",
    label: "Disponibile a collaborare con club",
    value: "clubs",
  },
];

const CONFIG: ProfileOpportunitiesConfig<AgentProfilePatchInput> = {
  // Non usati: con `preferences` il toggle unico non viene renderizzato.
  availabilityDescription: "",
  availabilityLabel: "",
  preferences: PREFERENCES,
  profileType: "agent",
  read: (data) => ({
    audiences: [],
    availability: {
      mode: normalizeAvailabilityType(data.agentProfile?.operating_area_type),
      provinces: data.agentProfile?.operating_provinces ?? [],
      regions: data.agentProfile?.operating_regions ?? [],
    },
    availableFrom: "",
    /*
      Nessun gate: `isAvailable` resta acceso perché i campi dipendenti sono
      sempre visibili. Non viene letto né scritto da nessuna parte.
    */
    isAvailable: true,
    preferences: Object.entries(PREFERENCE_FIELDS)
      .filter(([, column]) => data.agentProfile?.[column])
      .map(([value]) => value),
  }),
  recapActionLabel: "Modifica aree",
  recapTitle: "Aree selezionate",
  regionsModeTitle: "In una o più aree",
  showAvailableFrom: false,
  testIDPrefix: "agent",
  write: (draft, active) => ({
    open_to_clubs: draft.preferences.includes("clubs"),
    open_to_players: draft.preferences.includes("players"),
    operating_area_type: draft.availability.mode,
    /*
      Solo i territori compatibili con la modalità attiva: passare a "Tutta
      Italia" svuota regioni e province invece di lasciarle in giro come
      selezione fantasma di una modalità che non è più quella scelta.
    */
    operating_provinces: active.provinces,
    operating_regions: active.regions,
  }),
  zonesTitle: "Area operativa",
};

export function AgentOpportunitiesScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useAgentProfilePatch(userId);

  return (
    <ProfileOpportunitiesScreen<AgentProfilePatchInput>
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
