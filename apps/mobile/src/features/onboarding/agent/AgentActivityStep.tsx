import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  PROVINCE_OPTIONS,
  REGION_OPTIONS,
} from "../../profiles/profile-form-utils";
import type { AvailabilityType } from "../onboarding-form";
import { AvailabilityModeCard } from "../player/AvailabilityModeCard";
import { GeographicPickerScreen } from "../player/GeographicPickerScreen";
import { buildAvailabilitySummary } from "../player/geographic-availability";
import {
  InlineError,
  OnboardingChipMultiSelect,
  OnboardingMultiSelectField,
  OnboardingPage,
  OnboardingSection,
  ToggleRow,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import {
  getAgentOperatingAreaError,
  isAgentOperatingAreaComplete,
  type AgentOperatingAreaDraft,
} from "./agent-operating-area";
import {
  AGENT_ACTIVITY_SCOPE_OPTIONS,
  AGENT_COUNTRY_OPTIONS,
  type AgentActivityScope,
} from "./agent-taxonomy";

type InternalScreen = "main" | "regions" | "provinces";

type AgentActivityStepProps = {
  countries: string[];
  currentStep: number;
  draft: AgentOperatingAreaDraft;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onCountriesChange: (values: string[]) => void;
  onDraftChange: (draft: AgentOperatingAreaDraft) => void;
  onProvincesConfirmed?: (count: number) => void;
  onRegionsConfirmed?: (count: number) => void;
  /** Back di sistema mentre siamo in una schermata interna dello step. */
  onRegisterBack?: (handler: (() => void) | null) => void;
  onScopesChange: (values: AgentActivityScope[]) => void;
  onWorksAbroadChange: (value: boolean) => void;
  scopes: AgentActivityScope[];
  stepLabel: string;
  totalSteps: number;
  worksAbroad: boolean;
};

/**
 * "La tua attività" (REV-ONB-06 §X–§AH).
 *
 * Sostituisce la vecchia schermata frammentata in focus operativi, macro
 * aree, regioni scritte a mano e nota operativa. Gli ambiti sono categorie
 * operative chiuse (§Y, §Z); le aree riusano le tre modalità geografiche già
 * approvate per il Calciatore (§AA), quindi Nord/Centro/Sud/Isole spariscono
 * (§AE) e le regioni diventano entity strutturate (§AG).
 *
 * La descrizione professionale si scrive una volta sola, nella Bio (§AH).
 */
export function AgentActivityStep({
  countries,
  currentStep,
  draft,
  isBusy,
  onBack,
  onContinue,
  onCountriesChange,
  onDraftChange,
  onProvincesConfirmed,
  onRegionsConfirmed,
  onRegisterBack,
  onScopesChange,
  onWorksAbroadChange,
  scopes,
  stepLabel,
  totalSteps,
  worksAbroad,
}: AgentActivityStepProps) {
  const [screen, setScreen] = useState<InternalScreen>("main");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (screen === "main") {
      onRegisterBack?.(null);
      return undefined;
    }

    onRegisterBack?.(() => setScreen("main"));

    return () => onRegisterBack?.(null);
  }, [onRegisterBack, screen]);

  function handleSelectMode(mode: AvailabilityType) {
    setShowErrors(false);
    onDraftChange({ ...draft, mode });

    // §AB: "Ovunque in Italia" è già una risposta completa.
    if (mode === "REGIONS") {
      setScreen("regions");
      return;
    }

    if (mode === "PROVINCES") {
      setScreen("provinces");
    }
  }

  function handleContinue() {
    if (scopes.length === 0 || !isAgentOperatingAreaComplete(draft)) {
      setShowErrors(true);
      return;
    }

    onContinue();
  }

  if (screen === "regions" || screen === "provinces") {
    const isRegions = screen === "regions";

    return (
      <GeographicPickerScreen
        currentStep={currentStep}
        emptyStateMessage={
          isRegions ? "Nessuna regione trovata" : "Nessuna provincia trovata"
        }
        onBack={() => setScreen("main")}
        onChange={(values) =>
          onDraftChange(
            isRegions
              ? { ...draft, regions: values }
              : { ...draft, provinces: values },
          )
        }
        onConfirm={() => {
          if (isRegions) {
            onRegionsConfirmed?.(draft.regions.length);
          } else {
            onProvincesConfirmed?.(draft.provinces.length);
          }

          setScreen("main");
        }}
        options={isRegions ? REGION_OPTIONS : PROVINCE_OPTIONS}
        searchPlaceholder={isRegions ? "Cerca regione" : "Cerca provincia"}
        stepLabel={stepLabel}
        subtitle={
          isRegions
            ? "Puoi scegliere una o più regioni."
            : "Puoi scegliere una o più province."
        }
        testID={
          isRegions ? "agent-activity-regions" : "agent-activity-provinces"
        }
        title={isRegions ? "Seleziona le regioni" : "Seleziona le province"}
        totalSteps={totalSteps}
        unit={isRegions ? "regione" : "provincia"}
        values={isRegions ? draft.regions : draft.provinces}
      />
    );
  }

  const modeError = showErrors ? getAgentOperatingAreaError(draft) : undefined;

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: handleContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "agent-activity-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Definisci i mercati e le tipologie di opportunità su cui lavori più spesso."
      testID="agent-activity-step"
      title="La tua attività"
      totalSteps={totalSteps}
    >
      <OnboardingSection
        description="Puoi scegliere più opzioni."
        title="Ambiti di attività"
      >
        <OnboardingChipMultiSelect
          errorMessage={
            showErrors && scopes.length === 0
              ? "Seleziona almeno un ambito di attività."
              : undefined
          }
          onChange={(values) => {
            setShowErrors(false);
            onScopesChange(values);
          }}
          options={AGENT_ACTIVITY_SCOPE_OPTIONS}
          testID="agent-activity-scopes"
          values={scopes}
        />
      </OnboardingSection>

      <OnboardingSection
        description="Scegli dove operi abitualmente."
        title="Aree operative in Italia"
      >
        <View style={styles.modeList}>
          <AvailabilityModeCard
            affordance="direct"
            description="Lavoro su tutto il territorio nazionale."
            icon="globe-outline"
            onPress={() => handleSelectMode("ITALY")}
            selected={draft.mode === "ITALY"}
            testID="agent-activity-mode-italy"
            title="Ovunque in Italia"
          />

          <AvailabilityModeCard
            affordance="drilldown"
            description="Seleziona le regioni in cui operi."
            icon="map-outline"
            onPress={() => handleSelectMode("REGIONS")}
            selected={draft.mode === "REGIONS"}
            summary={
              draft.mode === "REGIONS"
                ? buildAvailabilitySummary(draft.regions.length, "regione")
                : undefined
            }
            testID="agent-activity-mode-regions"
            title="In una o più regioni"
          />

          <AvailabilityModeCard
            affordance="drilldown"
            description="Seleziona le province in cui operi."
            icon="location-outline"
            onPress={() => handleSelectMode("PROVINCES")}
            selected={draft.mode === "PROVINCES"}
            summary={
              draft.mode === "PROVINCES"
                ? buildAvailabilitySummary(draft.provinces.length, "provincia")
                : undefined
            }
            testID="agent-activity-mode-provinces"
            title="Zone specifiche"
          />
        </View>

        <InlineError message={modeError} />
      </OnboardingSection>

      <OnboardingSection>
        {/* §AF: con il controllo spento non compare nessun altro campo. */}
        <ToggleRow
          label="Opero anche all'estero"
          onValueChange={onWorksAbroadChange}
          testID="agent-works-abroad-toggle"
          value={worksAbroad}
        >
          <OnboardingMultiSelectField
            label="Paesi"
            onChange={onCountriesChange}
            options={AGENT_COUNTRY_OPTIONS}
            placeholder="Seleziona i paesi"
            searchable
            sheetTitle="Paesi"
            testID="agent-activity-countries"
            values={countries}
          />
        </ToggleRow>
      </OnboardingSection>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  modeList: {
    gap: onboardingSpacing.s + 4,
  },
});
