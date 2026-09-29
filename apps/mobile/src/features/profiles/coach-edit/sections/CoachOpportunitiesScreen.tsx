/**
 * Opportunità (REV-PROF-05, schermata 4): disponibilità e zone.
 *
 * La disponibilità geografica riusa per intero il flusso già approvato per il
 * Calciatore e per l'onboarding Allenatore — stesse tre modalità, stesso
 * picker, stessa tassonomia, stessa normalizzazione. Non ne esiste una seconda.
 *
 * Due comportamenti valgono la pena di essere detti:
 *
 *  - spegnendo il toggle i territori **restano nella bozza**: vengono nascosti,
 *    non cancellati, e riaccendendolo si ritrova la configurazione di prima.
 *    È al salvataggio che il prodotto decide cosa persistere;
 *  - cambiando modalità le selezioni della modalità abbandonata restano nella
 *    bozza ma non finiscono nel payload, così non nascono combinazioni
 *    incoerenti (regioni salvate mentre la modalità è "province").
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { OnboardingSelectField, ToggleRow } from "../../../onboarding/ui";
import { MONTH_NAMES } from "../../../onboarding/ui/date-selector-utils";
import { AvailabilityModeCard } from "../../../onboarding/player/AvailabilityModeCard";
import { GeographicPickerScreen } from "../../../onboarding/player/GeographicPickerScreen";
import {
  buildAvailabilitySummary,
  getAvailabilityErrorMessage,
  resolveActiveAvailability,
  type GeographicAvailabilityDraft,
} from "../../../onboarding/player/geographic-availability";
import type { AvailabilityType } from "../../../onboarding/onboarding-form";
import { trackProfileEvent } from "../../profile-analytics";
import { buildAvailabilityZonesLabel } from "../../profile-display-helpers";
import { toDelimitedString } from "../../profile-edit-helpers";
import { PROVINCE_OPTIONS, REGION_OPTIONS } from "../../profile-form-utils";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  CoachEditErrorState,
  CoachEditFieldsSkeleton,
} from "../CoachEditStates";
import {
  useCoachSectionSave,
  useCompleteProfileQuery,
} from "../coach-profile-edit-service";
import { useCoachEditorGuard } from "../use-coach-editor-guard";

type InternalScreen = "main" | "regions" | "provinces";

type OpportunitiesForm = {
  availability: GeographicAvailabilityDraft;
  /** "" = "Da subito". Altrimenti "YYYY-MM", il formato canonico del profilo. */
  availableFrom: string;
  openToNewRole: boolean;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

/** `ALL_ITALY` è un valore legacy: in lettura vale quanto `ITALY`. */
function normalizeAvailabilityType(value: string | undefined): AvailabilityType {
  if (value === "REGIONS" || value === "PROVINCES") {
    return value;
  }

  return "ITALY";
}

/**
 * Opzioni canoniche di "Disponibile da": "Da subito" più i ventiquattro mesi a
 * venire. Non è un campo libero, e il valore salvato resta "YYYY-MM" — lo
 * stesso che scrive l'onboarding e che il Master Profile sa già rendere.
 *
 * Il mese corrente viene incluso perché una disponibilità che parte "da questo
 * mese" è diversa da "da subito".
 */
