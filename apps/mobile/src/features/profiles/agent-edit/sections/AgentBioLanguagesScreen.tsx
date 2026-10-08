/**
 * Bio e lingue del Procuratore (REV-PROF-16, schermata 6).
 *
 * La schermata vive in `edit/sections/ProfileBioLanguagesScreen`, condivisa
 * con il Dirigente: bio su `profiles` e non su `agent_profiles` — è dell'utente,
 * non del mestiere — limite a 300 caratteri senza troncamenti silenziosi, e
 * lingue dallo stesso selector dell'onboarding Procuratore.
 *
 * L'onboarding accetta fino a 1000 caratteri (`AGENT_BIO_MAX_LENGTH`): questa
 * review abbassa il limite senza toccare quel flusso, e una bio storica più
 * lunga resta leggibile finché non viene accorciata.
 */
import {
  ProfileBioLanguagesScreen,
  type ProfileBioLanguagesConfig,
} from "../../edit/sections/ProfileBioLanguagesScreen";
import {
  useAgentSectionSave,
  useCompleteProfileQuery,
} from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

const CONFIG: ProfileBioLanguagesConfig = {
  bioDescription:
    "Racconta in modo sintetico la tua esperienza e il tuo approccio.",
  bioPlaceholder:
    "Procuratore sportivo con esperienza nella valorizzazione dei giovani e nella costruzione di percorsi professionali sostenibili.",
  profileType: "agent",
  testIDPrefix: "agent",
};

export function AgentBioLanguagesScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useAgentSectionSave(userId);

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
