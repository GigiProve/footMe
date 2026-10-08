/**
 * Aree di interesse (REV-PROF-20, schermata 6).
 *
 * Sono preferenze di personalizzazione, non informazioni di profilo: da dove
 * il Tifoso vuole ricevere contenuti e suggerimenti. Per questo la schermata
 * non ha un toggle "Mostra nel profilo" e non può averne uno — le aree non
 * compaiono in REV-PROF-19, non entrano nel payload pubblico e non vengono
 * proiettate da `fetch_public_fan_profile`. "Visibile solo a te" è scritto,
 * non affidato a un lucchetto.
 *
 * Le aree non sono la residenza: quella vive su `profiles`, in "Foto e dati
 * personali", ed è un dato diverso anche quando per caso coincidono.
 *
 * Modalità e selettore sono quelli approvati in onboarding (REV-ONB-08 §Q,
 * che a sua volta riusa REV-ONB-02): stesse card, stessa ricerca, stesso
 * riepilogo. Qui cambia solo che la conferma del selettore aggiorna la bozza —
 * il backend lo tocca "Salva modifiche", non il selettore.
 */
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { FAN_TERRITORY_MODE_COPY } from "../../../onboarding/community/fan-taxonomy";
import type { AvailabilityType } from "../../../onboarding/onboarding-form";
import { AvailabilityModeCard } from "../../../onboarding/player/AvailabilityModeCard";
import { GeographicPickerScreen } from "../../../onboarding/player/GeographicPickerScreen";
import {
  buildAvailabilitySummary,
  isAvailabilityComplete,
  resolveActiveAvailability,
  type GeographicAvailabilityDraft,
} from "../../../onboarding/player/geographic-availability";
import { InfoMessage } from "../../../onboarding/ui";
import {
  PROVINCE_OPTIONS,
  REGION_OPTIONS,
} from "../../profile-form-utils";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { trackProfileEvent } from "../../profile-analytics";
import { FAN_AREAS_PRIVACY_SUFFIX } from "../fan-hub-summaries";
import {
  describeFanSaveError,
  FAN_LOAD_ERROR_MESSAGE,
  FanProfileConflictError,
  useCompleteProfileQuery,
  useFanSectionSave,
} from "../fan-profile-edit-service";
import { sameIdSet } from "../fan-selection";
import { useFanEditorGuard } from "../use-fan-editor-guard";

const PRIVACY_NOTE =
  "Queste preferenze personalizzano la tua esperienza e non compariranno nel profilo.";

type PickerScreen = "regions" | "provinces" | null;

function toDraft(
  geoScope: string | undefined,
  regions: readonly string[] | undefined,
  provinces: readonly string[] | undefined,
): GeographicAvailabilityDraft {
  const mode: AvailabilityType =
    geoScope === "REGIONS" || geoScope === "PROVINCES" ? geoScope : "ITALY";

  return {
    mode,
    provinces: [...(provinces ?? [])],
    regions: [...(regions ?? [])],
  };
}

