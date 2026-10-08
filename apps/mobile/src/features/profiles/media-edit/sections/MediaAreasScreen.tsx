/**
 * Aree coperte (REV-PROF-22, Screen 6).
 *
 * La **copertura geografica editoriale**: dove la realtà racconta il calcio.
 * Non è la residenza del proprietario, che vive su `profiles`, sta in "Dati
 * personali" ed è privata — e non ne è nemmeno il default. Niente
 * geolocalizzazione, niente indirizzo IP, niente domicilio: una copertura si
 * dichiara, non si deduce.
 *
 * Modalità e selettore sono quelli canonici dell'onboarding (REV-ONB-02,
 * riusati dal Tifoso in REV-ONB-08): stesse tre modalità, stessa ricerca,
 * stesso elenco di regioni e province. Qui non nasce un secondo modello
 * geografico — nasce soltanto la colonna che registra **quale** modalità è
 * stata scelta, perché prima di questa task "Tutta Italia" e "nessuna area
 * dichiarata" erano indistinguibili.
 *
 * Il selettore aggiorna la bozza; il backend lo tocca "Salva modifiche".
 */
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { GeographicPickerScreen } from "../../../onboarding/player/GeographicPickerScreen";
import { InfoMessage, SelectionRow } from "../../../onboarding/ui";
import type { MediaCoverageScope } from "../../media/media-master-profile";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { trackProfileEvent } from "../../profile-analytics";
import { PROVINCE_OPTIONS, REGION_OPTIONS } from "../../profile-form-utils";
import {
  resolveMediaAreasDraft,
  sameMediaSelection,
  validateMediaAreas,
  type MediaAreasDraft,
} from "../media-edit-rules";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  MediaProfileConflictError,
  describeMediaSaveError,
  useCompleteProfileQuery,
  useMediaSectionSave,
} from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

/**
 * Copy delle tre modalità. I titoli sono quelli condivisi con l'onboarding;
 * le descrizioni parlano di copertura editoriale e non di preferenze
 * personali, perché è questo che la schermata dichiara.
 */
const MODE_COPY: Record<
  MediaCoverageScope,
  { description: string; icon: keyof typeof Ionicons.glyphMap; title: string }
> = {
  ITALY: {
    description: "Racconti il calcio da tutto il territorio nazionale.",
    icon: "globe-outline",
    title: "Tutta Italia",
  },
  PROVINCES: {
    description: "Indica le province su cui si concentra la redazione.",
    icon: "location-outline",
    title: "Zone specifiche",
  },
  REGIONS: {
    description: "Scegli le regioni che copri abitualmente.",
    icon: "map-outline",
    title: "In una o più regioni",
  },
};

const MODES: readonly MediaCoverageScope[] = ["ITALY", "REGIONS", "PROVINCES"];

const PRIVACY_NOTE =
  "Indicano la copertura editoriale, non la tua residenza.";

type PickerScreen = "regions" | "provinces" | null;

