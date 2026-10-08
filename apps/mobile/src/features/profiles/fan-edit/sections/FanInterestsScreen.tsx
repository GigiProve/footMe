/**
 * Interessi calcistici (REV-PROF-20, schermata 4).
 *
 * Le quattro macro-categorie vengono dalla tassonomia centralizzata di
 * REV-ONB-08 (`FAN_FOOTBALL_TYPE_OPTIONS`): l'elenco non è scritto qui, e
 * aggiungerne una quinta non richiede di toccare questa schermata.
 *
 * Gli interessi sono macro-ambiti, non campionati: "Calcio dilettantistico" e
 * "Promozione" vivono in due moduli diversi perché sono due domini diversi.
 * Cambiare un interesse non tocca le categorie seguite, e viceversa.
 *
 * Il toggle governa la pubblicazione, non la selezione: spegnerlo lascia le
 * preferenze dove sono — continuano ad alimentare feed e suggerimenti — e le
 * toglie soltanto dal payload pubblico.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  FAN_FOOTBALL_TYPE_OPTIONS,
  type FanFootballType,
} from "../../../onboarding/community/fan-taxonomy";
import { SelectionRow, ToggleRow } from "../../../onboarding/ui";
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
import { normalizeFanInterests, sameIdSet } from "../fan-selection";
import { useFanEditorGuard } from "../use-fan-editor-guard";

export function FanInterestsScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useFanSectionSave(userId);
  const data = profileQuery.data;

  const savedValues = normalizeFanInterests(data?.fanProfile?.football_types);
  const savedIsPublic = data?.fanProfile?.football_types_are_public ?? false;

  const [draftValues, setDraftValues] = useState<FanFootballType[] | null>(null);
  const [draftIsPublic, setDraftIsPublic] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const values = draftValues ?? savedValues;
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
          section: "interests",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  function toggleValue(value: FanFootballType) {
    setErrorMessage(null);
    setDraftValues(
      values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value],
    );
    trackProfileEvent("fan_interest_toggled", {
      profileType: "fan",
      section: "interests",
    });
  }

  function handleSave() {
    if (!data) {
      return;
    }

    /*
      Stessa obbligatorietà dell'onboarding (REV-ONB-08): un interesse almeno.
      Non ne viene introdotta una nuova, e non ne viene tolta una esistente.
    */
    if (values.length === 0) {
      setErrorMessage("Seleziona almeno un interesse calcistico.");
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          kind: "interests",
          value: {
            football_types: values,
            football_types_are_public: isPublic,
          },
        },
      },
      {
        onError: (error) => {
          if (error instanceof FanProfileConflictError) {
            trackProfileEvent("fan_profile_edit_conflict", {
              profileType: "fan",
              section: "interests",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "fan",
            section: "interests",
            success: false,
          });
          setErrorMessage(describeFanSaveError(error));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "fan",
            section: "interests",
            success: true,
          });
          setDraftValues(null);
          setDraftIsPublic(null);
          router.back();
        },
      },
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={data ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="fan-profile-edit-interests"
      title="Interessi calcistici"
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
          <AppText color="secondary" variant="bodySm">
            Scegli il calcio che vuoi seguire.
          </AppText>

          <View style={styles.options}>
            {FAN_FOOTBALL_TYPE_OPTIONS.map((option) => {
              const selected = values.includes(option.value);

              return (
                <SelectionRow
                  description={option.description}
                  key={option.value}
                  label={option.label}
                  leading={
                    <Ionicons
                      color={selected ? colors.accent : colors.textSecondary}
                      name={option.icon}
                      size={18}
                    />
                  }
                  onPress={() => toggleValue(option.value)}
                  selected={selected}
                  testID={`fan-interest-${option.value}`}
                />
              );
            })}
          </View>

          <ToggleRow
            description="Gli interessi selezionati saranno pubblici."
            disabled={values.length === 0}
            label="Mostra nel profilo"
            onValueChange={(value) => {
              setDraftIsPublic(value);
              trackProfileEvent("fan_visibility_changed", {
                profileType: "fan",
                section: "interests",
                visible: value,
              });
            }}
            testID="fan-interests-visibility"
            value={isPublic}
          />
        </View>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
  },
  options: {
    gap: spacing[12],
  },
});
