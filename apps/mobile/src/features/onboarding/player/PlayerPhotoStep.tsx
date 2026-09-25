import { AppText } from "../../../ui";
import { OnboardingPage, PhotoPicker } from "../ui";

type PlayerPhotoStepProps = {
  avatarUrl: string | null;
  currentStep: number;
  isUploading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onPickFromLibrary: () => void;
  onRemove?: () => void;
  onTakePhoto: () => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Step "Aggiungi una foto" del Calciatore (REV-ONB-02 §K).
 *
 * Anteprima circolare e una microcopy sola: nessun box informativo, nessun
 * elenco di consigli (§K, §BU).
 */
export function PlayerPhotoStep({
  avatarUrl,
  currentStep,
  isUploading,
  onBack,
  onContinue,
  onPickFromLibrary,
  onRemove,
  onTakePhoto,
  stepLabel,
  totalSteps,
}: PlayerPhotoStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryDisabled: isUploading,
        primaryLabel: "Continua",
        primaryTestID: "photo-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Questa foto rappresenterà il tuo profilo su ProLink."
      testID="player-photo-step"
      title="Aggiungi una foto"
      totalSteps={totalSteps}
    >
      <PhotoPicker
        onPickFromLibrary={onPickFromLibrary}
        onRemove={onRemove}
        onRetry={onPickFromLibrary}
        onTakePhoto={onTakePhoto}
        shape="circle"
        testID="player-photo-picker"
        uploading={isUploading}
        value={avatarUrl}
      />

      <AppText align="center" color="muted" variant="meta">
        Puoi aggiornarla anche più tardi dalle impostazioni.
      </AppText>
    </OnboardingPage>
  );
}
