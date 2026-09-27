import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import { MediaChannelsStep } from "./MediaChannelsStep";
import { MediaChipSelectionStep } from "./MediaChipSelectionStep";
import { MediaCreatorTypeStep } from "./MediaCreatorTypeStep";
import { MediaProjectImageStep } from "./MediaProjectImageStep";
import { MediaProjectStep } from "./MediaProjectStep";
import type { MediaChannelKey } from "./media-channels";
import {
  MEDIA_CONTENT_TYPE_OPTIONS,
  MEDIA_SCOPE_OPTIONS,
  type MediaCreatorType,
} from "./media-taxonomy";

/** Passi che esistono solo nel ramo Media / Creator (REV-ONB-09 §3). */
const MEDIA_ONLY_STEPS: OnboardingStep[] = [
  "media_entity",
  "media_type",
  "media_logo",
  "media_content",
  "media_focus",
  "media_channels",
];

export function isMediaMasterStep(step: OnboardingStep, role: string) {
  return role === "media" && MEDIA_ONLY_STEPS.includes(step);
}

type MediaOnboardingFlowProps = {
  channelErrors: Partial<Record<MediaChannelKey, string>>;
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  logoPreviewUrl: string | null;
  onBack: () => void;
  onBlurChannel: (key: MediaChannelKey) => void;
  onChangeChannel: (key: MediaChannelKey, value: string) => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromChannels: () => void;
  onContinueFromContentTypes: () => void;
  onContinueFromCreatorType: () => void;
  onContinueFromProject: () => void;
  onContinueFromProjectImage: () => void;
  onContinueFromScopes: () => void;
  onPatchForm: (patch: Partial<OnboardingFormState>) => void;
  onPickLogoFromLibrary: () => void;
  onRemoveLogo: () => void;
  onSelectCreatorType: (value: MediaCreatorType) => void;
  onSelectedContentTypes: (values: string[]) => void;
  onSelectedScopes: (values: string[]) => void;
  onTakeLogoPhoto: () => void;
  step: OnboardingStep;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Passi propri del Media / Creator (REV-ONB-09).
 *
 * Identità personale e foto non passano di qui: sono i componenti comuni del
 * Master, instradati da `CommunityOnboardingFlow` come per il Tifoso. Qui
 * vive solo ciò che qualifica il progetto — che realtà è, che faccia ha, che
 * contenuti produce, che calcio racconta e dove lo si trova.
 */
export function MediaOnboardingFlow({
  channelErrors,
  counter,
  form,
  isBusy,
  logoPreviewUrl,
  onBack,
  onBlurChannel,
  onChangeChannel,
  onClearValidationErrors,
  onContinueFromChannels,
  onContinueFromContentTypes,
  onContinueFromCreatorType,
  onContinueFromProject,
  onContinueFromProjectImage,
  onContinueFromScopes,
  onPatchForm,
  onPickLogoFromLibrary,
  onRemoveLogo,
  onSelectCreatorType,
  onSelectedContentTypes,
  onSelectedScopes,
  onTakeLogoPhoto,
  step,
  validationErrors,
}: MediaOnboardingFlowProps) {
  if (step === "media_entity") {
    return (
      <MediaProjectStep
        currentStep={counter.current}
        description={form.mediaEntityDescription}
        errorMessage={validationErrors.mediaEntityName}
        isBusy={isBusy}
        name={form.mediaEntityName}
        onBack={onBack}
        onContinue={onContinueFromProject}
        onDescriptionChange={(value) =>
          onPatchForm({ mediaEntityDescription: value })
        }
        onNameChange={(value) => {
          onPatchForm({ mediaEntityName: value });
          onClearValidationErrors(["mediaEntityName"]);
        }}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "media_type") {
    return (
      <MediaCreatorTypeStep
        currentStep={counter.current}
        errorMessage={validationErrors.mediaCreatorType}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromCreatorType}
        onOtherLabelChange={(value) => {
          onPatchForm({ mediaCreatorTypeOther: value });
          onClearValidationErrors(["mediaCreatorTypeOther"]);
        }}
        onSelect={onSelectCreatorType}
        otherErrorMessage={validationErrors.mediaCreatorTypeOther}
        otherLabel={form.mediaCreatorTypeOther}
        selectedValue={form.mediaCreatorType}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "media_logo") {
    return (
      <MediaProjectImageStep
        currentStep={counter.current}
        isUploading={form.uploadingField === "media-logo"}
        logoUrl={logoPreviewUrl}
        onBack={onBack}
        onContinue={onContinueFromProjectImage}
        onPickFromLibrary={onPickLogoFromLibrary}
        onRemove={form.mediaLogoUrl ? onRemoveLogo : undefined}
        onTakePhoto={onTakeLogoPhoto}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "media_content") {
    return (
      <MediaChipSelectionStep
        currentStep={counter.current}
        errorMessage={validationErrors.mediaContentTypes}
        isBusy={isBusy}
        onBack={onBack}
        onChange={onSelectedContentTypes}
        onContinue={onContinueFromContentTypes}
        options={MEDIA_CONTENT_TYPE_OPTIONS}
        stepLabel={counter.label}
        subtitle="Seleziona uno o più tipi di contenuti che descrivono il tuo lavoro."
        testID="media-content-types-step"
        title="Che tipo di contenuti crei?"
        totalSteps={counter.total}
        values={form.mediaContentTypes}
      />
    );
  }

  if (step === "media_focus") {
    return (
      <MediaChipSelectionStep
        currentStep={counter.current}
        errorMessage={validationErrors.mediaFocusAreas}
        isBusy={isBusy}
        onBack={onBack}
        onChange={onSelectedScopes}
        onContinue={onContinueFromScopes}
        options={MEDIA_SCOPE_OPTIONS}
        stepLabel={counter.label}
        subtitle="Quali aree del calcio racconti principalmente?"
        testID="media-scopes-step"
        title="Ambito principale"
        totalSteps={counter.total}
        values={form.mediaFocusAreas}
      />
    );
  }

  return (
    <MediaChannelsStep
      currentStep={counter.current}
      errors={channelErrors}
      isBusy={isBusy}
      onBack={onBack}
      onBlurChannel={onBlurChannel}
      onChangeChannel={onChangeChannel}
      onContinue={onContinueFromChannels}
      stepLabel={counter.label}
      totalSteps={counter.total}
      values={{
        facebook: form.mediaFacebook,
        instagram: form.mediaInstagram,
        tiktok: form.mediaTikTok,
        website: form.mediaWebsite,
        youtube: form.mediaYouTube,
      }}
    />
  );
}
