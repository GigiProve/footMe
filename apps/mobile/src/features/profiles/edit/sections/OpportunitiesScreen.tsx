/**
 * Opportunità (§J): disponibilità al trasferimento, zone, categorie, provini.
 *
 * Le zone riusano per intero il flusso approvato nell'onboarding Calciatore —
 * stesse card di modalità, stesso picker, stessa tassonomia, stessa
 * normalizzazione. L'unica differenza rispetto all'onboarding è che qui la
 * bozza conserva anche le selezioni della modalità abbandonata: il payload le
 * scarta comunque, ma chi cambia idea due volte non deve riselezionare tutto.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { OnboardingChipMultiSelect, ToggleRow } from "../../../onboarding/ui";
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
import { INTEREST_CATEGORY_OPTIONS } from "../../player-sports";
import { toDelimitedString } from "../../profile-edit-helpers";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import { ProfileEditFieldsSkeleton } from "../ProfileEditStates";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type OpportunitiesForm = {
  availability: GeographicAvailabilityDraft;
  categories: string[];
  openToTrials: boolean;
  willingToChangeClub: boolean;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

/** `ALL_ITALY` è un valore legacy: in lettura vale quanto `ITALY`. */
function normalizeAvailabilityType(
  value: string | undefined,
): AvailabilityType {
  if (value === "REGIONS" || value === "PROVINCES") {
    return value;
  }

  return "ITALY";
}

export function OpportunitiesScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<OpportunitiesForm | null>(() => {
    if (!data) {
      return null;
    }

    const player = data.playerProfile;

    return {
      availability: {
        mode: normalizeAvailabilityType(player?.availability_type),
        provinces: player?.transfer_provinces ?? [],
        regions: player?.transfer_regions ?? [],
      },
      categories: player?.preferred_categories ?? [],
      openToTrials: player?.open_to_trials ?? false,
      willingToChangeClub: player?.willing_to_change_club ?? false,
    };
  }, [data]);

  const [draft, setDraft] = useState<OpportunitiesForm | null>(null);
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
    isSaving: save.isPending,
    onLeave: () => router.back(),
  });

  const patch = useCallback(
    (changes: Partial<OpportunitiesForm>) => {
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
        esiste sempre e il selector non la riporta mai a null: il fallback è
        una guardia di tipo, non un comportamento.
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

    const availabilityError = form.willingToChangeClub
      ? validateAvailabilityAreas(form.availability)
      : null;

    if (availabilityError) {
      setAreasError(availabilityError);
      setErrorMessage(availabilityError.message);
      return;
    }

    /*
      §J.3: nel payload finisce solo ciò che è compatibile con la modalità
      attiva. Le altre selezioni restano nella bozza, non sul database.
    */
    const active = resolveActiveAvailability(form.availability);

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          availabilityType: form.availability.mode,
          isOpenToTransfer: form.willingToChangeClub,
          openToTrials: form.openToTrials,
          preferredCategories: toDelimitedString(form.categories),
          transferProvinces: toDelimitedString(active.provinces),
          transferRegions: toDelimitedString(active.regions),
          willingToChangeClub: form.willingToChangeClub,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
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
            profileType: "player",
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

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saving={save.isPending}
      testID="profile-edit-opportunities"
      title="Opportunità"
    >
      {profileQuery.isPending ? <ProfileEditFieldsSkeleton /> : null}

      {profileQuery.isError ? (
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare questa sezione.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => profileQuery.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : null}

      {form ? (
        <>
          <ToggleRow
            description="Le società potranno contattarti per opportunità di trasferimento."
            label="Disponibile al trasferimento"
            onValueChange={(value) => patch({ willingToChangeClub: value })}
            testID="opportunities-transfer-toggle"
            value={form.willingToChangeClub}
          />

          {/*
            Spegnendo la disponibilità i territori restano salvati: riaccendendo,
            l'utente ritrova la configurazione di prima (§J.2). Qui vengono solo
            nascosti, mai cancellati.
          */}
          {form.willingToChangeClub ? (
            <View style={styles.field}>
              <AppText variant="titleSm">Zone disponibili</AppText>

              {/*
                DAS-REV-06 §12: lo stesso selector dell'editor focalizzato
                aperto dalla Dashboard. Il punto di conferma resta di questa
                schermata (§19), che salva anche categorie, provini e il
                toggle di trasferimento.
              */}
              <AvailabilityAreasSelector
                draft={form.availability}
                error={areasError}
                onChange={handleAreasChange}
                onModeChange={(mode) =>
                  trackProfileEvent("profile_area_mode_changed", {
                    geographicMode: mode,
                    profileType: "player",
                    section: "opportunities",
                  })
                }
                testIDPrefix="opportunities-areas"
              />
            </View>
          ) : null}

          {/*
            Chip in linea, non un bottom sheet: le categorie sono poche e lo
            Screen Master le mostra tutte, con le scelte rimovibili sul posto.
          */}
          <OnboardingChipMultiSelect
            label="Categorie d'interesse"
            onChange={(values) => patch({ categories: values })}
            options={INTEREST_CATEGORY_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            testID="opportunities-categories"
            values={form.categories}
          />

          <ToggleRow
            label="Disponibile per provini"
            onValueChange={(value) => patch({ openToTrials: value })}
            testID="opportunities-trials-toggle"
            value={form.openToTrials}
          />

          <View style={styles.notice}>
            <Ionicons
              color={colors.textMuted}
              name="lock-closed-outline"
              size={14}
            />
            <AppText color="muted" style={styles.noticeText} variant="meta">
              Queste informazioni saranno visibili nel tuo profilo.
            </AppText>
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  field: {
    gap: spacing[8],
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
  },
  noticeText: {
    flex: 1,
  },
});
