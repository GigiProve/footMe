import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { INTEREST_CATEGORY_OPTIONS } from "../../profiles/player-sports";
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
  OnboardingMultiSelectField,
  OnboardingPage,
  OnboardingSection,
  ToggleRow,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";

type InternalScreen = "mode" | "regions" | "provinces";

type StaffAvailabilityStepProps = {
  availableFrom: string;
  categories: string[];
  currentStep: number;
  draft: GeographicAvailabilityDraft;
  isAvailable: boolean;
  isBusy: boolean;
  onAvailableFromChange: (value: string) => void;
  onBack: () => void;
  onCategoriesChange: (categories: string[]) => void;
  onContinue: () => void;
  onDraftChange: (draft: GeographicAvailabilityDraft) => void;
  onIsAvailableChange: (value: boolean) => void;
  onProvincesConfirmed?: (count: number) => void;
  onRegionsConfirmed?: (count: number) => void;
  /** Back di sistema mentre siamo in una schermata interna dello step (§AV). */
  onRegisterBack?: (handler: (() => void) | null) => void;
  stepLabel: string;
  totalSteps: number;
};

/** §N: si guarda avanti, ma la stagione in corso resta raggiungibile. */
const AVAILABLE_FROM_FIRST_YEAR = new Date().getFullYear() - 1;
const AVAILABLE_FROM_LAST_YEAR = new Date().getFullYear() + 6;

/** §O: le stesse categorie degli altri profili professionali, non una lista Staff. */
const CATEGORY_OPTIONS = INTEREST_CATEGORY_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}));

/**
 * Passo "Disponibilità" dello Staff tecnico (REV-ONB-04 §H–§O).
 *
 * La logica geografica non è una variante Staff: sono le stesse tre modalità
 * esclusive approvate per il Calciatore (REV-ONB-02) e riusate dall'Allenatore
 * — "Ovunque in Italia" non apre nulla (§K), Regioni e Zone specifiche aprono
 * il selector dedicato con ricerca e multi-selezione (§L, §M).
 *
 * Con il toggle spento non si chiede né l'area né il periodo (§I): la
 * disponibilità resta registrata come non attiva e si modifica dal profilo.
 */
export function StaffAvailabilityStep({
  availableFrom,
  categories,
  currentStep,
  draft,
  isAvailable,
  isBusy,
  onAvailableFromChange,
  onBack,
  onCategoriesChange,
  onContinue,
  onDraftChange,
  onIsAvailableChange,
  onProvincesConfirmed,
  onRegionsConfirmed,
  onRegisterBack,
  stepLabel,
  totalSteps,
}: StaffAvailabilityStepProps) {
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

    // §K: "Ovunque in Italia" è già una risposta completa.
    if (mode === "REGIONS") {
      setScreen("regions");
      return;
    }

    if (mode === "PROVINCES") {
      setScreen("provinces");
    }
  }

  function handleContinue() {
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
        onConfirm={() => {
          if (isRegions) {
            onRegionsConfirmed?.(draft.regions.length);
          } else {
            onProvincesConfirmed?.(draft.provinces.length);
          }

          setScreen("mode");
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
          isRegions
            ? "staff-availability-regions"
            : "staff-availability-provinces"
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
        primaryTestID: "staff-availability-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Dove vuoi collaborare?"
      testID="staff-availability-step"
      title="Disponibilità"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <ToggleRow
          description="Il tuo profilo può comparire tra gli staff tecnici disponibili."
          label="Disponibile a nuove collaborazioni"
          onValueChange={onIsAvailableChange}
          testID="staff-available-toggle"
          value={isAvailable}
        />
      </OnboardingSection>

      {isAvailable ? (
        <>
          <OnboardingSection
            description="Scegli l'area in cui vuoi collaborare."
            title="Disponibilità geografica"
          >
            <View style={styles.modeList}>
              <AvailabilityModeCard
                affordance="direct"
                description="Sono disponibile in tutta Italia, senza limitazioni territoriali."
                icon="globe-outline"
                onPress={() => handleSelectMode("ITALY")}
                selected={draft.mode === "ITALY"}
                testID="staff-availability-mode-italy"
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
                testID="staff-availability-mode-regions"
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
                testID="staff-availability-mode-provinces"
                title="Zone specifiche"
              />
            </View>

            {modeError ? <InlineError message={modeError} /> : null}
          </OnboardingSection>

          <OnboardingSection>
            {/* §N: un solo picker mese + anno, mai un campo di testo libero. */}
            <DateSelector
              firstYear={AVAILABLE_FROM_FIRST_YEAR}
              helperText="Lascia vuoto se sei disponibile da subito."
              label="Disponibile da"
              lastYear={AVAILABLE_FROM_LAST_YEAR}
              mode="monthYear"
              onChange={onAvailableFromChange}
              optional
              placeholder="Seleziona mese e anno"
              sheetTitle="Disponibile da"
              testID="staff-available-from"
              value={availableFrom}
            />
          </OnboardingSection>

          {/* §O: categorie come dato di interesse, dietro un selector e mai
              come nuvola di chip sempre a schermo. */}
          <OnboardingSection title="Categorie di interesse">
            <OnboardingMultiSelectField
              onChange={onCategoriesChange}
              optional
              options={CATEGORY_OPTIONS}
              placeholder="Seleziona le categorie"
              searchable
              sheetTitle="Categoria di interesse"
              testID="staff-availability-categories"
              values={categories}
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
