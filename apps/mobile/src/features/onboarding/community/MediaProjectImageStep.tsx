import { StyleSheet, View } from "react-native";

import { AppText } from "../../../ui";
import { OnboardingPage, PhotoPicker } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";

type MediaProjectImageStepProps = {
  currentStep: number;
  errorMessage?: string;
  isUploading: boolean;
  logoUrl: string | null;
  onBack: () => void;
  onContinue: () => void;
  onPickFromLibrary: () => void;
  onRemove?: () => void;
  onTakePhoto: () => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Aggiungi un'immagine al tuo progetto" (REV-ONB-09 §15, §16, §31).
 *
 * Ha uno step tutto suo perché nella versione precedente viveva schiacciato
 * in fondo alla schermata della pagina. Qui l'area di upload ha l'aria che
 * le serve — e resta un'immagine separata dalla foto profilo personale:
 * caricare l'una non tocca mai l'altra.
 */
export function MediaProjectImageStep({
  currentStep,
  errorMessage,
  isUploading,
  logoUrl,
  onBack,
  onContinue,
  onPickFromLibrary,
  onRemove,
  onTakePhoto,
  stepLabel,
  totalSteps,
}: MediaProjectImageStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryDisabled: isUploading,
        primaryLabel: "Continua",
        primaryTestID: "media-project-image-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Carica un logo o un'immagine che renda riconoscibile la tua pagina, testata o progetto."
      testID="media-project-image-step"
      title="Aggiungi un'immagine al tuo progetto"
      totalSteps={totalSteps}
    >
      <View style={styles.uploadArea}>
        <PhotoPicker
          addLabel="Aggiungi immagine"
          errorMessage={errorMessage}
          onPickFromLibrary={onPickFromLibrary}
          onRemove={onRemove}
          onRetry={onPickFromLibrary}
          onTakePhoto={onTakePhoto}
          placeholderIcon="image-outline"
          replaceLabel="Cambia immagine"
          shape="square"
          sheetTitle="Immagine del progetto"
          testID="media-project-image-picker"
          uploading={isUploading}
          value={logoUrl}
        />
      </View>

      <AppText align="center" color="muted" variant="meta">
        È diversa dalla tua foto profilo personale. Puoi aggiungerla anche più
        tardi.
      </AppText>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  uploadArea: {
    paddingBottom: onboardingSpacing.l,
    paddingTop: onboardingSpacing.m,
  },
});
