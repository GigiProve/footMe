import { View } from "react-native";

import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { ProfileField as Field } from "../profile-screen-components";
import { SectionCard } from "../../../ui";

type AgentInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

export function AgentInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: AgentInfoTabProps) {
  const agentProfile = completeProfile.agentProfile;
  const canEdit = (section: EditSection) => (isOwner ? () => onEdit(section) : undefined);

  return (
    <View>
      <SectionCard
        onEdit={canEdit("personalInfo")}
        title="Informazioni personali"
        variant="flat"
      >
        <Field
          label="Città"
          value={completeProfile.profile.city ?? ""}
          variant="plain"
        />
        <Field
          label="Regione"
          value={completeProfile.profile.region ?? ""}
          variant="plain"
        />
        <Field
          label="Lingue"
          value={completeProfile.profile.languages.join(", ")}
          variant="plain"
        />
      </SectionCard>

      <SectionCard
        onEdit={canEdit("agentProfile")}
        title="Posizionamento"
        variant="flat"
      >
        <Field
          label="Agenzia attuale"
          value={agentProfile?.agency_name ?? ""}
          variant="plain"
        />
        <Field
          label="Ruolo"
          value={agentProfile?.agency_role ?? ""}
          variant="plain"
        />
        <Field
          label="Federazione"
          value={
            agentProfile?.is_federation_licensed
              ? agentProfile.federation ?? "Licenza attiva"
              : "Non indicata"
          }
          variant="plain"
        />
        <Field
          label="Aperto a club"
          value={agentProfile?.open_to_clubs ? "Sì" : "No"}
          variant="plain"
        />
        <Field
          label="Aperto a calciatori"
          value={agentProfile?.open_to_players ? "Sì" : "No"}
          variant="plain"
        />
      </SectionCard>

      <SectionCard
        onEdit={canEdit("agentProfile")}
        title="Operatività"
        variant="flat"
      >
        <Field
          label="Focus operativi"
          value={(agentProfile?.operational_focuses ?? []).join(", ")}
          variant="plain"
        />
        <Field
          label="Macro aree"
          value={(agentProfile?.operating_macro_areas ?? []).join(", ")}
          variant="plain"
        />
        <Field
          label="Regioni"
          value={(agentProfile?.operating_regions ?? []).join(", ")}
          variant="plain"
        />
        <Field
          label="Nota operativa"
          value={agentProfile?.operational_note ?? ""}
          variant="plain"
        />
      </SectionCard>

      <SectionCard
        onEdit={canEdit("agentProfile")}
        title="Background"
        variant="flat"
      >
        <Field
          label="Altre esperienze calcistiche"
          value={
            agentProfile?.has_other_football_experience
              ? (agentProfile.other_football_roles ?? []).join(", ")
              : "Nessuna indicata"
          }
          variant="plain"
        />
        <Field
          label="Ha giocato a calcio"
          value={agentProfile?.has_played_football ? "Sì" : "No"}
          variant="plain"
        />
      </SectionCard>

      <SectionCard
        onEdit={canEdit("contact")}
        title="Contatti"
        variant="flat"
      >
        <Field
          label="Email"
          value={completeProfile.userContacts.email}
          variant="plain"
        />
        <Field
          label="Telefono"
          value={completeProfile.userContacts.phone}
          variant="plain"
        />
        <Field
          label="Instagram"
          value={completeProfile.userContacts.instagram}
          variant="plain"
        />
      </SectionCard>
    </View>
  );
}
