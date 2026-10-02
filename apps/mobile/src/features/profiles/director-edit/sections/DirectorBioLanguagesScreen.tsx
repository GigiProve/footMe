/**
 * Bio e lingue del Dirigente (REV-PROF-11, schermata 6).
 *
 * Due dati facoltativi che vivono entrambi su `profiles`, non su
 * `director_profiles`: la bio e le lingue sono dell'utente, non del ruolo, e
 * questa schermata non ne crea una seconda copia dirigenziale.
 *
 * Tre regole della task che il codice applica alla lettera:
 *
 *  - **la bio è facoltativa ma non può essere fatta di spazi.** Si salva
 *    sempre il valore ripulito ai bordi; una stringa di soli spazi diventa
 *    assenza di bio, non una bio vuota;
 *  - **nessun placeholder finisce fra i dati.** Il testo grigio del campo è
 *    un suggerimento, non un contenuto: se l'utente non scrive niente, nel
 *    profilo non compare niente;
 *  - **il limite è 300 caratteri.** L'onboarding ne accetta fino a 1000
 *    (`DIRECTOR_BIO_MAX_LENGTH`) e questa review abbassa il limite senza
 *    toccare quel flusso: una bio storica più lunga non viene troncata in
 *    silenzio — resta leggibile, il contatore la segnala e il salvataggio
 *    chiede di accorciarla. Tagliare da soli il testo di qualcuno sarebbe una
 *    perdita di dati mascherata da validazione.
 *
 * Le lingue usano il selector già approvato negli altri onboarding: quelle
 * frequenti a vista, le altre dietro un campo ricercabile. Nessun livello di
 * competenza, che il modello non rappresenta.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  OnboardingChipMultiSelect,
  OnboardingMultiSelectField,
  OnboardingTextField,
} from "../../../onboarding/ui";
import {
  AGENT_COMMON_LANGUAGE_OPTIONS,
  AGENT_OTHER_LANGUAGE_OPTIONS,
  splitAgentLanguages,
} from "../../../onboarding/agent/agent-taxonomy";
import { trackProfileEvent } from "../../profile-analytics";
import { toDelimitedString } from "../../profile-edit-helpers";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

/** REV-PROF-11: il mockup mostra "128/300" e la task fissa il limite a 300. */
export const DIRECTOR_PROFILE_BIO_MAX_LENGTH = 300;

type BioForm = {
  bio: string;
  languages: string[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function DirectorBioLanguagesScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<BioForm | null>(() => {
    if (!data) {
      return null;
    }

    return {
      bio: data.profile.bio ?? "",
      languages: (data.profile.languages ?? [])
        .map((language) => language.trim())
        .filter(Boolean),
    };
  }, [data]);

  const [draft, setDraft] = useState<BioForm | null>(null);
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
          profileType: "director",
          section: "bio",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<BioForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  const { common, other } = splitAgentLanguages(form?.languages ?? []);
  const bioLength = form?.bio.trim().length ?? 0;
  const isBioTooLong = bioLength > DIRECTOR_PROFILE_BIO_MAX_LENGTH;

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (isBioTooLong) {
      setErrorMessage(
        `La bio può contenere al massimo ${DIRECTOR_PROFILE_BIO_MAX_LENGTH} caratteri.`,
      );
      return;
    }

    setErrorMessage(null);

    save.mutate(
      {
        data,
        patch: {
          // `parseOptionalText` nel payload trasforma la stringa vuota in
          // assenza di bio: niente stringa di soli spazi nel database.
          bio: form.bio.trim(),
          languages: toDelimitedString(form.languages),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "director",
            section: "bio",
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
            profileType: "director",
            section: "bio",
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
      testID="director-profile-edit-bio"
      title="Bio e lingue"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={5} testID="director-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => void profileQuery.refetch()}
          testID="director-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleSm">Bio professionale</AppText>
              <AppText color="secondary" variant="bodySm">
                Racconta in modo sintetico la tua esperienza e il tuo approccio.
              </AppText>
            </View>

            <OnboardingTextField
              errorMessage={
                isBioTooLong
                  ? `La bio può contenere al massimo ${DIRECTOR_PROFILE_BIO_MAX_LENGTH} caratteri.`
                  : undefined
              }
              /*
                Il contatore è parte del campo, quindi lo screen reader lo
                legge insieme al valore invece di lasciarlo come testo sciolto.
              */
              helperText={`${bioLength}/${DIRECTOR_PROFILE_BIO_MAX_LENGTH}`}
              maxLength={DIRECTOR_PROFILE_BIO_MAX_LENGTH}
              multiline
              onChangeText={(value) => patch({ bio: value })}
              optional
              placeholder="Racconta la tua esperienza dirigenziale, i club con cui hai lavorato e il tuo modo di lavorare."
              testID="director-bio-field"
              value={form.bio}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="titleSm">Lingue parlate</AppText>

            <OnboardingChipMultiSelect
              onChange={(values) => patch({ languages: [...values, ...other] })}
              options={AGENT_COMMON_LANGUAGE_OPTIONS}
              optional
              testID="director-languages"
              values={common}
            />

            <OnboardingMultiSelectField
              label="Altre lingue"
              onChange={(values) => patch({ languages: [...common, ...values] })}
              optional
              options={AGENT_OTHER_LANGUAGE_OPTIONS}
              placeholder="Seleziona altre lingue"
              searchable
              sheetTitle="Altre lingue"
              testID="director-other-languages"
              values={other}
            />
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[12],
  },
  sectionHeader: {
    gap: spacing[4],
  },
});
