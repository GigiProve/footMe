/**
 * Selezione multipla su una tassonomia canonica (REV-PROF-22, Screen 4 e 5).
 *
 * Copertura e Tipi di contenuto sono **due domini distinti** — gli ambiti
 * calcistici che una realtà racconta e i formati che produce — e restano
 * distinti: due righe nell'hub, due colonne nel database, due tassonomie.
 * Condividono però la stessa meccanica di selezione, e duplicarla due volte
 * avrebbe significato due posti in cui sbagliare la deduplicazione, l'ordine
 * o lo stato accessibile.
 *
 * Quello che questa schermata non fa, e non deve fare:
 *
 *  - non applica un massimo arbitrario. Una redazione può raccontare tutto il
 *    calcio e produrre ogni formato;
 *  - non obbliga a una selezione minima. L'onboarding non la richiede, e
 *    inventarla qui bloccherebbe chi arriva da REV-ONB-09 senza averla fatta;
 *  - non cancella i valori che la tassonomia non riconosce più. Restano
 *    elencati come da rivedere e li toglie l'utente: nessuna sostituzione
 *    automatica, nessuna mappatura indovinata;
 *  - non attribuisce capability. Selezionare "Podcast" non crea un formato
 *    Podcast, e selezionare un tipo di contenuto non accende
 *    `can_publish_article`: quelle decisioni appartengono a HOM-06.2.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { InfoMessage, SelectionRow } from "../../../onboarding/ui";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  trackProfileEvent,
  type ProfileEditSectionKey,
} from "../../profile-analytics";
import {
  normalizeMediaSelection,
  sameMediaSelection,
} from "../media-edit-rules";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  MediaProfileConflictError,
  describeMediaSaveError,
  useCompleteProfileQuery,
  useMediaSectionSave,
  type MediaSectionPatch,
} from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

const DEPRECATED_MESSAGE =
  "Questa voce non è più disponibile. Aggiorna la selezione.";

export type MediaTaxonomyScreenProps = {
  buildPatch: (values: string[]) => MediaSectionPatch;
  helperMessage?: string;
  icons: Record<string, keyof typeof Ionicons.glyphMap>;
  intro: string;
  /** Valori salvati, letti dal profilo completo. */
  readValues: (
    data: NonNullable<ReturnType<typeof useCompleteProfileQuery>["data"]>,
  ) => readonly string[] | null | undefined;
  section: ProfileEditSectionKey;
  taxonomy: readonly string[];
  testIDPrefix: string;
  title: string;
};

export function MediaTaxonomyScreen({
  buildPatch,
  helperMessage,
  icons,
  intro,
  readValues,
  section,
  taxonomy,
  testIDPrefix,
  title,
}: MediaTaxonomyScreenProps) {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useMediaSectionSave(userId);
  const data = profileQuery.data;

  const saved = normalizeMediaSelection(
    data ? readValues(data) : [],
    taxonomy,
  );
  const savedValues = [...saved.known, ...saved.deprecated];

  const [draft, setDraft] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const values = draft ?? savedValues;
  const current = normalizeMediaSelection(values, taxonomy);
  const isDirty = !sameMediaSelection(values, savedValues);

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "media",
          section,
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  function toggle(entry: string) {
    setErrorMessage(null);
    setDraft(
      values.includes(entry)
        ? values.filter((value) => value !== entry)
        : [...values, entry],
    );
  }

  function handleSave() {
    if (!data) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        /*
          L'ordine salvato è quello della tassonomia, non quello dei tocchi:
          due sessioni che scelgono le stesse voci producono lo stesso valore,
          e i duplicati non possono sopravvivere alla normalizzazione. Le voci
          non più mappabili restano in coda invece di sparire.
        */
        patch: buildPatch([...current.known, ...current.deprecated]),
      },
      {
        onError: (saveError) => {
          if (saveError instanceof MediaProfileConflictError) {
            trackProfileEvent("media_profile_edit_conflict", {
              profileType: "media",
              section,
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "media",
            section,
            success: false,
          });
          setErrorMessage(describeMediaSaveError(saveError));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "media",
            section,
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
      onSave={data ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID={`media-profile-edit-${testIDPrefix}`}
      title={title}
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={6} testID="media-edit-skeleton" />
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
            {intro}
          </AppText>

          <View style={styles.rows}>
            {taxonomy.map((entry) => (
              <SelectionRow
                key={entry}
                label={entry}
                leading={
                  <Ionicons
                    color={
                      values.includes(entry) ? colors.accent : colors.textSecondary
                    }
                    name={icons[entry] ?? "ellipse-outline"}
                    size={20}
                  />
                }
                onPress={() => toggle(entry)}
                selected={values.includes(entry)}
                testID={`${testIDPrefix}-option-${entry}`}
              />
            ))}
          </View>

          {/*
            Le voci non più in tassonomia non vengono mostrate come scelte
            valide, ma nemmeno nascoste: si dice che vanno riviste e si
            lasciano togliere.
          */}
          {current.deprecated.length > 0 ? (
            <View style={styles.rows}>
              <InfoMessage
                message={DEPRECATED_MESSAGE}
                testID={`${testIDPrefix}-deprecated`}
                tone="warning"
              />
              {current.deprecated.map((entry) => (
                <SelectionRow
                  key={entry}
                  label={entry}
                  onPress={() => toggle(entry)}
                  selected
                  testID={`${testIDPrefix}-deprecated-${entry}`}
                />
              ))}
            </View>
          ) : null}

          {helperMessage ? (
            <InfoMessage
              message={helperMessage}
              testID={`${testIDPrefix}-helper`}
            />
          ) : null}
        </View>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
  },
  rows: {
    gap: spacing[8],
  },
});
