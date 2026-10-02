/**
 * Opportunità (REV-PROF-05 schermata 4, REV-PROF-08 schermata 4):
 * disponibilità e zone.
 *
 * La disponibilità geografica riusa per intero il flusso già approvato per il
 * Calciatore e per l'onboarding — stesse tre modalità, stesso picker, stessa
 * tassonomia, stessa normalizzazione. Non ne esiste una seconda.
 *
 * Due comportamenti valgono la pena di essere detti:
 *
 *  - spegnendo il toggle i territori **restano nella bozza**: vengono nascosti,
 *    non cancellati, e riaccendendolo si ritrova la configurazione di prima.
 *    È al salvataggio che il prodotto decide cosa persistere;
 *  - cambiando modalità le selezioni della modalità abbandonata restano nella
 *    bozza ma non finiscono nel payload, così non nascono combinazioni
 *    incoerenti (regioni salvate mentre la modalità è "province").
 *
 * Quello che cambia fra Allenatore e Staff tecnico è la copy del toggle e le
 * colonne su cui la disponibilità viene scritta: entrambe arrivano dal config.
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
import type { ProfileFormState } from "../../profile-edit-helpers";
import { PROVINCE_OPTIONS, REGION_OPTIONS } from "../../profile-form-utils";
import type { CompleteProfessionalProfile } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../ProfileEditStates";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type InternalScreen = "main" | "regions" | "provinces";

export type OpportunitiesDraft = {
  /**
   * Destinatari selezionati (REV-PROF-11). Vuoto per i ruoli che non li
   * raccolgono: senza `audienceOptions` il campo non viene né mostrato né
   * validato.
   */
  audiences: string[];
  availability: GeographicAvailabilityDraft;
  /** "" = "Da subito". Altrimenti "YYYY-MM", il formato canonico del profilo. */
  availableFrom: string;
  isAvailable: boolean;
};

