import { StyleSheet, View } from "react-native";

import { AppText, Input } from "../../../ui";
import { spacing } from "../../../theme/tokens";
import { OnboardingSectionCard } from "../onboarding-ui";

type MediaChannelsStepProps = {
  facebook: string;
  instagram: string;
  tikTok: string;
  website: string;
  youTube: string;
  onUpdate: (patch: {
    mediaFacebook?: string;
    mediaInstagram?: string;
    mediaTikTok?: string;
    mediaWebsite?: string;
    mediaYouTube?: string;
  }) => void;
};

export function MediaChannelsStep({
  facebook,
  instagram,
  tikTok,
  website,
  youTube,
  onUpdate,
}: MediaChannelsStepProps) {
  return (
    <OnboardingSectionCard
      title="Collega i tuoi canali"
      subtitle="Aggiungi i link principali. Puoi inserire username o URL completi."
    >
      <View style={styles.fieldGroup}>
        <Input
          autoCapitalize="none"
          label="Instagram"
          onChangeText={(value) => onUpdate({ mediaInstagram: value })}
          placeholder="@username o link"
          value={instagram}
        />
        <Input
          autoCapitalize="none"
          label="TikTok"
          onChangeText={(value) => onUpdate({ mediaTikTok: value })}
          placeholder="@username o link"
          value={tikTok}
        />
        <Input
          autoCapitalize="none"
          label="YouTube"
          onChangeText={(value) => onUpdate({ mediaYouTube: value })}
          placeholder="Link al canale"
          value={youTube}
        />
        <Input
          autoCapitalize="none"
          label="Facebook"
          onChangeText={(value) => onUpdate({ mediaFacebook: value })}
          placeholder="Link alla pagina"
          value={facebook}
        />
        <Input
          autoCapitalize="none"
          keyboardType="url"
          label="Sito web"
          onChangeText={(value) => onUpdate({ mediaWebsite: value })}
          placeholder="https://"
          value={website}
        />
      </View>

      <AppText variant="caption" color="secondary">
        Compila solo i canali che vuoi mostrare subito. Potrai aggiornarli anche in seguito.
      </AppText>
    </OnboardingSectionCard>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[12],
  },
});
