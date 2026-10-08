/**
 * Descrizione (REV-PROF-18, schermata 5).
 *
 * Un campo solo, e tre regole che valgono più del campo:
 *
 *  - il limite è 500 caratteri e si applica mentre si scrive, non al
 *    salvataggio: un testo incollato più lungo viene troncato subito invece
 *    di essere rifiutato dopo;
 *  - il testo viene sanificato — niente markup, niente script — ma gli a capo
 *    legittimi restano: è una presentazione, non una riga di tabella;
 *  - il contenuto non entra né negli eventi né nei messaggi di errore.
 *
 * Alimenta il campo canonico della tab Info del Master Profile. Non esiste
 * una seconda descrizione breve da tenere allineata.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { InfoMessage, OnboardingTextField } from "../../../onboarding/ui";
import { ProfileEditScaffold } from "../../../profiles/edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import {
  SOCIETY_DESCRIPTION_MAX_LENGTH,
  sanitizeSocietyDescription,
  validateSocietyDescription,
} from "../society-edit-rules";
import { useSocietySectionEditor } from "./use-society-section-editor";

export function SocietyDescriptionScreen() {
  const editor = useSocietySectionEditor("description");
  const club = editor.club;

  const initialValue = useMemo(
    () => (club ? club.description ?? "" : null),
    [club],
  );

  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? initialValue;

  const isDirty = Boolean(
    value !== null && initialValue !== null && value !== initialValue,
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: editor.saving,
    onLeave: () => {
      editor.trackUnsavedExit(isDirty);
      router.back();
    },
  });

  const patch = useCallback(
    (next: string) => {
      editor.clearError();
      // Il troncamento vive qui e non nel salvataggio: l'utente vede subito
      // dove finisce il testo che potrà pubblicare.
      setDraft(next.slice(0, SOCIETY_DESCRIPTION_MAX_LENGTH));
    },
    [editor],
  );

  function handleSave() {
    if (value === null) {
      return;
    }

    const error = validateSocietyDescription(value);

    if (error) {
      editor.setErrorMessage(error);
      return;
    }

    editor.save(
      { description: sanitizeSocietyDescription(value) },
      () => setDraft(null),
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={editor.errorMessage}
      onBack={handleBack}
      onSave={value !== null ? handleSave : undefined}
      onSecondary={editor.hasConflict ? editor.reload : undefined}
      saveDisabled={!isDirty}
      saving={editor.saving}
      secondaryLabel={editor.hasConflict ? "Ricarica" : undefined}
      testID="society-profile-edit-description"
      title="Descrizione"
    >
      {editor.isPending ? (
        <ProfileEditFieldsSkeleton rows={2} testID="society-edit-skeleton" />
      ) : null}

      {editor.isError ? (
        <ProfileEditErrorState
          onRetry={editor.reload}
          testID="society-edit-error"
        />
      ) : null}

      {value !== null ? (
        <>
          <View style={styles.block}>
            <AppText variant="titleSm">Descrizione del club</AppText>
            <AppText color="secondary" variant="bodySm">
              Racconta la storia, l'identità e i valori del club.
            </AppText>

            <OnboardingTextField
              maxLength={SOCIETY_DESCRIPTION_MAX_LENGTH}
              multiline
              numberOfLines={8}
              onChangeText={patch}
              optional
              placeholder="Presenta il club in poche righe"
              testID="society-description-input"
              value={value}
            />

            <AppText
              accessibilityLabel={`${value.length} caratteri su ${SOCIETY_DESCRIPTION_MAX_LENGTH}`}
              color="muted"
              style={styles.counter}
              variant="meta"
            >
              {`${value.length}/${SOCIETY_DESCRIPTION_MAX_LENGTH}`}
            </AppText>
          </View>

          <InfoMessage message="Questa descrizione sarà visibile nella tab Info." />
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