export function FanInterestAreasScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useFanSectionSave(userId);
  const data = profileQuery.data;

  const saved = toDraft(
    data?.fanProfile?.geo_scope,
    data?.fanProfile?.interest_regions,
    data?.fanProfile?.interest_provinces,
  );

  const [draft, setDraft] = useState<GeographicAvailabilityDraft | null>(null);
  const [picker, setPicker] = useState<PickerScreen>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const current = draft ?? saved;
  const active = resolveActiveAvailability(current);
  const savedActive = resolveActiveAvailability(saved);

  const isDirty =
    current.mode !== saved.mode ||
    !sameIdSet(active.regions, savedActive.regions) ||
    !sameIdSet(active.provinces, savedActive.provinces);

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "fan",
          section: "areas",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  function applyMode(mode: AvailabilityType) {
    setErrorMessage(null);
    /*
      La modalità abbandonata non resta nella bozza: il database può contenere
      una sola lista, e tenerne due in locale significa mostrare un riepilogo
      che il salvataggio poi smentisce.
    */
    setDraft({
      mode,
      provinces: mode === "PROVINCES" ? current.provinces : [],
      regions: mode === "REGIONS" ? current.regions : [],
    });
    trackProfileEvent("profile_area_mode_changed", {
      geographicMode: mode,
      profileType: "fan",
      section: "areas",
    });

    if (mode === "REGIONS") {
      openPicker("regions");
      return;
    }

    if (mode === "PROVINCES") {
      openPicker("provinces");
    }
  }

  function handleSelectMode(mode: AvailabilityType) {
    if (mode === current.mode) {
      if (mode === "REGIONS") {
        openPicker("regions");
      } else if (mode === "PROVINCES") {
        openPicker("provinces");
      }

      return;
    }

    const losesSelection =
      (current.mode === "REGIONS" && current.regions.length > 0) ||
      (current.mode === "PROVINCES" && current.provinces.length > 0);

    if (!losesSelection) {
      applyMode(mode);
      return;
    }

    Alert.alert(
      "Cambiare modalità?",
      "Le aree selezionate in precedenza verranno rimosse.",
      [
        { style: "cancel", text: "Annulla" },
        { onPress: () => applyMode(mode), text: "Continua" },
      ],
    );
  }

  function openPicker(screen: Exclude<PickerScreen, null>) {
    setPicker(screen);
    trackProfileEvent("fan_areas_selector_opened", {
      profileType: "fan",
      section: "areas",
    });
  }

  function handleSave() {
    if (!data) {
      return;
    }

    if (!isAvailabilityComplete(current)) {
      setErrorMessage("Seleziona almeno un'area.");
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          kind: "areas",
          value: {
            geo_scope: current.mode,
            interest_provinces: active.provinces,
            interest_regions: active.regions,
          },
        },
      },
      {
        onError: (error) => {
          if (error instanceof FanProfileConflictError) {
            trackProfileEvent("fan_profile_edit_conflict", {
              profileType: "fan",
              section: "areas",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "fan",
            section: "areas",
            success: false,
          });
          setErrorMessage(describeFanSaveError(error));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "fan",
            section: "areas",
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  if (picker) {
    const isRegions = picker === "regions";

    return (
      <GeographicPickerScreen
        emptyStateMessage={
          isRegions ? "Nessuna regione trovata" : "Nessuna provincia trovata"
        }
        onBack={() => setPicker(null)}
        onChange={(values) =>
          setDraft({
            ...current,
            ...(isRegions ? { regions: values } : { provinces: values }),
          })
        }
        onConfirm={() => setPicker(null)}
        options={isRegions ? REGION_OPTIONS : PROVINCE_OPTIONS}
        searchPlaceholder={isRegions ? "Cerca regione" : "Cerca provincia"}
        subtitle={
          isRegions
            ? "Puoi scegliere una o più regioni."
            : "Scegli una o più zone che vuoi seguire."
        }
        testID={isRegions ? "fan-areas-regions" : "fan-areas-provinces"}
        title={isRegions ? "Seleziona le regioni" : "Seleziona le zone"}
        unit={isRegions ? "regione" : "provincia"}
        values={isRegions ? current.regions : current.provinces}
      />
    );
  }

  const selectedLabels =
    current.mode === "REGIONS"
      ? current.regions
      : current.mode === "PROVINCES"
        ? current.provinces
        : [];

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={data ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="fan-profile-edit-areas"
      title="Aree di interesse"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="fan-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={FAN_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="fan-edit-error"
        />
      ) : null}

      {data ? (
        <View style={styles.content}>
          {/*
            La privacy è scritta, non solo disegnata: il lucchetto da solo non
            direbbe niente a chi usa uno screen reader.
          */}
          <View accessible style={styles.privacyBadge} testID="fan-areas-privacy">
            <Ionicons color={colors.accent} name="lock-closed" size={14} />
            <AppText color="accent" variant="metaStrong">
              {FAN_AREAS_PRIVACY_SUFFIX}
            </AppText>
          </View>

          <AppText color="secondary" variant="bodySm">
            Scegli le aree da cui ricevere contenuti e suggerimenti.
          </AppText>

          <View accessibilityRole="radiogroup" style={styles.modes}>
            <AvailabilityModeCard
              affordance="direct"
              description={FAN_TERRITORY_MODE_COPY.ITALY.description}
              icon={FAN_TERRITORY_MODE_COPY.ITALY.icon}
              onPress={() => handleSelectMode("ITALY")}
              selected={current.mode === "ITALY"}
              testID="fan-area-mode-italy"
              title={FAN_TERRITORY_MODE_COPY.ITALY.title}
            />
            <AvailabilityModeCard
              affordance="drilldown"
              description={FAN_TERRITORY_MODE_COPY.REGIONS.description}
              icon={FAN_TERRITORY_MODE_COPY.REGIONS.icon}
              onPress={() => handleSelectMode("REGIONS")}
              selected={current.mode === "REGIONS"}
              summary={
                current.mode === "REGIONS"
                  ? buildAvailabilitySummary(current.regions.length, "regione")
                  : undefined
              }
              testID="fan-area-mode-regions"
              title={FAN_TERRITORY_MODE_COPY.REGIONS.title}
            />
            <AvailabilityModeCard
              affordance="drilldown"
              description={FAN_TERRITORY_MODE_COPY.PROVINCES.description}
              icon={FAN_TERRITORY_MODE_COPY.PROVINCES.icon}
              onPress={() => handleSelectMode("PROVINCES")}
              selected={current.mode === "PROVINCES"}
              summary={
                current.mode === "PROVINCES"
                  ? buildAvailabilitySummary(
                      current.provinces.length,
                      "provincia",
                    )
                  : undefined
              }
              testID="fan-area-mode-provinces"
              title={FAN_TERRITORY_MODE_COPY.PROVINCES.title}
            />
          </View>

          {selectedLabels.length > 0 ? (
            <View style={styles.selectedCard} testID="fan-areas-selected">
              <AppText variant="eyebrow">Aree selezionate</AppText>
              <AppText color="secondary" variant="bodySm">
                {selectedLabels.join(" · ")}
              </AppText>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() =>
                  openPicker(current.mode === "REGIONS" ? "regions" : "provinces")
                }
                style={styles.editAreas}
                testID="fan-areas-edit"
              >
                <AppText color="accent" variant="actionLabel">
                  Modifica aree
                </AppText>
                <Ionicons color={colors.accent} name="chevron-forward" size={14} />
              </Pressable>
            </View>
          ) : null}

          <InfoMessage message={PRIVACY_NOTE} testID="fan-areas-privacy-note" />
        </View>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
  },
  editAreas: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: 32,
  },
  modes: {
    gap: spacing[12],
  },
  privacyBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[4],
  },
  selectedCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[16],
  },
});
