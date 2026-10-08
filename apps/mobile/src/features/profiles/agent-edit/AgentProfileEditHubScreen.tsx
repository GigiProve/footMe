/**
 * Hub "Modifica profilo" del Procuratore (REV-PROF-16, schermata 1).
 *
 * Il comportamento vive in `edit/ProfileEditHubScreen`, lo stesso indice che
 * serve Allenatore, Staff tecnico e Dirigente: qui restano la sorgente dei
 * dati, il registro delle voci e la copy del Procuratore.
 *
 * L'hub non salva niente e non ha una CTA globale: ogni riga porta a un
 * modulo che possiede il proprio stato, la propria validazione e il proprio
 * "Salva modifiche".
 *
 * L'unica aggiunta rispetto agli altri ruoli è una seconda lettura: il
 * conteggio degli assistiti non sta nel profilo, sta nella proiezione
 * pubblica del portfolio. È la stessa query della schermata di selezione,
 * quindi tornando indietro il numero è già aggiornato senza un refetch
 * dedicato — e un suo errore non impedisce all'hub di aprirsi, perché le
 * altre nove voci non ne dipendono.
 */
import { useCallback } from "react";

import { ProfileEditHubScreen } from "../edit/ProfileEditHubScreen";
import type { ProfileEditSectionKey } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import { AGENT_EDIT_SECTION_GROUPS } from "./agent-edit-sections";
import { useAgentPublicAssistitiQuery } from "./agent-featured-assistiti";
import { buildAgentSectionSummary } from "./agent-hub-summaries";
import { useCompleteProfileQuery } from "./agent-profile-edit-service";
import { useAgentEditorGuard } from "./use-agent-editor-guard";

export function AgentProfileEditHubScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const assistitiQuery = useAgentPublicAssistitiQuery(userId);
  const assistiti = assistitiQuery.data;

  const buildSummary = useCallback(
    (sectionId: ProfileEditSectionKey, data: CompleteProfessionalProfile) =>
      buildAgentSectionSummary(sectionId, data, assistiti),
    [assistiti],
  );

  return (
    <ProfileEditHubScreen
      buildSummary={buildSummary}
      data={profileQuery.data}
      getIdentity={(profile) => ({
        avatarUrl: profile.profile.avatar_url,
        name: profile.profile.full_name,
      })}
      groups={AGENT_EDIT_SECTION_GROUPS}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      onRetry={() => {
        void profileQuery.refetch();
        void assistitiQuery.refetch();
      }}
      openedEvent="agent_profile_edit_opened"
      profileType="agent"
      roleLabel="Procuratore sportivo"
      testIDPrefix="agent"
    />
  );
}
