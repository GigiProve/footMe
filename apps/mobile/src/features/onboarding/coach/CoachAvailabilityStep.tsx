import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  PROVINCE_OPTIONS,
  REGION_OPTIONS,
} from "../../profiles/profile-form-utils";
import type { AvailabilityType } from "../onboarding-form";
import { AvailabilityModeCard } from "../player/AvailabilityModeCard";
import { GeographicPickerScreen } from "../player/GeographicPickerScreen";
import {
  buildAvailabilitySummary,
  getAvailabilityErrorMessage,
  isAvailabilityComplete,
  type GeographicAvailabilityDraft,
} from "../player/geographic-availability";
import {
  DateSelector,
  InlineError,
  OnboardingPage,
  OnboardingSection,
  ToggleRow,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";

type InternalScreen = "mode" | "regions" | "provinces";

type CoachAvailabilityStepProps = {
  availableFrom: string;
  currentStep: number;
  draft: GeographicAvailabilityDraft;
  isAvailable: boolean;
  isBusy: boolean;
  onAvailableFromChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onDraftChange: (draft: GeographicAvailabilityDraft) => void;
  onIsAvailableChange: (value: boolean) => void;
  /** Back di sistema mentre siamo in una schermata interna dello step (§AT). */
  onRegisterBack?: (handler: (() => void) | null) => void;
  stepLabel: string;
  totalSteps: number;
};

/** §I: la disponibilità guarda avanti, ma resta raggiungibile anche l'anno in corso. */
const AVAILABLE_FROM_FIRST_YEAR = new Date().getFullYear() - 1;
const AVAILABLE_FROM_LAST_YEAR = new Date().getFullYear() + 6;

/**
 * Step "Disponibilità" dell'Allenatore (REV-ONB-03 §G–§N).
 *
 * Un solo passo, tre schermate: modalità, eventuale selezione di regioni o
 * province, ritorno. Il contatore non cambia, perché il macro-step è uno solo
 * (§AR).
 *
 * La logica geografica è quella definitiva approvata per il Calciatore
 * (REV-ONB-02): stesse tre modalità, stesso selettore, stesso riepilogo
 * sotto la card.
 */
export function CoachAvailabilityStep({
  availableFrom,
  currentStep,
  draft,
  isAvailable,
  isBusy,
  onAvailableFromChange,
  onBack,
  onContinue,
  onDraftChange,
  onIsAvailableChange,
  onRegisterBack,
  stepLabel,
  totalSteps,
}: CoachAvailabilityStepProps) {
  const [screen, setScreen] = useState<InternalScreen>("mode");
  const [showErrors, setShowErrors] = useState(false);

  const modeError =
    showErrors && isAvailable ? getAvailabilityErrorMessage(draft) : undefined;

  useEffect(() => {
    if (screen === "mode") {
      onRegisterBack?.(null);
      return undefined;
    }

    onRegisterBack?.(() => setScreen("mode"));

    return () => onRegisterBack?.(null);
  }, [onRegisterBack, screen]);

  function handleSelectMode(mode: AvailabilityType) {
    setShowErrors(false);
    onDraftChange({ ...draft, mode });

    if (mode === "REGIONS") {
      setScreen("regions");
      return;
    }

    if (mode === "PROVINCES") {
      setScreen("provinces");
    }
  }

  function handleContinue() {
    // §N: con il toggle spento non si chiede né la zona né il "disponibile da".
    if (isAvailable && !isAvailabilityComplete(draft)) {
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
        onBack={() => setScreen("mode")}
        onChange={(values) =>
          onDraftChange(
            isRegions
              ? { ...draft, regions: values }
              : { ...draft, provinces: values },
          )
        }
        onConfirm={() => setScreen("mode")}
        options={isRegions ? REGION_OPTIONS : PROVINCE_OPTIONS}
        searchPlaceholder={isRegions ? "Cerca regione" : "Cerca provincia"}
        stepLabel={stepLabel}
        subtitle={
          isRegions
            ? "Puoi scegliere una o più regioni."
            : "Puoi scegliere una o più province."
        }
        testID={
          isRegions ? "coach-availability-regions" : "coach-availability-provinces"
        }
        title={isRegions ? "Seleziona le regioni" : "Seleziona le province"}
        totalSteps={totalSteps}
        unit={isRegions ? "regione" : "provincia"}
        values={isRegions ? draft.regions : draft.provinces}
      />
    );
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: handleContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "coach-availability-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Dove e quando sei disponibile?"
      testID="coach-availability-step"
      title="Disponibilità"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <ToggleRow
          description="Il tuo profilo può comparire tra gli allenatori disponibili sul mercato."
          label="Disponibile per una nuova squadra"
          onValueChange={onIsAvailableChange}
          testID="coach-available-toggle"
          value={isAvailable}
        />
      </OnboardingSection>

      {isAvailable ? (
        <>
          <OnboardingSection
            description="Scegli l'area in cui sei disponibile."
            title="Disponibilità geografica"
          >
            <View style={styles.modeList}>
              <AvailabilityModeCard
                affordance="direct"
                description="Sono disponibile in tutta Italia, senza limitazioni territoriali."
                icon="globe-outline"
                onPress={() => handleSelectMode("ITALY")}
                selected={draft.mode === "ITALY"}
                testID="coach-availability-mode-italy"
                title="Ovunque in Italia"
              />

              <AvailabilityModeCard
                affordance="drilldown"
                description="Seleziona le regioni italiane di tuo interesse."
                icon="map-outline"
                onPress={() => handleSelectMode("REGIONS")}
                selected={draft.mode === "REGIONS"}
                summary={
                  draft.mode === "REGIONS"
                    ? buildAvailabilitySummary(draft.regions.length, "regione")
                    : undefined
                }
                testID="coach-availability-mode-regions"
                title="In una o più regioni"
              />

              <AvailabilityModeCard
                affordance="drilldown"
                description="Seleziona una o più province in cui sei disponibile."
                icon="location-outline"
                onPress={() => handleSelectMode("PROVINCES")}
                selected={draft.mode === "PROVINCES"}
                summary={
                  draft.mode === "PROVINCES"
                    ? buildAvailabilitySummary(
                        draft.provinces.length,
                        "provincia",
                      )
                    : undefined
                }
                testID="coach-availability-mode-provinces"
                title="Zone specifiche"
              />
            </View>

            {modeError ? <InlineError message={modeError} /> : null}
          </OnboardingSection>

          <OnboardingSection>
            {/* §I: un solo picker mese + anno, mai due campi separati. */}
            <DateSelector
              firstYear={AVAILABLE_FROM_FIRST_YEAR}
              label="Disponibile da"
              lastYear={AVAILABLE_FROM_LAST_YEAR}
              mode="monthYear"
              onChange={onAvailableFromChange}
              optional
              placeholder="Seleziona mese e anno"
              sheetTitle="Disponibile da"
              testID="coach-available-from"
              value={availableFrom}
            />
          </OnboardingSection>
        </>
      ) : null}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  modeList: {
    gap: onboardingSpacing.s + 4,
  },
});
