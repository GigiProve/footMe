/**
 * Presentazione (REV-PROF-22, Screen 3).
 *
 * Un campo solo, e tre regole che valgono più del campo:
 *
 *  - il limite è quello canonico del repository, condiviso con l'onboarding
 *    (REV-ONB-09) e con il backend. Il mockup ne mostra 300: è un esempio
 *    visuale, e adottarlo qui creerebbe due soglie diverse per lo stesso
 *    testo — con l'effetto di troncare descrizioni già scritte altrove;
 *  - il troncamento avviene mentre si scrive, non al salvataggio: un testo
 *    incollato più lungo si ferma subito invece di essere rifiutato dopo;
 *  - il testo viene sanificato — niente markup, niente script — ma gli a capo
 *    legittimi restano: è una presentazione editoriale, non una riga di
 *    tabella.
 *
 * Alimenta il campo canonico `media_profiles.short_description`, che è la
 * stessa sorgente dell'header e della tab Info di REV-PROF-21. Non esiste una
 * seconda descrizione breve da tenere allineata, e il contenuto non entra né
 * negli eventi né nei messaggi di errore.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { InfoMessage, OnboardingTextField } from "../../../onboarding/ui";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { trackProfileEvent } from "../../profile-analytics";
import {
  MEDIA_DESCRIPTION_MAX_LENGTH,
  sanitizeMediaDescription,
  validateMediaDescription,
} from "../media-edit-rules";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  MediaProfileConflictError,
  describeMediaSaveError,
  useCompleteProfileQuery,
  useMediaSectionSave,
} from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

export function MediaPresentationScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useMediaSectionSave(userId);
  const data = profileQuery.data;

  const initialValue = useMemo(
    () => (data ? (data.mediaProfile?.short_description ?? "") : null),
    [data],
  );

  const [draft, setDraft] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const value = draft ?? initialValue;

  const isDirty = Boolean(
    value !== null && initialValue !== null && value !== initialValue,
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "media",
          section: "presentation",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  const patch = useCallback((next: string) => {
    setErrorMessage(null);
    setDraft(next.slice(0, MEDIA_DESCRIPTION_MAX_LENGTH));
  }, []);

  function handleSave() {
    if (!data || value === null) {
      return;
    }

    const error = validateMediaDescription(value);

    if (error) {
      setErrorMessage(error);
      return;
    }

    const sanitized = sanitizeMediaDescription(value);

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          kind: "presentation",
          // Una descrizione svuotata è un'assenza, non una stringa vuota: il
          // Master Profile non deve mostrare un paragrafo di niente.
          value: { short_description: sanitized || null },
        },
      },
      {
        onError: (saveError) => {
          if (saveError instanceof MediaProfileConflictError) {
            trackProfileEvent("media_profile_edit_conflict", {
              profileType: "media",
              section: "presentation",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "media",
            section: "presentation",
            success: false,
          });
          setErrorMessage(describeMediaSaveError(saveError));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "media",
            section: "presentation",
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
      onSave={value !== null ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="media-profile-edit-presentation"
      title="Presentazione"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={3} testID="media-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={MEDIA_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="media-edit-error"
        />
      ) : null}

      {value !== null ? (
        <>
          <AppText color="secondary" variant="bodySm">
            Descrivi in modo chiaro la tua realtà editoriale.
          </AppText>

          <View style={styles.block}>
            <AppText variant="eyebrow">Descrizione pubblica</AppText>

            <OnboardingTextField
              maxLength={MEDIA_DESCRIPTION_MAX_LENGTH}
              multiline
              numberOfLines={8}
              onChangeText={patch}
              optional
              placeholder="Racconta che cosa pubblichi e per chi"
              testID="media-presentation-input"
              value={value}
            />

            <AppText
              accessibilityLabel={`${value.length} caratteri su ${MEDIA_DESCRIPTION_MAX_LENGTH}`}
              color="muted"
              style={styles.counter}
              variant="meta"
            >
              {`${value.length}/${MEDIA_DESCRIPTION_MAX_LENGTH}`}
            </AppText>
          </View>

          <InfoMessage
            message="La descrizione appare nell'header e nella tab Info."
            testID="media-presentation-hint"
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
  },
  counter: {
    textAlign: "right",
  },
});
