/**
 * Categorie seguite (REV-PROF-20, schermata 5).
 *
 * Campionati, livelli e fasce: la tassonomia è quella condivisa da onboarding,
 * ricerca, feed e profili (`INTEREST_CATEGORY_OPTIONS`), raggruppata dal
 * registro che vive accanto a essa. Qui non nasce un secondo vocabolario e
 * non nascono gruppi specifici dell'editor.
 *
 * Le categorie non sono gli interessi calcistici: "Promozione" è un
 * campionato, "Calcio dilettantistico" è un ambito. Modificare le une non
 * tocca gli altri, in nessuna direzione.
 *
 * Una categoria che la tassonomia non riconosce più non viene persa e non
 * viene mostrata come scelta valida: resta elencata come da rivedere, e sta
 * all'utente toglierla. Nessuna sostituzione automatica, nessuna mappatura
 * indovinata.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, SearchField } from "../../../../ui";
import { InfoMessage, SelectionRow, ToggleRow } from "../../../onboarding/ui";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { trackProfileEvent } from "../../profile-analytics";
import {
  describeFanSaveError,
  FAN_LOAD_ERROR_MESSAGE,
  FanProfileConflictError,
  useCompleteProfileQuery,
  useFanSectionSave,
} from "../fan-profile-edit-service";
import {
  filterFanCategoryGroups,
  normalizeFanCategories,
  sameIdSet,
} from "../fan-selection";
import { useFanEditorGuard } from "../use-fan-editor-guard";

const DEPRECATED_MESSAGE =
  "Questa categoria non è più disponibile. Aggiorna la selezione.";

export function FanCategoriesScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useFanSectionSave(userId);
  const data = profileQuery.data;

  const saved = normalizeFanCategories(data?.fanProfile?.interest_categories);
  const savedValues = [...saved.known, ...saved.deprecated];
  const savedIsPublic = data?.fanProfile?.interest_categories_are_public ?? false;

  const [draftValues, setDraftValues] = useState<string[] | null>(null);
  const [draftIsPublic, setDraftIsPublic] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const values = draftValues ?? savedValues;
  const current = normalizeFanCategories(values);
  const isPublic = values.length > 0 && (draftIsPublic ?? savedIsPublic);
  const isDirty =
    !sameIdSet(values, savedValues) ||
    isPublic !== (savedIsPublic && savedValues.length > 0);

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "fan",
          section: "categories",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  function toggleCategory(category: string) {
    setErrorMessage(null);
    setDraftValues(
      values.includes(category)
        ? values.filter((entry) => entry !== category)
        : [...values, category],
    );
    trackProfileEvent("fan_category_toggled", {
      profileType: "fan",
      section: "categories",
    });
  }

  function handleSave() {
    if (!data) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          kind: "categories",
          value: {
            interest_categories: values,
            interest_categories_are_public: isPublic,
          },
        },
      },
      {
        onError: (error) => {
          if (error instanceof FanProfileConflictError) {
            trackProfileEvent("fan_profile_edit_conflict", {
              profileType: "fan",
              section: "categories",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "fan",
            section: "categories",
            success: false,
          });
          setErrorMessage(describeFanSaveError(error));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "fan",
            section: "categories",
            success: true,
          });
          setDraftValues(null);
          setDraftIsPublic(null);
          router.back();
        },
      },
    );
  }

  const groups = filterFanCategoryGroups(query);

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={data ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="fan-profile-edit-categories"
      title="Categorie seguite"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={5} testID="fan-edit-skeleton" />
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
          <AppText color="secondary" variant="bodySm">
            Seleziona campionati e categorie che vuoi seguire.
          </AppText>

          <SearchField
            onChangeText={(value) => {
              setQuery(value);

              if (value.trim()) {
                trackProfileEvent("fan_category_search_started", {
                  profileType: "fan",
                  section: "categories",
                });
              }
            }}
            placeholder="Cerca categoria"
            testID="fan-categories-search"
            value={query}
          />

          {/*
            I chip riassumono la selezione corrente e la lasciano togliere da
            qui: la riga corrispondente nella lista si aggiorna insieme,
            perché leggono dallo stesso stato.
          */}
          {values.length > 0 ? (
            <View style={styles.chips} testID="fan-categories-chips">
              {values.map((category) => (
                <Pressable
                  accessibilityLabel={`Rimuovi ${category}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: true }}
                  hitSlop={6}
                  key={category}
                  onPress={() => toggleCategory(category)}
                  style={styles.chip}
                  testID={`fan-category-chip-${category}`}
                >
                  <AppText color="accent" variant="meta">
                    {category}
                  </AppText>
                  <Ionicons color={colors.accent} name="close" size={14} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {current.deprecated.length > 0 ? (
            <InfoMessage
              message={DEPRECATED_MESSAGE}
              testID="fan-categories-deprecated"
              tone="warning"
            />
          ) : null}

          {groups.length === 0 ? (
            <View style={styles.empty} testID="fan-categories-empty">
              <AppText variant="titleSm">Nessuna categoria trovata</AppText>
              <AppText color="secondary" variant="bodySm">
                Prova con un altro termine.
              </AppText>
            </View>
          ) : null}

          {groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <AppText variant="eyebrow">{group.title}</AppText>
              <View style={styles.groupRows}>
                {group.categories.map((category) => (
                  <SelectionRow
                    key={category}
                    label={category}
                    onPress={() => toggleCategory(category)}
                    selected={values.includes(category)}
                    testID={`fan-category-${category}`}
                  />
                ))}
              </View>
            </View>
          ))}

          <ToggleRow
            description="Le categorie selezionate saranno pubbliche."
            disabled={values.length === 0}
            label="Mostra nel profilo"
            onValueChange={(value) => {
              setDraftIsPublic(value);
              trackProfileEvent("fan_visibility_changed", {
                profileType: "fan",
                section: "categories",
                visible: value,
              });
            }}
            testID="fan-categories-visibility"
            value={isPublic}
          />
        </View>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[4],
    minHeight: 36,
    paddingHorizontal: spacing[12],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  content: {
    gap: spacing[16],
  },
  empty: {
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[24],
  },
  group: {
    gap: spacing[8],
  },
  groupRows: {
    gap: spacing[8],
  },
});
