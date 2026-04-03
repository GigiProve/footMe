import { StyleSheet, View } from "react-native";

import { Input } from "../../../ui";
import { AppText } from "../../../ui/AppText/AppText";
import { spacing } from "../../../theme/tokens";
import { OnboardingSectionCard } from "../onboarding-ui";

type MediaEntityStepProps = {
  description: string;
  entityName: string;
  errorMessage?: string;
  onUpdate: (patch: {
    mediaEntityDescription?: string;
    mediaEntityName?: string;
  }) => void;
};

export function MediaEntityStep({
  description,
  entityName,
  errorMessage,
  onUpdate,
}: MediaEntityStepProps) {
  return (
    <OnboardingSectionCard
      title="La tua pagina o realtà"
      subtitle="Inserisci le informazioni principali del tuo profilo media."
    >
      <View style={styles.fieldGroup}>
        <Input
          label="Nome pagina, realtà o testata"
          onChangeText={(value) => onUpdate({ mediaEntityName: value })}
          placeholder="Es. TuttoDilettanti"
          value={entityName}
        />
        {errorMessage ? (
          <AppText variant="caption" color="danger">
            {errorMessage}
          </AppText>
        ) : null}
      </View>

      <Input
        label="Descrizione breve"
        multiline
        onChangeText={(value) => onUpdate({ mediaEntityDescription: value })}
        placeholder="Es. Pagina dedicata agli aggiornamenti sul calcio regionale..."
        value={description}
      />
      <AppText variant="caption" color="secondary">
        Può essere una pagina social, un sito, una testata locale o un progetto editoriale.
      </AppText>
    </OnboardingSectionCard>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[8],
  },
});
