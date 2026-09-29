/**
 * Profilo allenatore (REV-PROF-05, schermata 3): ruolo principale, patentino e
 * categorie allenate.
 *
 * Tre campi, e niente altro. In particolare **non** ci sono club, ruolo e
 * categoria attuali: quelli si leggono dalla carriera (REV-PROF-04) e un campo
 * manuale qui creerebbe una seconda "Situazione attuale" destinata a divergere
 * al primo incarico nuovo.
 *
 * Distinzione che la task chiede di tenere ferma:
 *  - il *ruolo principale* descrive il profilo, non le singole stagioni;
 *  - le *categorie allenate* descrivono l'esperienza complessiva, non la
 *    categoria di una stagione.
 * Entrambi convivono con i valori per stagione della carriera senza
 * sovrascriverli.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { OnboardingSelectField, SelectionRow } from "../../../onboarding/ui";
import {
  COACH_CATEGORY_OPTIONS,
  COACH_PRIMARY_ROLE_OPTIONS,
  LICENSE_TYPE_OPTIONS,
} from "../../../onboarding/coach/coach-options";
import { trackProfileEvent } from "../../profile-analytics";
import { toDelimitedString } from "../../profile-edit-helpers";
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

/**
 * Icona per categoria. Le categorie non previste cadono sul simbolo neutro:
 * la lista delle categorie può crescere senza toccare questa schermata.
 */
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Allievi: "school-outline",
  "Attività di base": "happy-outline",
  Berretti: "school-outline",
  Giovanissimi: "people-circle-outline",
  Juniores: "people-outline",
  Primavera: "leaf-outline",
  "Prima Squadra": "shield-outline",
  "Scuola Calcio": "happy-outline",
  "Settore Giovanile": "people-outline",
};

type TechnicalForm = {
  categories: string[];
  license: string;
  primaryRole: string;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function CoachTechnicalProfileScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<TechnicalForm | null>(() => {
    if (!data) {
      return null;
    }

    const coach = data.coachProfile;

    return {
      categories: coach?.coached_categories ?? [],
      // Il patentino è uno solo: la colonna è un array per ragioni storiche,
      // ma il prodotto ne dichiara e ne mostra uno.
      license: coach?.licenses?.[0] ?? "",
      primaryRole: coach?.primary_role ?? "",
    };
  }, [data]);

  const [draft, setDraft] = useState<TechnicalForm | null>(null);
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
          section: "technical",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<TechnicalForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  function toggleCategory(value: string) {
    if (!form) {
      return;
    }

    patch({
      categories: form.categories.includes(value)
        ? form.categories.filter((entry) => entry !== value)
        : [...form.categories, value],
    });
  }

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (!form.primaryRole.trim()) {
      setErrorMessage("Seleziona un ruolo.");
      return;
    }

    if (!form.license.trim()) {
      setErrorMessage("Seleziona un patentino.");
      return;
    }

    if (form.categories.length === 0) {
      setErrorMessage("Seleziona almeno una categoria.");
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          coachPrimaryRole: form.primaryRole,
          coachedCategories: toDelimitedString(form.categories),
          licenses: toDelimitedString([form.license]),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "coach",
            section: "technical",
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
            section: "technical",
            success: true,
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
      testID="coach-profile-edit-technical"
      title="Profilo allenatore"
    >
      {profileQuery.isPending ? <CoachEditFieldsSkeleton rows={3} /> : null}

      {profileQuery.isError ? (
        <CoachEditErrorState onRetry={() => void profileQuery.refetch()} />
      ) : null}

      {form ? (
        <>
          <OnboardingSelectField
            label="Ruolo principale"
            onChange={(value) => patch({ primaryRole: value })}
            options={COACH_PRIMARY_ROLE_OPTIONS}
            placeholder="Seleziona il ruolo"
            sheetTitle="Ruolo principale"
            testID="coach-technical-role"
            value={form.primaryRole}
          />

          <OnboardingSelectField
            label="Patentino"
            onChange={(value) => patch({ license: value })}
            options={LICENSE_TYPE_OPTIONS}
            placeholder="Seleziona il patentino"
            sheetTitle="Patentino"
            testID="coach-technical-license"
            value={form.license}
          />

          <View style={styles.categories}>
            <View style={styles.categoriesHeader}>
              <AppText variant="titleSm">Categorie allenate</AppText>
              <AppText color="secondary" variant="bodySm">
                Seleziona una o più categorie
              </AppText>
            </View>

            {COACH_CATEGORY_OPTIONS.map((option) => (
              <SelectionRow
                control="checkbox"
                key={option.value}
                label={option.label}
                leading={
                  <Ionicons
                    color={
                      form.categories.includes(option.value)
                        ? colors.accent
                        : colors.textSecondary
                    }
                    name={CATEGORY_ICONS[option.value] ?? "ellipse-outline"}
                    size={20}
                  />
                }
                onPress={() => toggleCategory(option.value)}
                selected={form.categories.includes(option.value)}
                testID={`coach-category-${option.value}`}
              />
            ))}
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  categories: {
    gap: spacing[8],
  },
  categoriesHeader: {
    gap: spacing[4],
  },
});
