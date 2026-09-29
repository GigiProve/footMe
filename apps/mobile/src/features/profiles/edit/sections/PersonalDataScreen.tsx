/**
 * Dati personali (§H.1, §H.3): anagrafica e residenza.
 *
 * Niente carriera, contatti, credenziali, statistiche, disponibilità, media o
 * stato contrattuale: hanno una sezione loro e qui creerebbero un secondo
 * punto di verità.
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { NationalityAutocompleteInput } from "../../../../components/ui/nationality-autocomplete-input";
import { ResidenceCityInput } from "../../../../components/ui/residence-city-input";
import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  DateSelector,
  OnboardingTextField,
  SegmentedSelector,
  ToggleRow,
} from "../../../onboarding/ui";
import type { ProfileGender } from "../../../onboarding/onboarding-types";
import { trackProfileEvent } from "../../profile-analytics";
import { buildInitialState } from "../../profile-edit-helpers";
import {
  formatBirthDateInputValue,
  getRegionFromCity,
  isRegionConsistentWithCity,
  joinFullName,
  parseBirthDateInput,
  splitFullName,
  validateBirthDateInput,
  type ItalianCityOption,
} from "../../profile-form-utils";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

/** Stessi valori dell'onboarding: nessuna tassonomia nuova (§H.1). */
const GENDER_OPTIONS = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
] as const;

type PersonalForm = {
  birthDate: string;
  domicile: string;
  firstName: string;
  gender: ProfileGender | "";
  lastName: string;
  nationality: string;
  region: string;
  residence: string;
  useResidenceForDomicile: boolean;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function PersonalDataScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<PersonalForm | null>(() => {
    if (!data) {
      return null;
    }

    const base = buildInitialState(data);
    const { firstName, lastName } = splitFullName(base.fullName);

    return {
      birthDate: base.birthDate,
      domicile: base.domicile,
      firstName,
      gender: base.gender,
      lastName,
      nationality: base.nationality,
      region: base.region,
      residence: base.residence,
      useResidenceForDomicile: base.useResidenceForDomicile,
    };
  }, [data]);

  const [draft, setDraft] = useState<PersonalForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    (changes: Partial<PersonalForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    /*
      Nome e Cognome tornano in una stringa sola: `profiles.full_name` è una
      colonna unica e la concatenazione è esatta, quindi il valore salvato non
      si degrada riaprendo l'editor.
    */
    const fullName = joinFullName(form.firstName, form.lastName);

    if (!fullName) {
      setErrorMessage("Inserisci nome e cognome.");
      return;
    }

    const birthDateResult = validateBirthDateInput(form.birthDate);

    if (!birthDateResult.isValid) {
      setErrorMessage(
        birthDateResult.message ?? "Controlla la data di nascita.",
      );
      return;
    }

    if (form.residence.trim() && !getRegionFromCity(form.residence)) {
      setErrorMessage(
        "La città inserita non è stata trovata. Selezionala dai suggerimenti.",
      );
      return;
    }

    if (
      form.residence.trim() &&
      form.region.trim() &&
      !isRegionConsistentWithCity(form.residence, form.region)
    ) {
      setErrorMessage(
        "La regione selezionata non corrisponde alla città inserita.",
      );
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          birthDate: form.birthDate,
          domicile: form.domicile,
          fullName,
          gender: form.gender,
          nationality: form.nationality,
          region: form.region,
          residence: form.residence,
          useResidenceForDomicile: form.useResidenceForDomicile,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
            section: "personal",
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
            section: "personal",
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
      testID="profile-edit-personal"
      title="Dati personali"
    >
      {profileQuery.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

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
          <OnboardingTextField
            label="Nome"
            onChangeText={(value) => patch({ firstName: value })}
            placeholder="Nome"
            testID="personal-first-name"
            value={form.firstName}
          />

          <OnboardingTextField
            label="Cognome"
            onChangeText={(value) => patch({ lastName: value })}
            placeholder="Cognome"
            testID="personal-last-name"
            value={form.lastName}
          />

          <DateSelector
            label="Data di nascita"
            mode="date"
            onChange={(value) =>
              patch({ birthDate: formatBirthDateInputValue(value) })
            }
            placeholder="Seleziona la data"
            testID="personal-birth-date"
            value={parseBirthDateInput(form.birthDate)?.isoValue ?? ""}
          />

          <SegmentedSelector
            label="Sesso"
            onChange={(value) => patch({ gender: value as ProfileGender })}
            options={[...GENDER_OPTIONS]}
            testID="personal-gender"
            value={form.gender}
          />

          <NationalityAutocompleteInput
            label="Nazionalità"
            onChange={(value) => patch({ nationality: value })}
            value={form.nationality}
          />

          <ResidenceCityInput
            label="Residenza"
            onChangeText={(value) => patch({ residence: value })}
            onSelectCity={(city: ItalianCityOption) =>
              patch({ region: city.region, residence: city.name })
            }
            value={form.residence}
          />

          <ToggleRow
            label="Domicilio diverso dalla residenza"
            onValueChange={(value) =>
              patch({ useResidenceForDomicile: !value })
            }
            testID="personal-domicile-toggle"
            value={!form.useResidenceForDomicile}
          >
            <ResidenceCityInput
              label="Domicilio"
              onChangeText={(value) => patch({ domicile: value })}
              onSelectCity={(city: ItalianCityOption) =>
                patch({ domicile: city.name })
              }
              value={form.domicile}
            />
          </ToggleRow>
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
});
