/**
 * Bio e lingue (REV-PROF-11 schermata 6, REV-PROF-16 schermata 6).
 *
 * Due dati facoltativi che vivono entrambi su `profiles`, non sulla tabella
 * del ruolo: la bio e le lingue sono dell'utente, non del mestiere, e questa
 * schermata non ne crea una seconda copia per ogni profilo professionale.
 *
 * Tre regole che il codice applica alla lettera:
 *
 *  - **la bio è facoltativa ma non può essere fatta di spazi.** Si salva
 *    sempre il valore ripulito ai bordi; una stringa di soli spazi diventa
 *    assenza di bio, non una bio vuota;
 *  - **nessun placeholder finisce fra i dati.** Il testo grigio del campo è
 *    un suggerimento, non un contenuto: se l'utente non scrive niente, nel
 *    profilo non compare niente;
 *  - **il limite è quello della review, non quello dell'onboarding.** Una bio
 *    storica più lunga non viene troncata in silenzio — resta leggibile, il
 *    contatore la segnala e il salvataggio chiede di accorciarla. Tagliare da
 *    soli il testo di qualcuno sarebbe una perdita di dati mascherata da
 *    validazione.
 *
 * Le lingue usano il selector già approvato negli onboarding: quelle
 * frequenti a vista, le altre dietro un campo ricercabile. Gli identificativi
 * salvati sono quelli della tassonomia condivisa, mai la sola etichetta
 * mostrata, e i duplicati non sono rappresentabili perché la selezione è un
 * insieme di valori distinti.
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
import {
  toDelimitedString,
  type ProfileFormState,
} from "../../profile-edit-helpers";
import type { CompleteProfessionalProfile } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../ProfileEditStates";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

/** REV-PROF-11 e REV-PROF-16 mostrano entrambe "…/300". */
export const PROFILE_BIO_MAX_LENGTH = 300;

type BioForm = {
  bio: string;
  languages: string[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export type ProfileBioLanguagesConfig = {
  /** Testo sotto il titolo della sezione bio. */
  bioDescription: string;
  bioPlaceholder: string;
  /** Il mockup del ruolo può chiedere almeno una lingua. */
  requireLanguage?: boolean;
  profileType: string;
  testIDPrefix: string;
};

type ProfileBioLanguagesScreenProps = {
  config: ProfileBioLanguagesConfig;
  data: CompleteProfessionalProfile | undefined;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onSave: (
    data: CompleteProfessionalProfile,
    patch: Partial<ProfileFormState>,
    handlers: { onError: (error: Error) => void; onSuccess: () => void },
  ) => void;
  saving: boolean;
};

export function ProfileBioLanguagesScreen({
  config,
  data,
  isError,
  isPending,
  onRetry,
  onSave,
  saving,
}: ProfileBioLanguagesScreenProps) {
  const {
    bioDescription,
    bioPlaceholder,
    profileType,
    requireLanguage = false,
    testIDPrefix,
  } = config;

  const initialForm = useMemo<BioForm | null>(() => {
    if (!data) {
      return null;
    }

    return {
      bio: data.profile.bio ?? "",
      // Deduplica in lettura: un elenco storico può portare due volte la
      // stessa lingua, e il selector non saprebbe quale delle due togliere.
      languages: [
        ...new Set(
          (data.profile.languages ?? [])
            .map((language) => language.trim())
            .filter(Boolean),
        ),
      ],
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
    isSaving: saving,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType,
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
  const isBioTooLong = bioLength > PROFILE_BIO_MAX_LENGTH;

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (isBioTooLong) {
      setErrorMessage(
        `La bio non può superare ${PROFILE_BIO_MAX_LENGTH} caratteri.`,
      );
      return;
    }

    if (requireLanguage && form.languages.length === 0) {
      setErrorMessage("Seleziona almeno una lingua.");
      return;
    }

    setErrorMessage(null);

    onSave(
      data,
      {
        // `parseOptionalText` nel payload trasforma la stringa vuota in
        // assenza di bio: niente stringa di soli spazi nel database.
        bio: form.bio.trim(),
        languages: toDelimitedString([...new Set(form.languages)]),
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType,
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
            profileType,
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
      saving={saving}
      testID={`${testIDPrefix}-profile-edit-bio`}
      title="Bio e lingue"
    >
      {isPending ? (
        <ProfileEditFieldsSkeleton
          rows={5}
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
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleSm">Bio professionale</AppText>
              <AppText color="secondary" variant="bodySm">
                {bioDescription}
              </AppText>
            </View>

            <OnboardingTextField
              errorMessage={
                isBioTooLong
                  ? `La bio non può superare ${PROFILE_BIO_MAX_LENGTH} caratteri.`
                  : undefined
              }
              /*
                Il contatore è parte del campo, quindi lo screen reader lo
                legge insieme al valore invece di lasciarlo come testo sciolto.
              */
              helperText={`${bioLength}/${PROFILE_BIO_MAX_LENGTH}`}
              maxLength={PROFILE_BIO_MAX_LENGTH}
              multiline
              onChangeText={(value) => patch({ bio: value })}
              optional
              placeholder={bioPlaceholder}
              testID={`${testIDPrefix}-bio-field`}
              value={form.bio}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="titleSm">Lingue parlate</AppText>

            <OnboardingChipMultiSelect
              onChange={(values) => patch({ languages: [...values, ...other] })}
              options={AGENT_COMMON_LANGUAGE_OPTIONS}
              optional={!requireLanguage}
              testID={`${testIDPrefix}-languages`}
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
              testID={`${testIDPrefix}-other-languages`}
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
