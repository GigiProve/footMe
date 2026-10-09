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
 *
 * Il Procuratore (REV-PROF-16) non ha un interruttore generale: ha due
 * preferenze autonome — richieste di rappresentanza e collaborazioni con club
 * — che non si governano a vicenda, e un'area operativa che resta visibile
 * anche quando sono entrambe spente. Per questo `preferences` sostituisce il
 * toggle unico invece di affiancarglisi: due gate sovrapposti avrebbero
 * significato spegnere un profilo da due posti diversi.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { OnboardingSelectField, ToggleRow } from "../../../onboarding/ui";
import { MONTH_NAMES } from "../../../onboarding/ui/date-selector-utils";
import {
  resolveActiveAvailability,
  type GeographicAvailabilityDraft,
} from "../../../onboarding/player/geographic-availability";
import type { AvailabilityType } from "../../../onboarding/onboarding-form";
import { AvailabilityAreasSelector } from "../../availability-areas/AvailabilityAreasSelector";
import {
  validateAvailabilityAreas,
  type AvailabilityAreasMode,
  type AvailabilityAreasValidationError,
} from "../../availability-areas/availability-areas-model";
import { trackProfileEvent } from "../../profile-analytics";
import type { ProfileFormState } from "../../profile-edit-helpers";
import type { CompleteProfessionalProfile } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../ProfileEditStates";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

export type OpportunitiesDraft = {
  /**
   * REV-PROF-16: preferenze autonome selezionate. Vuoto per i ruoli che non
   * ne hanno: senza `preferences` nel config il campo non viene mostrato.
   */
  preferences: string[];
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

/**
 * Una preferenza autonoma (REV-PROF-16): un interruttore che vale per sé e
 * non abilita né disabilita gli altri.
 */
export type ProfileOpportunityPreference = {
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
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
  /**
   * REV-PROF-16: preferenze autonome al posto del toggle unico. Quando sono
   * presenti la disponibilità non fa più da gate e l'area operativa resta
   * sempre visibile.
   */
  preferences?: readonly ProfileOpportunityPreference[];
  /** Legge la disponibilità corrente dal profilo canonico. */
  read: (data: CompleteProfessionalProfile) => OpportunitiesDraft;
  profileType: string;
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
    preferences,
    profileType,
    read,
    showAvailableFrom = true,
    testIDPrefix,
    write,
    zonesTitle = "Disponibilità geografica",
  } = config;

  const usesPreferences = Boolean(preferences);

  const initialForm = useMemo<OpportunitiesDraft | null>(
    () => (data ? read(data) : null),
    [data, read],
  );

  const availableFromOptions = useMemo(
    () => buildAvailableFromOptions(new Date()),
    [],
  );

  const [draft, setDraft] = useState<OpportunitiesDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Errore geografico mostrato accanto al controllo, non solo in fondo (§17). */
  const [areasError, setAreasError] =
    useState<AvailabilityAreasValidationError | null>(null);
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
      setAreasError(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  const handleAreasChange = useCallback(
    (next: {
      mode: AvailabilityAreasMode | null;
      provinces: string[];
      regions: string[];
    }) => {
      if (!form) {
        return;
      }

      /*
        Il selector condiviso ammette "nessuna modalità" perché l'editor
        focalizzato di DAS-REV-06 deve poterla rappresentare. Qui la modalità
        esiste sempre — `normalizeAvailabilityType` la coerce — e il selector
        non la riporta mai a null: il fallback è una guardia di tipo, non un
        comportamento.
      */
      patch({
        availability: {
          mode: next.mode ?? form.availability.mode,
          provinces: next.provinces,
          regions: next.regions,
        },
      });
    },
    [form, patch],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (usesPreferences) {
      /*
        Senza gate l'area operativa è sempre un dato del profilo: va validata
        anche a preferenze spente, perché resta pubblicata.
      */
      const availabilityError = validateAvailabilityAreas(form.availability);

      if (availabilityError) {
        setAreasError(availabilityError);
        setErrorMessage(availabilityError.message);
        return;
      }
    } else if (form.isAvailable) {
      /*
        Una disponibilità accesa senza destinatari non dice niente a nessuno:
        il profilo risulterebbe disponibile e invisibile insieme.
      */
      if (audienceOptions && form.audiences.length === 0) {
        setErrorMessage("Seleziona almeno un destinatario.");
        return;
      }

      const availabilityError = validateAvailabilityAreas(form.availability);

      if (availabilityError) {
        setAreasError(availabilityError);
        setErrorMessage(availabilityError.message);
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

  /*
    Senza gate l'area operativa è sempre parte del profilo: con le preferenze
    autonome resta a schermo anche quando sono tutte spente, perché non è la
    disponibilità a renderla valida.
  */
  const showsDependentFields = usesPreferences || Boolean(form?.isAvailable);

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
          {/*
            Due forme alternative, mai insieme: o un interruttore generale che
            fa da gate, o preferenze che valgono ciascuna per sé.
          */}
          {usesPreferences ? (
            <View style={styles.zones}>
              {preferences?.map((preference) => (
                <ToggleRow
                  description={preference.description}
                  key={preference.value}
                  label={preference.label}
                  onValueChange={(value) =>
                    patch({
                      preferences: value
                        ? [...form.preferences, preference.value]
                        : form.preferences.filter(
                            (entry) => entry !== preference.value,
                          ),
                    })
                  }
                  testID={`${testIDPrefix}-opportunities-preference-${preference.value}`}
                  value={form.preferences.includes(preference.value)}
                />
              ))}
            </View>
          ) : (
            <ToggleRow
              description={availabilityDescription}
              label={availabilityLabel}
              onValueChange={(value) => patch({ isAvailable: value })}
              testID={`${testIDPrefix}-opportunities-toggle`}
              value={form.isAvailable}
            />
          )}

          {/*
            Con la disponibilità spenta i campi dipendenti spariscono: mostrarli
            disabilitati suggerirebbe che contino comunque qualcosa.
          */}
          {showsDependentFields ? (
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

                {/*
                  DAS-REV-06 §12: lo stesso selector dell'editor focalizzato e
                  dell'onboarding, non una seconda variante. Qui il punto di
                  conferma resta del modulo — §19: «il selector aggiorna quel
                  draft e il salvataggio finale resta al modulo» — quindi non
                  compare un secondo "Salva modifiche".

                  Sparisce con lui il riepilogo "Zone selezionate" con
                  "Modifica zone": serviva a rendere leggibili scelte fatte in
                  una schermata diversa, e ora le scelte sono qui, a schermo.
                */}
                <AvailabilityAreasSelector
                  draft={form.availability}
                  error={areasError}
                  onChange={handleAreasChange}
                  onModeChange={(mode) =>
                    trackProfileEvent("profile_area_mode_changed", {
                      geographicMode: mode,
                      profileType,
                      section: "opportunities",
                    })
                  }
                  testIDPrefix={`${testIDPrefix}-opportunities-areas`}
                />
              </View>
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
  zones: {
    gap: spacing[8],
  },
});