export function MediaAreasScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useMediaSectionSave(userId);
  const data = profileQuery.data;

  const media = data?.mediaProfile ?? null;
  /*
    Una realtà che non ha ancora dichiarato una modalità ricade sulle regioni
    se ha dei territori storici — erano già pubblici — e altrimenti resta
    senza modalità: "Tutta Italia" sarebbe una dichiarazione che nessuno ha
    fatto, e la CTA è disabilitata finché non la si fa davvero.
  */
  const savedScope: MediaCoverageScope | null =
    media?.coverage_scope ??
    ((media?.covered_territories.length ?? 0) > 0 ? "REGIONS" : null);

  const saved: MediaAreasDraft = {
    provinces: [...(media?.covered_provinces ?? [])],
    regions: [...(media?.covered_territories ?? [])],
    scope: savedScope ?? "ITALY",
  };

  const [draft, setDraft] = useState<MediaAreasDraft | null>(null);
  const [picker, setPicker] = useState<PickerScreen>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const current = draft ?? saved;
  const active = resolveMediaAreasDraft(current);
  const savedActive = resolveMediaAreasDraft(saved);

  /**
   * Senza una modalità salvata e senza una bozza non c'è nessuna
   * dichiarazione: nessun radio risulta selezionato, e la CTA resta spenta.
   * "Tutta Italia" è il default tecnico della bozza, non una scelta fatta —
   * e un salvataggio non deve poterla trasformare in una.
   */
  const hasDeclaration = draft !== null || savedScope !== null;

  const isDirty =
    draft !== null &&
    (savedScope === null ||
      current.scope !== saved.scope ||
      !sameMediaSelection(active.regions, savedActive.regions) ||
      !sameMediaSelection(active.provinces, savedActive.provinces));

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "media",
          section: "areas",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  function openPicker(screen: Exclude<PickerScreen, null>) {
    setPicker(screen);
    trackProfileEvent("media_areas_selector_opened", {
      profileType: "media",
      section: "areas",
    });
  }

  function applyMode(scope: MediaCoverageScope) {
    setErrorMessage(null);
    /*
      La modalità abbandonata non resta nella bozza: il database tiene una
      sola lista attiva, e tenerne due in locale mostrerebbe un riepilogo che
      il salvataggio poi smentisce.
    */
    setDraft({
      provinces: scope === "PROVINCES" ? current.provinces : [],
      regions: scope === "REGIONS" ? current.regions : [],
      scope,
    });
    trackProfileEvent("profile_area_mode_changed", {
      geographicMode: scope,
      profileType: "media",
      section: "areas",
    });

    if (scope === "REGIONS") {
      openPicker("regions");
      return;
    }

    if (scope === "PROVINCES") {
      openPicker("provinces");
    }
  }

  function handleSelectMode(scope: MediaCoverageScope) {
    // Prima dichiarazione: anche la modalità che coincide con il default
    // tecnico è una scelta, e va registrata come tale.
    if (!hasDeclaration) {
      applyMode(scope);
      return;
    }

    if (scope === current.scope) {
      if (scope === "REGIONS") {
        openPicker("regions");
      } else if (scope === "PROVINCES") {
        openPicker("provinces");
      }

      return;
    }

    const losesSelection =
      (current.scope === "REGIONS" && current.regions.length > 0) ||
      (current.scope === "PROVINCES" && current.provinces.length > 0);

    if (!losesSelection) {
      applyMode(scope);
      return;
    }

    Alert.alert(
      "Cambiare modalità?",
      "Le aree selezionate in precedenza verranno rimosse.",
      [
        { style: "cancel", text: "Annulla" },
        { onPress: () => applyMode(scope), text: "Continua" },
      ],
    );
  }

  function handleSave() {
    if (!data) {
      return;
    }

    const error = validateMediaAreas(current);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          kind: "areas",
          value: {
            coverage_scope: current.scope,
            covered_provinces: active.provinces,
            covered_territories: active.regions,
          },
        },
      },
      {
        onError: (saveError) => {
          if (saveError instanceof MediaProfileConflictError) {
            trackProfileEvent("media_profile_edit_conflict", {
              profileType: "media",
              section: "areas",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "media",
            section: "areas",
            success: false,
          });
          setErrorMessage(describeMediaSaveError(saveError));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "media",
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
            : "Scegli una o più zone che copri."
        }
        testID={isRegions ? "media-areas-regions" : "media-areas-provinces"}
        title={isRegions ? "Seleziona le regioni" : "Seleziona le zone"}
        unit={isRegions ? "regione" : "provincia"}
        values={isRegions ? current.regions : current.provinces}
      />
    );
  }

  const selectedLabels =
    current.scope === "REGIONS"
      ? current.regions
      : current.scope === "PROVINCES"
        ? current.provinces
        : [];

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={data ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="media-profile-edit-areas"
      title="Aree coperte"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="media-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={MEDIA_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="media-edit-error"
        />
      ) : null}

      {data ? (
        <View style={styles.content}>
          <AppText color="secondary" variant="bodySm">
            Definisci la copertura geografica della tua attività editoriale.
          </AppText>

          {/*
            Le tre modalità sono mutuamente esclusive e vanno annunciate come
            un gruppo: `radiogroup` più controlli `radio`, non tre caselle
            indipendenti.
          */}
          <View accessibilityRole="radiogroup" style={styles.modes}>
            {MODES.map((scope) => (
              <SelectionRow
                control="radio"
                description={MODE_COPY[scope].description}
                key={scope}
                label={MODE_COPY[scope].title}
                leading={
                  <Ionicons
                    color={
                      current.scope === scope
                        ? colors.accent
                        : colors.textSecondary
                    }
                    name={MODE_COPY[scope].icon}
                    size={20}
                  />
                }
                onPress={() => handleSelectMode(scope)}
                selected={hasDeclaration && current.scope === scope}
                testID={`media-area-mode-${scope.toLowerCase()}`}
              />
            ))}
          </View>

          {selectedLabels.length > 0 ? (
            <View style={styles.selectedCard} testID="media-areas-selected">
              <AppText variant="eyebrow">Aree selezionate</AppText>
              <AppText color="secondary" variant="bodySm">
                {selectedLabels.join(" · ")}
              </AppText>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() =>
                  openPicker(
                    current.scope === "REGIONS" ? "regions" : "provinces",
                  )
                }
                style={styles.editAreas}
                testID="media-areas-edit"
              >
                <AppText color="accent" variant="actionLabel">
                  Modifica aree
                </AppText>
                <Ionicons
                  color={colors.accent}
                  name="chevron-forward"
                  size={14}
                />
              </Pressable>
            </View>
          ) : null}

          <InfoMessage message={PRIVACY_NOTE} testID="media-areas-note" />
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
  selectedCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[16],
  },
});
