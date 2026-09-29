/**
 * Filosofia e stile di gioco (REV-PROF-05, schermata 5).
 *
 * Gli stessi quattro campi dell'onboarding Allenatore — filosofia, modulo,
 * stile, lingue — con le stesse tassonomie e lo stesso contatore a 1.000
 * caratteri. Modificare qui o in onboarding scrive negli stessi record: non
 * esiste un secondo insieme di campi.
 *
 * Il testo della filosofia non viene normalizzato: gli a capo restano quelli
 * scritti dall'Allenatore, e non si taglia mai ciò che è già salvato. Il
 * limite vive sul campo (`maxLength`) e sulla validazione, non su una
 * troncatura silenziosa.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  OnboardingChipMultiSelect,
  OnboardingSelectField,
  OnboardingTextField,
} from "../../../onboarding/ui";
import {
  COACH_FORMATION_OPTIONS,
  COACH_LANGUAGE_OPTIONS,
  COACH_PHILOSOPHY_MAX_LENGTH,
  COACH_PLAY_STYLE_OPTIONS,
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

type PhilosophyForm = {
  formation: string;
  languages: string[];
  philosophy: string;
  playStyle: string;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function CoachPhilosophyScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<PhilosophyForm | null>(() => {
    if (!data) {
      return null;
    }

    return {
      formation: data.coachProfile?.preferred_formation ?? "",
      languages: data.profile.languages ?? [],
      philosophy: data.coachProfile?.game_philosophy ?? "",
      // Lo stile dichiarato è uno: la colonna è un array per ragioni storiche.
      playStyle: data.coachProfile?.play_styles?.[0] ?? "",
    };
  }, [data]);

  const [draft, setDraft] = useState<PhilosophyForm | null>(null);
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
          section: "philosophy",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<PhilosophyForm>) => {
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
      Il campo ha già `maxLength`, ma un testo più lungo può arrivare da una
      riga salvata prima che il limite esistesse: meglio dirlo che troncarlo.
    */
    if (form.philosophy.length > COACH_PHILOSOPHY_MAX_LENGTH) {
      setErrorMessage("La filosofia di gioco non può superare 1.000 caratteri.");
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          coachProfile: {
            play_styles: form.playStyle ? [form.playStyle] : [],
            preferred_formation: form.formation || null,
          },
          gamePhilosophy: form.philosophy,
          languages: toDelimitedString(form.languages),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "coach",
            section: "philosophy",
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
            section: "philosophy",
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  const counter = form?.philosophy.length
    ? `${form.philosophy.length}/${COACH_PHILOSOPHY_MAX_LENGTH}`
    : undefined;

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saving={save.isPending}
      testID="coach-profile-edit-philosophy"
      title="Filosofia e stile di gioco"
    >
      {profileQuery.isPending ? <CoachEditFieldsSkeleton rows={4} /> : null}

      {profileQuery.isError ? (
        <CoachEditErrorState onRetry={() => void profileQuery.refetch()} />
      ) : null}

      {form ? (
        <>
          <OnboardingTextField
            helperText={counter}
            label="Filosofia di gioco"
            maxLength={COACH_PHILOSOPHY_MAX_LENGTH}
            multiline
            numberOfLines={5}
            onChangeText={(value) => patch({ philosophy: value })}
            optional
            placeholder="Descrivi il tuo approccio, la metodologia e gli obiettivi..."
            testID="coach-philosophy-field"
            value={form.philosophy}
          />

          <OnboardingSelectField
            allowClear
            label="Modulo preferito"
            onChange={(value) => patch({ formation: value })}
            optional
            options={COACH_FORMATION_OPTIONS}
            placeholder="Seleziona il modulo"
            sheetTitle="Modulo preferito"
            testID="coach-formation"
            value={form.formation}
          />

          <OnboardingSelectField
            allowClear
            label="Stile di gioco"
            onChange={(value) => patch({ playStyle: value })}
            optional
            options={COACH_PLAY_STYLE_OPTIONS}
            placeholder="Seleziona lo stile"
            sheetTitle="Stile di gioco"
            testID="coach-play-style"
            value={form.playStyle}
          />

          {/*
            L'elenco viene dalla tassonomia del prodotto, non dalle quattro
            lingue disegnate nel mockup: aggiungerne una non richiede di
            toccare questo layout.
          */}
          <View style={styles.languages}>
            <AppText variant="titleSm">Lingue</AppText>
            <OnboardingChipMultiSelect
              onChange={(values) => patch({ languages: values })}
              options={COACH_LANGUAGE_OPTIONS}
              testID="coach-languages"
              values={form.languages}
            />
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  languages: {
    gap: spacing[8],
  },
});
