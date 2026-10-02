/**
 * Fallback manuale della ricerca agenzia (REV-PROF-15 §"Fallback manuale").
 *
 * Quello che questa schermata crea è un riferimento privato, utilizzabile
 * soltanto dentro la carriera di chi lo scrive. Non crea una pagina pubblica,
 * non crea un account, non certifica l'esistenza dell'organizzazione, non
 * attribuisce permessi e non manda inviti. L'unica cosa che porta con sé è un
 * id stabile, che serve a tenere insieme gli incarichi svolti nello stesso
 * posto senza raggrupparli per somiglianza di nome.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  InfoMessage,
  OnboardingSection,
  OnboardingTextField,
} from "../../../onboarding/ui";

export type ManualOrganizationDraft = {
  city: string;
  country: string;
  name: string;
};

type AgentManualOrganizationStepProps = {
  draft: ManualOrganizationDraft;
  nameError?: string;
  onChange: (patch: Partial<ManualOrganizationDraft>) => void;
};

export function AgentManualOrganizationStep({
  draft,
  nameError,
  onChange,
}: AgentManualOrganizationStepProps) {
  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="bodySm">
        Indica i dati essenziali dell&apos;organizzazione. Resteranno nella tua
        carriera e non creeranno una pagina pubblica.
      </AppText>

      <OnboardingSection>
        <OnboardingTextField
          errorMessage={nameError}
          label="Nome dell'agenzia o dello studio"
          onChangeText={(value) => onChange({ name: value })}
          placeholder="Es. MB Football Management"
          testID="agent-manual-name"
          value={draft.name}
        />

        <OnboardingTextField
          label="Città"
          onChangeText={(value) => onChange({ city: value })}
          optional
          placeholder="Es. Milano"
          testID="agent-manual-city"
          value={draft.city}
        />

        {/* Il prodotto supporta esperienze all'estero (REV-ONB-06 §AA). */}
        <OnboardingTextField
          label="Paese"
          onChangeText={(value) => onChange({ country: value })}
          optional
          placeholder="Es. Italia"
          testID="agent-manual-country"
          value={draft.country}
        />
      </OnboardingSection>

      <InfoMessage message="L'organizzazione resta privata: non verrà creata una pagina su PROLINK e non verranno inviati inviti." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
});
