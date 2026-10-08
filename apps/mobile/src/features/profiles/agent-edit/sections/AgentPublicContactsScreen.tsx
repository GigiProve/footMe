/**
 * Contatti pubblici del Procuratore (REV-PROF-16, schermata 8).
 *
 * La schermata vive in `edit/sections/ProfilePublicContactsScreen`, condivisa
 * con gli altri ruoli professionali: i toggle governano solo la visibilità,
 * il valore resta salvato e la privacy è applicata anche dal backend
 * (`get_profile_public_contacts` restituisce NULL per i canali spenti, e
 * `profile_contacts` ha una RLS owner-only).
 *
 * I cinque canali del mockup — telefono, email, Instagram, LinkedIn, sito web
 * — aprono l'elenco in quell'ordine. LinkedIn è stato aggiunto al modello con
 * questa task, perché la lista di validazioni lo richiede esplicitamente e un
 * canale mostrato ma non memorizzabile sarebbe stato una promessa a vuoto.
 *
 * La chat PROLINK non è un contatto e non ha un interruttore: resta
 * disponibile secondo le regole generali di messaggistica, qualunque cosa
 * accada qui.
 */
import { ProfilePublicContactsScreen } from "../../edit/sections/ProfilePublicContactsScreen";
import {
  useAgentSectionSave,
  useCompleteProfileQuery,
} from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

export function AgentPublicContactsScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useAgentSectionSave(userId);

  return (
    <ProfilePublicContactsScreen
      data={profileQuery.data}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => void profileQuery.refetch()}
      onSave={(data, patch, handlers) => save.mutate({ data, patch }, handlers)}
      profileType="agent"
      saving={save.isPending}
      testIDPrefix="agent"
    />
  );
}
