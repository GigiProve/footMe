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
import { InlineError, OnboardingPage } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import { FAN_TERRITORY_MODE_COPY } from "./fan-taxonomy";

type InternalScreen = "mode" | "regions" | "provinces";

type FanTerritoriesStepProps = {
  currentStep: number;
  draft: GeographicAvailabilityDraft;
  isBusy: boolean;
  onBack: () => void;
  onBranchOpened?: (branch: "regions" | "provinces") => void;
  onContinue: () => void;
  onDraftChange: (draft: GeographicAvailabilityDraft) => void;
  onModeSelected?: (mode: AvailabilityType) => void;
  /** Back di sistema mentre siamo in una schermata interna dello step. */
  onRegisterBack?: (handler: (() => void) | null) => void;
  onSelectionConfirmed?: (
    branch: "regions" | "provinces",
    count: number,
  ) => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Dove vuoi seguire il calcio?" (REV-ONB-08 §Q–§AA).
 *
 * È il selettore geografico già approvato per la Disponibilità geografica del
 * Calciatore (REV-ONB-02 §S–§X): stesse card, stesso chevron, stessa ricerca,
 * stesso riepilogo. Cambia solo il copy, perché il Tifoso non dichiara dove è
 * disposto a trasferirsi ma da dove vuole ricevere contenuti (§Q).
 *
 * Le tre schermate vivono dentro un solo passo del wizard: il contatore non si
 * muove entrando nel branch regioni o province (§AI).
 */
export function FanTerritoriesStep({
  currentStep,
  draft,
  isBusy,
  onBack,
  onBranchOpened,
  onContinue,
  onDraftChange,
  onModeSelected,
  onRegisterBack,
  onSelectionConfirmed,
  stepLabel,
  totalSteps,
}: FanTerritoriesStepProps) {
  const [screen, setScreen] = useState<InternalScreen>("mode");
  const [showErrors, setShowErrors] = useState(false);

  const modeError = showErrors ? getAvailabilityErrorMessage(draft) : undefined;

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
    /**
     * §AA: la modalità abbandonata resta nella bozza finché l'onboarding non
     * si chiude — chi torna su "In una o più regioni" ritrova le sue regioni.
     * Il valore attivo però è uno solo, e lo decide `mode`.
     */
    onDraftChange({ ...draft, mode });
    onModeSelected?.(mode);

    if (mode === "REGIONS") {
      onBranchOpened?.("regions");
      setScreen("regions");
      return;
    }

    if (mode === "PROVINCES") {
      onBranchOpened?.("provinces");
      setScreen("provinces");
    }
  }

  function handleContinueFromMode() {
    if (!isAvailabilityComplete(draft)) {
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
        onConfirm={() => {
          onSelectionConfirmed?.(
            isRegions ? "regions" : "provinces",
            isRegions ? draft.regions.length : draft.provinces.length,
          );
          setScreen("mode");
        }}
        options={isRegions ? REGION_OPTIONS : PROVINCE_OPTIONS}
        searchPlaceholder={isRegions ? "Cerca regione" : "Cerca provincia"}
        stepLabel={stepLabel}
        subtitle={
          isRegions
            ? "Puoi scegliere una o più regioni."
            : "Scegli una o più province che vuoi seguire."
        }
        testID={isRegions ? "fan-regions" : "fan-provinces"}
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
        onPrimaryPress: handleContinueFromMode,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "fan-territories-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Scegli da quali territori vuoi ricevere contenuti e aggiornamenti."
      testID="fan-territories-step"
      title="Dove vuoi seguire il calcio?"
      totalSteps={totalSteps}
    >
      <View accessibilityRole="radiogroup" style={styles.modeList}>
        <AvailabilityModeCard
          affordance="direct"
          description={FAN_TERRITORY_MODE_COPY.ITALY.description}
          icon={FAN_TERRITORY_MODE_COPY.ITALY.icon}
          onPress={() => handleSelectMode("ITALY")}
          selected={draft.mode === "ITALY"}
          testID="fan-territory-mode-italy"
          title={FAN_TERRITORY_MODE_COPY.ITALY.title}
        />

        <AvailabilityModeCard
          affordance="drilldown"
          description={FAN_TERRITORY_MODE_COPY.REGIONS.description}
          icon={FAN_TERRITORY_MODE_COPY.REGIONS.icon}
          onPress={() => handleSelectMode("REGIONS")}
          selected={draft.mode === "REGIONS"}
          summary={
            draft.mode === "REGIONS"
              ? buildAvailabilitySummary(draft.regions.length, "regione")
              : undefined
          }
          testID="fan-territory-mode-regions"
          title={FAN_TERRITORY_MODE_COPY.REGIONS.title}
        />

        <AvailabilityModeCard
          affordance="drilldown"
          description={FAN_TERRITORY_MODE_COPY.PROVINCES.description}
          icon={FAN_TERRITORY_MODE_COPY.PROVINCES.icon}
          onPress={() => handleSelectMode("PROVINCES")}
          selected={draft.mode === "PROVINCES"}
          summary={
            draft.mode === "PROVINCES"
              ? buildAvailabilitySummary(draft.provinces.length, "provincia")
              : undefined
          }
          testID="fan-territory-mode-provinces"
          title={FAN_TERRITORY_MODE_COPY.PROVINCES.title}
        />
      </View>

      <InlineError message={modeError} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  modeList: {
    gap: onboardingSpacing.s + 4,
    paddingBottom: onboardingSpacing.s,
  },
});
