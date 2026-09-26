import { StyleSheet, View } from "react-native";

import {
  DateSelector,
  InlineError,
  OnboardingPage,
  OnboardingSection,
  OnboardingSelectField,
  OnboardingTextField,
  PhotoPicker,
  SelectionRow,
} from "../ui";
import { onboardingLayout } from "../ui/onboarding-tokens";
import {
  AGENT_AGENCY_ROLE_OPTIONS,
  AGENT_PROFESSIONAL_MODE_OPTIONS,
  AGENT_START_YEAR_FIRST,
  getAgentStartYearLast,
  type AgentProfessionalMode,
} from "./agent-taxonomy";

type AgentProfessionalStepProps = {
  agencyLogoUrl: string;
  agencyName: string;
  agencyRole: string;
  agencyStartYear: string;
  currentStep: number;
  isBusy: boolean;
  isUploadingLogo: boolean;
  mode: AgentProfessionalMode;
  onAgencyNameChange: (value: string) => void;
  onAgencyRoleChange: (value: string) => void;
  onAgencyStartYearChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onModeChange: (mode: Exclude<AgentProfessionalMode, "">) => void;
  onPickLogoFromLibrary: () => void;
  onRemoveLogo: () => void;
  onTakeLogoPhoto: () => void;
  stepLabel: string;
  totalSteps: number;
  validationErrors: Partial<Record<string, string>>;
};

/**
 * "Il tuo profilo professionale" (REV-ONB-06 §H–§M).
 *
 * La prima domanda è come si lavora, perché è quella che decide cosa ha senso
 * chiedere dopo: un procuratore indipendente non ha un'agenzia, e non gliela
 * si chiede (§I). I campi dell'agenzia compaiono solo dopo la scelta, in
 * progressive disclosure (§J).
 *
 * Niente copy tecnico, niente riferimenti a mockup o a come il dato viene
 * salvato (§M): il logo è opzionale e lo dice la label, non un box informativo
 * (§L).
 */
export function AgentProfessionalStep({
  agencyLogoUrl,
  agencyName,
  agencyRole,
  agencyStartYear,
  currentStep,
  isBusy,
  isUploadingLogo,
  mode,
  onAgencyNameChange,
  onAgencyRoleChange,
  onAgencyStartYearChange,
  onBack,
  onContinue,
  onModeChange,
  onPickLogoFromLibrary,
  onRemoveLogo,
  onTakeLogoPhoto,
  stepLabel,
  totalSteps,
  validationErrors,
}: AgentProfessionalStepProps) {
  const isAgency = mode === "agency";

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy || isUploadingLogo,
        primaryTestID: "agent-professional-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Indica come lavori e presenta la tua attività professionale."
      testID="agent-professional-step"
      title="Il tuo profilo professionale"
      totalSteps={totalSteps}
    >
      <OnboardingSection title="Come lavori?">
        <View accessibilityRole="radiogroup" style={styles.options}>
          {AGENT_PROFESSIONAL_MODE_OPTIONS.map((option) => (
            <SelectionRow
              control="radio"
              description={option.description}
              key={option.value}
              label={option.label}
              onPress={() => onModeChange(option.value)}
              selected={mode === option.value}
              testID={`agent-professional-mode-${option.value}`}
            />
          ))}
        </View>

        <InlineError message={validationErrors.agentProfessionalMode} />
      </OnboardingSection>

      {/* §J: i dati dell'agenzia esistono solo per chi ne fa parte. */}
      {isAgency ? (
        <OnboardingSection title="La tua agenzia">
          <OnboardingTextField
            autoCapitalize="words"
            errorMessage={validationErrors.agentAgencyName}
            label="Nome agenzia / studio"
            onChangeText={onAgencyNameChange}
            placeholder="Es. MB Football Management"
            testID="agent-agency-name"
            value={agencyName}
          />

          <OnboardingSelectField
            allowClear
            errorMessage={validationErrors.agentAgencyRole}
            label="Ruolo attuale"
            onChange={onAgencyRoleChange}
            options={AGENT_AGENCY_ROLE_OPTIONS}
            placeholder="Seleziona il ruolo"
            sheetTitle="Ruolo attuale"
            testID="agent-agency-role"
            value={agencyRole}
          />

          {/* §K: anno da picker, mai un campo libero senza validazione. */}
          <DateSelector
            errorMessage={validationErrors.agentAgencyStartYear}
            firstYear={AGENT_START_YEAR_FIRST}
            label="Anno di inizio attività"
            lastYear={getAgentStartYearLast()}
            mode="year"
            onChange={onAgencyStartYearChange}
            placeholder="Seleziona l'anno"
            sheetTitle="Anno di inizio attività"
            testID="agent-agency-start-year"
            value={agencyStartYear}
          />
        </OnboardingSection>
      ) : null}

      {isAgency ? (
        <OnboardingSection description="Puoi aggiungerlo anche più avanti." title="Logo agenzia">
          <PhotoPicker
            addLabel="Aggiungi logo"
            onPickFromLibrary={onPickLogoFromLibrary}
            onRemove={agencyLogoUrl ? onRemoveLogo : undefined}
            onTakePhoto={onTakeLogoPhoto}
            placeholderIcon="business-outline"
            replaceLabel="Cambia logo"
            shape="square"
            sheetTitle="Logo agenzia"
            testID="agent-agency-logo"
            uploading={isUploadingLogo}
            value={agencyLogoUrl}
          />
        </OnboardingSection>
      ) : null}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: onboardingLayout.labelGap + 2,
  },
});
