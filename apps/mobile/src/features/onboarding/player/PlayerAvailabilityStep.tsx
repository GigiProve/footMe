import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText, Button } from "../../../ui";
import {
  PROVINCE_OPTIONS,
  REGION_OPTIONS,
} from "../../profiles/profile-form-utils";
import { INTEREST_CATEGORY_OPTIONS } from "../../profiles/player-sports";
import type { AvailabilityType } from "../onboarding-form";
import {
  InlineError,
  OnboardingMultiSelectField,
  OnboardingPage,
  OnboardingSection,
  ToggleRow,
} from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import { AvailabilityModeCard } from "./AvailabilityModeCard";
import { GeographicPickerScreen } from "./GeographicPickerScreen";
import {
  buildAvailabilityRecap,
  buildAvailabilitySummary,
  getAvailabilityErrorMessage,
  isAvailabilityComplete,
  type GeographicAvailabilityDraft,
} from "./geographic-availability";

type InternalScreen = "mode" | "regions" | "provinces" | "recap";

type PlayerAvailabilityStepProps = {
  categories: string[];
  currentStep: number;
  draft: GeographicAvailabilityDraft;
  isAvailable: boolean;
  isBusy: boolean;
  onBack: () => void;
  onCategoriesChange: (categories: string[]) => void;
  onContinue: () => void;
  onDraftChange: (draft: GeographicAvailabilityDraft) => void;
  onIsAvailableChange: (value: boolean) => void;
  /** Back di sistema mentre siamo in una schermata interna dello step (§DB). */
  onRegisterBack?: (handler: (() => void) | null) => void;
  stepLabel: string;
  totalSteps: number;
};

const CATEGORY_OPTIONS = INTEREST_CATEGORY_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}));

/**
 * Step "La tua disponibilità" del Calciatore (REV-ONB-02 §S–§Z).
 *
 * Tre schermate che vivono dentro un solo passo del wizard: scelta della
 * modalità, eventuale selezione di dettaglio, riepilogo. Il contatore non
 * cambia perché non stiamo cambiando passo (§E).
 */
export function PlayerAvailabilityStep({
  categories,
  currentStep,
  draft,
  isAvailable,
  isBusy,
  onBack,
  onCategoriesChange,
  onContinue,
  onDraftChange,
  onIsAvailableChange,
  onRegisterBack,
  stepLabel,
  totalSteps,
}: PlayerAvailabilityStepProps) {
  const [screen, setScreen] = useState<InternalScreen>("mode");
  const [showErrors, setShowErrors] = useState(false);

  const modeError = showErrors ? getAvailabilityErrorMessage(draft) : undefined;
  /**
   * Le categorie sono obbligatorie quanto la zona: senza questo errore il
   * "Continua" resterebbe muto, perché la validazione della rotta blocca il
   * passo ma non ha dove mostrarsi (§CC).
   */
  const categoriesError =
    showErrors && categories.length === 0
      ? "Seleziona almeno una categoria."
      : undefined;

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

  function handleContinueFromMode() {
    if (!isAvailable) {
      onContinue();
      return;
    }

    if (!isAvailabilityComplete(draft) || categories.length === 0) {
      setShowErrors(true);
      return;
    }

    setScreen("recap");
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
        testID={isRegions ? "availability-regions" : "availability-provinces"}
        title={isRegions ? "Seleziona le regioni" : "Seleziona le province"}
        totalSteps={totalSteps}
        unit={isRegions ? "regione" : "provincia"}
        values={isRegions ? draft.regions : draft.provinces}
      />
    );
  }

  if (screen === "recap") {
    const recap = buildAvailabilityRecap(draft);

    return (
      <OnboardingPage
        currentStep={currentStep}
        footer={{
          onPrimaryPress: onContinue,
          primaryLabel: "Continua",
          primaryLoading: isBusy,
          primaryTestID: "availability-recap-continue",
        }}
        onBack={() => setScreen("mode")}
        stepLabel={stepLabel}
        testID="availability-recap"
        title="Riepilogo disponibilità"
        totalSteps={totalSteps}
      >
        <View style={styles.recap}>
          <View style={styles.recapIcon}>
            <Ionicons color={colors.accent} name="location" size={26} />
          </View>

          <AppText align="center" variant="titleMd">
            {recap.title}
          </AppText>

          {recap.detail ? (
            <AppText align="center" color="accent" variant="titleMd">
              {recap.detail}
            </AppText>
          ) : null}

          <Button
            label="Modifica"
            leftIcon={
              <Ionicons color={colors.accent} name="create-outline" size={16} />
            }
            onPress={() => setScreen("mode")}
            size="sm"
            variant="link"
          />
        </View>

        <AppText align="center" color="muted" variant="meta">
          Potrai modificarla in qualsiasi momento dal tuo profilo.
        </AppText>
      </OnboardingPage>
    );
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: handleContinueFromMode,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "availability-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Dove vuoi trovare opportunità? Seleziona l'area geografica in cui sei disponibile."
      testID="player-availability-step"
      title="La tua disponibilità"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <ToggleRow
          description="Il tuo profilo può comparire tra i calciatori disponibili sul mercato."
          label="Disponibile a cambiare squadra"
          onValueChange={onIsAvailableChange}
          value={isAvailable}
        />
      </OnboardingSection>

      {isAvailable ? (
        <>
          <OnboardingSection title="Disponibilità geografica">
            <View style={styles.modeList}>
              <AvailabilityModeCard
                affordance="direct"
                description="Sono disponibile in tutta Italia, senza limitazioni territoriali."
                icon="globe-outline"
                onPress={() => handleSelectMode("ITALY")}
                selected={draft.mode === "ITALY"}
                testID="availability-mode-italy"
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
                testID="availability-mode-regions"
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
                testID="availability-mode-provinces"
                title="Zone specifiche"
              />
            </View>

            {modeError ? <InlineError message={modeError} /> : null}
          </OnboardingSection>

          <OnboardingSection title="Categorie di interesse">
            <OnboardingMultiSelectField
              errorMessage={categoriesError}
              onChange={(next) => {
                setShowErrors(false);
                onCategoriesChange(next);
              }}
              options={CATEGORY_OPTIONS}
              placeholder="Seleziona le categorie"
              searchable
              sheetTitle="Categoria di interesse"
              testID="availability-categories"
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
  recap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.card,
    borderWidth: onboardingBorderWidth.hairline,
    gap: onboardingSpacing.s,
    marginBottom: onboardingSpacing.m,
    paddingHorizontal: onboardingSpacing.m,
    paddingVertical: onboardingSpacing.l,
  },
  recapIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: onboardingRadius.pill,
    height: 64,
    justifyContent: "center",
    marginBottom: onboardingSpacing.xs,
    width: 64,
  },
});