function buildAvailableFromOptions(now: Date) {
  const options = [{ label: "Da subito", value: "" }];

  for (let offset = 0; offset < 24; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const month = date.getMonth() + 1;

    options.push({
      label: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`,
      value: `${date.getFullYear()}-${String(month).padStart(2, "0")}`,
    });
  }

  return options;
}

export function CoachOpportunitiesScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<OpportunitiesForm | null>(() => {
    if (!data) {
      return null;
    }

    const coach = data.coachProfile;

    return {
      availability: {
        mode: normalizeAvailabilityType(coach?.availability_type ?? undefined),
        provinces: coach?.preferred_provinces ?? [],
        regions: coach?.preferred_regions ?? [],
      },
      availableFrom: coach?.available_from ?? "",
      openToNewRole: coach?.open_to_new_role ?? false,
    };
  }, [data]);

  const availableFromOptions = useMemo(
    () => buildAvailableFromOptions(new Date()),
    [],
  );

  const [draft, setDraft] = useState<OpportunitiesForm | null>(null);
  const [screen, setScreen] = useState<InternalScreen>("main");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "coach",
          section: "opportunities",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<OpportunitiesForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  const selectMode = useCallback(
    (mode: AvailabilityType) => {
      if (!form) {
        return;
      }

      trackProfileEvent("profile_area_mode_changed", {
        geographicMode: mode,
        profileType: "coach",
        section: "opportunities",
      });
      patch({ availability: { ...form.availability, mode } });

      if (mode === "REGIONS") {
        setScreen("regions");
      } else if (mode === "PROVINCES") {
        setScreen("provinces");
      }
    },
    [form, patch],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (form.openToNewRole) {
      const availabilityError = getAvailabilityErrorMessage(form.availability);

      if (availabilityError) {
        setErrorMessage(availabilityError);
        return;
      }
    }

    // Nel payload finisce solo ciò che è compatibile con la modalità attiva.
    const active = resolveActiveAvailability(form.availability);

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          coachAvailabilityType: form.availability.mode,
          coachAvailableFrom: form.availableFrom,
          coachPreferredProvinces: toDelimitedString(active.provinces),
          openToNewRole: form.openToNewRole,
          preferredRegions: toDelimitedString(active.regions),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "coach",
            section: "opportunities",
            success: false,
          });
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : GENERIC_SAVE_ERROR,
          );
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "coach",
            section: "opportunities",
            success: true,
            territoryCount: active.regions.length + active.provinces.length,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  if (form && screen !== "main") {
    const isRegions = screen === "regions";

    return (
      <GeographicPickerScreen
        emptyStateMessage={
          isRegions ? "Nessuna regione trovata." : "Nessuna provincia trovata."
        }
        onBack={() => setScreen("main")}
        onChange={(values) =>
          patch({
            availability: isRegions
              ? { ...form.availability, regions: values }
              : { ...form.availability, provinces: values },
          })
        }
        onConfirm={() => setScreen("main")}
        options={isRegions ? [...REGION_OPTIONS] : [...PROVINCE_OPTIONS]}
        searchPlaceholder={
          isRegions ? "Cerca una regione" : "Cerca una provincia"
        }
        subtitle={
          isRegions
            ? "Puoi selezionare più regioni."
            : "Puoi selezionare più province."
        }
        testID={
          isRegions
            ? "coach-opportunities-regions-picker"
            : "coach-opportunities-provinces-picker"
        }
        title={isRegions ? "In quali regioni?" : "In quali province?"}
        unit={isRegions ? "regione" : "provincia"}
        values={
          isRegions ? form.availability.regions : form.availability.provinces
        }
      />
    );
  }

  const zonesLabel = form
    ? buildAvailabilityZonesLabel(
        form.availability.mode,
        resolveActiveAvailability(form.availability).regions,
        resolveActiveAvailability(form.availability).provinces,
      )
    : null;

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saving={save.isPending}
      testID="coach-profile-edit-opportunities"
      title="Opportunità"
    >
      {profileQuery.isPending ? <CoachEditFieldsSkeleton rows={4} /> : null}

      {profileQuery.isError ? (
        <CoachEditErrorState onRetry={() => void profileQuery.refetch()} />
      ) : null}

      {form ? (
        <>
          <ToggleRow
            description="Il tuo profilo può comparire tra gli allenatori disponibili sul mercato."
            label="Disponibile per una nuova squadra"
            onValueChange={(value) => patch({ openToNewRole: value })}
            testID="coach-opportunities-toggle"
            value={form.openToNewRole}
          />

          {/*
            Con la disponibilità spenta i campi dipendenti spariscono: mostrarli
            disabilitati suggerirebbe che contino comunque qualcosa.
          */}
          {form.openToNewRole ? (
            <>
              <OnboardingSelectField
                label="Disponibile da"
                onChange={(value) => patch({ availableFrom: value })}
                options={availableFromOptions}
                placeholder="Da subito"
                searchable
                sheetTitle="Disponibile da"
                testID="coach-opportunities-available-from"
                value={form.availableFrom}
              />

              <View style={styles.zones}>
                <AppText variant="titleSm">Disponibilità geografica</AppText>

                <AvailabilityModeCard
                  affordance="direct"
                  description="Sei disponibile ovunque, senza limitazioni territoriali."
                  icon="globe-outline"
                  onPress={() => selectMode("ITALY")}
                  selected={form.availability.mode === "ITALY"}
                  testID="coach-opportunities-mode-italy"
                  title="Tutta Italia"
                />
                <AvailabilityModeCard
                  affordance="drilldown"
                  description="Scegli le regioni che ti interessano."
                  icon="map-outline"
                  onPress={() => selectMode("REGIONS")}
                  selected={form.availability.mode === "REGIONS"}
                  summary={buildAvailabilitySummary(
                    form.availability.regions.length,
                    "regione",
                  )}
                  testID="coach-opportunities-mode-regions"
                  title="In una o più regioni"
                />
                <AvailabilityModeCard
                  affordance="drilldown"
                  description="Scegli le province che ti interessano."
                  icon="location-outline"
                  onPress={() => selectMode("PROVINCES")}
                  selected={form.availability.mode === "PROVINCES"}
                  summary={buildAvailabilitySummary(
                    form.availability.provinces.length,
                    "provincia",
                  )}
                  testID="coach-opportunities-mode-provinces"
                  title="Zone specifiche"
                />
              </View>

              {/*
                Riepilogo compatto dei territori scelti. "Tutta Italia" non ha
                zone da elencare e non mostra l'azione di modifica.
              */}
              {form.availability.mode !== "ITALY" ? (
                <View style={styles.recap} testID="coach-opportunities-recap">
                  <View style={styles.recapText}>
                    <AppText color="secondary" variant="eyebrow">
                      Zone selezionate
                    </AppText>
                    <AppText variant="bodySm">
                      {zonesLabel ?? "Nessuna zona selezionata"}
                    </AppText>
                  </View>
                  <Button
                    label="Modifica zone"
                    onPress={() =>
                      setScreen(
                        form.availability.mode === "REGIONS"
                          ? "regions"
                          : "provinces",
                      )
                    }
                    size="sm"
                    testID="coach-opportunities-edit-zones"
                    variant="ghost"
                  />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.notice}>
              <Ionicons
                color={colors.textMuted}
                name="information-circle-outline"
                size={16}
              />
              <AppText color="muted" style={styles.noticeText} variant="meta">
                Le zone salvate restano memorizzate: riattivando la
                disponibilità le ritrovi come le avevi lasciate.
              </AppText>
            </View>
          )}
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
  },
  noticeText: {
    flex: 1,
  },
  recap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  recapText: {
    flex: 1,
    gap: spacing[4],
  },
  zones: {
    gap: spacing[8],
  },
});