/** Una riga di "Disponibile per". L'elenco arriva dalla tassonomia del ruolo. */
export type ProfileOpportunitiesAudience = {
  description?: string;
  label: string;
  value: string;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

/** `ALL_ITALY` è un valore legacy: in lettura vale quanto `ITALY`. */
export function normalizeAvailabilityType(
  value: string | undefined | null,
): AvailabilityType {
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

export type ProfileOpportunitiesConfig<TPatch = Partial<ProfileFormState>> = {
  /**
   * Destinatari della disponibilità (REV-PROF-11). Assenti: la sezione non
   * esiste e nessuna validazione la pretende, che è il caso di Allenatore e
   * Staff tecnico.
   */
  audienceOptions?: readonly ProfileOpportunitiesAudience[];
  /** Titolo della sezione destinatari. */
  audienceTitle?: string;
  /** Descrizione sotto il toggle. */
  availabilityDescription: string;
  /** Etichetta del toggle: "nuova squadra" per l'Allenatore, "nuove collaborazioni" per lo Staff. */
  availabilityLabel: string;
  /** Legge la disponibilità corrente dal profilo canonico. */
  read: (data: CompleteProfessionalProfile) => OpportunitiesDraft;
  profileType: string;
  /** Azione del riepilogo territoriale. */
  recapActionLabel?: string;
  /** Titolo del riepilogo territoriale. */
  recapTitle?: string;
  /** Titolo della modalità a regioni: il Dirigente parla di "aree". */
  regionsModeTitle?: string;
  /** Alcuni ruoli non raccolgono "Disponibile da". */
  showAvailableFrom?: boolean;
  testIDPrefix: string;
  /** Traduce la bozza nei campi dello stato condiviso del proprio ruolo. */
  write: (
    draft: OpportunitiesDraft,
    active: { provinces: string[]; regions: string[] },
  ) => TPatch;
  /** Titolo della sezione geografica. */
  zonesTitle?: string;
};

type ProfileOpportunitiesScreenProps<TPatch> = {
  config: ProfileOpportunitiesConfig<TPatch>;
  data: CompleteProfessionalProfile | undefined;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onSave: (
    data: CompleteProfessionalProfile,
    patch: TPatch,
    handlers: { onError: (error: Error) => void; onSuccess: () => void },
  ) => void;
  saving: boolean;
};

export function ProfileOpportunitiesScreen<TPatch = Partial<ProfileFormState>>({
  config,
  data,
  isError,
  isPending,
  onRetry,
  onSave,
  saving,
}: ProfileOpportunitiesScreenProps<TPatch>) {
  const {
    audienceOptions,
    audienceTitle = "Disponibile per",
    availabilityDescription,
    availabilityLabel,
    profileType,
    read,
    recapActionLabel = "Modifica zone",
    recapTitle = "Zone selezionate",
    regionsModeTitle = "In una o più regioni",
    showAvailableFrom = true,
    testIDPrefix,
    write,
    zonesTitle = "Disponibilità geografica",
  } = config;

  const initialForm = useMemo<OpportunitiesDraft | null>(
    () => (data ? read(data) : null),
    [data, read],
  );

  const availableFromOptions = useMemo(
    () => buildAvailableFromOptions(new Date()),
    [],
  );

  const [draft, setDraft] = useState<OpportunitiesDraft | null>(null);
  const [screen, setScreen] = useState<InternalScreen>("main");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: saving,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType,
          section: "opportunities",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<OpportunitiesDraft>) => {
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
        profileType,
        section: "opportunities",
      });
      patch({ availability: { ...form.availability, mode } });

      if (mode === "REGIONS") {
        setScreen("regions");
      } else if (mode === "PROVINCES") {
        setScreen("provinces");
      }
    },
    [form, patch, profileType],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (form.isAvailable) {
      /*
        Una disponibilità accesa senza destinatari non dice niente a nessuno:
        il profilo risulterebbe disponibile e invisibile insieme.
      */
      if (audienceOptions && form.audiences.length === 0) {
        setErrorMessage("Seleziona almeno un destinatario.");
        return;
      }

      const availabilityError = getAvailabilityErrorMessage(form.availability);

      if (availabilityError) {
        setErrorMessage(availabilityError);
        return;
      }
    }

    // Nel payload finisce solo ciò che è compatibile con la modalità attiva.
    const active = resolveActiveAvailability(form.availability);

    setErrorMessage(null);
    onSave(data, write(form, active), {
      onError: (error) => {
        trackProfileEvent("profile_edit_section_save_failed", {
          profileType,
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
          profileType,
          section: "opportunities",
          success: true,
          territoryCount: active.regions.length + active.provinces.length,
        });
        setDraft(null);
        router.back();
      },
    });
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
            ? `${testIDPrefix}-opportunities-regions-picker`
            : `${testIDPrefix}-opportunities-provinces-picker`
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
      saving={saving}
      testID={`${testIDPrefix}-profile-edit-opportunities`}
      title="Opportunità"
    >
      {isPending ? (
        <ProfileEditFieldsSkeleton
          rows={4}
          testID={`${testIDPrefix}-edit-skeleton`}
        />
      ) : null}

      {isError ? (
        <ProfileEditErrorState
          onRetry={onRetry}
          testID={`${testIDPrefix}-edit-error`}
        />
      ) : null}

      {form ? (
        <>
          <ToggleRow
            description={availabilityDescription}
            label={availabilityLabel}
            onValueChange={(value) => patch({ isAvailable: value })}
            testID={`${testIDPrefix}-opportunities-toggle`}
            value={form.isAvailable}
          />

          {/*
            Con la disponibilità spenta i campi dipendenti spariscono: mostrarli
            disabilitati suggerirebbe che contino comunque qualcosa.
          */}
          {form.isAvailable ? (
            <>
              {showAvailableFrom ? (
                <OnboardingSelectField
                  label="Disponibile da"
                  onChange={(value) => patch({ availableFrom: value })}
                  options={availableFromOptions}
                  placeholder="Da subito"
                  searchable
                  sheetTitle="Disponibile da"
                  testID={`${testIDPrefix}-opportunities-available-from`}
                  value={form.availableFrom}
                />
              ) : null}

              {audienceOptions ? (
                <View style={styles.zones}>
                  <AppText variant="titleSm">{audienceTitle}</AppText>

                  {audienceOptions.map((option) => (
                    <ToggleRow
                      description={option.description}
                      key={option.value}
                      label={option.label}
                      onValueChange={(value) =>
                        patch({
                          audiences: value
                            ? [...form.audiences, option.value]
                            : form.audiences.filter(
                                (entry) => entry !== option.value,
                              ),
                        })
                      }
                      testID={`${testIDPrefix}-opportunities-audience-${option.value}`}
                      value={form.audiences.includes(option.value)}
                    />
                  ))}
                </View>
              ) : null}

              <View style={styles.zones}>
                <AppText variant="titleSm">{zonesTitle}</AppText>

                <AvailabilityModeCard
                  affordance="direct"
                  description="Sei disponibile ovunque, senza limitazioni territoriali."
                  icon="globe-outline"
                  onPress={() => selectMode("ITALY")}
                  selected={form.availability.mode === "ITALY"}
                  testID={`${testIDPrefix}-opportunities-mode-italy`}
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
                  testID={`${testIDPrefix}-opportunities-mode-regions`}
                  title={regionsModeTitle}
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
                  testID={`${testIDPrefix}-opportunities-mode-provinces`}
                  title="Zone specifiche"
                />
              </View>

              {/*
                Riepilogo compatto dei territori scelti. "Tutta Italia" non ha
                zone da elencare e non mostra l'azione di modifica.
              */}
              {form.availability.mode !== "ITALY" ? (
                <View
                  style={styles.recap}
                  testID={`${testIDPrefix}-opportunities-recap`}
                >
                  <View style={styles.recapText}>
                    <AppText color="secondary" variant="eyebrow">
                      {recapTitle}
                    </AppText>
                    <AppText variant="bodySm">
                      {zonesLabel ?? "Nessuna zona selezionata"}
                    </AppText>
                  </View>
                  <Button
                    label={recapActionLabel}
                    onPress={() =>
                      setScreen(
                        form.availability.mode === "REGIONS"
                          ? "regions"
                          : "provinces",
                      )
                    }
                    size="sm"
                    testID={`${testIDPrefix}-opportunities-edit-zones`}
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
