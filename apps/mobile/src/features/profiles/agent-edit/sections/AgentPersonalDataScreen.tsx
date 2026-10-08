/**
 * Foto e dati personali del Procuratore (REV-PROF-16, schermata 2).
 *
 * La schermata vive in `edit/sections/ProfilePersonalDataScreen`, condivisa
 * con Allenatore, Staff tecnico e Dirigente: copertina con "Modifica
 * copertina", comando fotocamera sovrapposto all'avatar — mai un pulsante
 * rettangolare separato "Modifica foto" — e form anagrafico con il toggle del
 * domicilio sono gli stessi.
 *
 * Telefono ed email non compaiono qui: sono contatti, e il loro modulo è
 * "Contatti pubblici". Duplicarli avrebbe creato due posti da cui cambiare lo
 * stesso recapito.
 */
import {
  ProfilePersonalDataScreen,
  type ProfilePersonalDataConfig,
} from "../../edit/sections/ProfilePersonalDataScreen";
import {
  useAgentSectionSave,
  useCompleteProfileQuery,
} from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

const CONFIG: ProfilePersonalDataConfig = {
  profileType: "agent",
  testIDPrefix: "agent",
};

export function AgentPersonalDataScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useAgentSectionSave(userId);

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
