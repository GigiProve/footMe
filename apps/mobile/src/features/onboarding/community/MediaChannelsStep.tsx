import { OnboardingPage, OnboardingSection, OnboardingTextField } from "../ui";
import type { MediaChannelKey } from "./media-channels";

type MediaChannelField = {
  key: MediaChannelKey;
  label: string;
  placeholder: string;
  keyboardType: "url" | "default";
};

/** §21: cinque canali, tutti facoltativi, sempre nello stesso ordine. */
const MEDIA_CHANNEL_FIELDS: MediaChannelField[] = [
  {
    key: "instagram",
    keyboardType: "default",
    label: "Instagram",
    placeholder: "@username o link",
  },
  {
    key: "tiktok",
    keyboardType: "default",
    label: "TikTok",
    placeholder: "@username o link",
  },
  {
    key: "youtube",
    keyboardType: "url",
    label: "YouTube",
    placeholder: "Link al canale o @handle",
  },
  {
    key: "facebook",
    keyboardType: "url",
    label: "Facebook",
    placeholder: "Link alla pagina",
  },
  {
    key: "website",
    keyboardType: "url",
    label: "Sito web",
    placeholder: "tuosito.it",
  },
];

type MediaChannelsStepProps = {
  currentStep: number;
  errors: Partial<Record<MediaChannelKey, string>>;
  isBusy: boolean;
  onBack: () => void;
  onBlurChannel: (key: MediaChannelKey) => void;
  onChangeChannel: (key: MediaChannelKey, value: string) => void;
  onContinue: () => void;
  stepLabel: string;
  totalSteps: number;
  values: Record<MediaChannelKey, string>;
};

/**
 * "Dove possiamo trovarti?" (REV-ONB-09 §21–§23).
 *
 * Nessun canale è obbligatorio: si può attraversare lo step senza scrivere
 * nulla. L'errore compare quando il campo perde il fuoco o si prova ad
 * avanzare, mai mentre si digita, e non cancella quello che è stato scritto.
 */
export function MediaChannelsStep({
  currentStep,
  errors,
  isBusy,
  onBack,
  onBlurChannel,
  onChangeChannel,
  onContinue,
  stepLabel,
  totalSteps,
  values,
}: MediaChannelsStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "media-channels-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Aggiungi i canali che vuoi mostrare sul tuo profilo. Potrai aggiornarli anche in seguito."
      testID="media-channels-step"
      title="Dove possiamo trovarti?"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        {MEDIA_CHANNEL_FIELDS.map((field) => (
          <OnboardingTextField
            autoCapitalize="none"
            autoCorrect={false}
            errorMessage={errors[field.key]}
            key={field.key}
            keyboardType={field.keyboardType}
            label={field.label}
            onBlur={() => onBlurChannel(field.key)}
            onChangeText={(value) => onChangeChannel(field.key, value)}
            optional
            placeholder={field.placeholder}
            testID={`media-channel-${field.key}`}
            value={values[field.key]}
          />
        ))}
      </OnboardingSection>
    </OnboardingPage>
  );
}
