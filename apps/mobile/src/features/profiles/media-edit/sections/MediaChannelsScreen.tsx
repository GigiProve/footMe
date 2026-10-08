/**
 * Canali ufficiali (REV-PROF-22, Screen 7).
 *
 * I cinque canali di REV-ONB-09 — sito, Instagram, YouTube, TikTok, Facebook
 * — e nessun altro. Email e telefono dell'account non sono canali editoriali
 * e non compaiono qui: aggiungerli significherebbe pubblicare un recapito
 * privato.
 *
 * Tre regole reggono la schermata:
 *
 * 1. Visibilità e valore sono cose diverse. Spegnere un canale non lo
 *    cancella: resta salvato, resta visibile all'owner e torna pubblico
 *    riaccendendolo. Spegnerlo non scollega nessun account esterno e non
 *    tocca i contenuti già pubblicati.
 * 2. Un canale senza un valore valido non può essere pubblico. Un canale
 *    vuoto non mostra nemmeno un interruttore: mostra "Aggiungi canale",
 *    perché una visibilità senza un valore è un interruttore orfano.
 * 3. La protezione non è qui. `profile_contacts` ha una RLS owner-only e
 *    quello che un Visitor riceve passa da `get_profile_public_contacts`,
 *    che restituisce NULL per ogni canale spento: un canale privato non
 *    lascia il database.
 *
 * Il sito salvato qui è lo stesso che alimenta la CTA "Visita sito" di
 * REV-PROF-21: la RPC lo legge da questa riga, quindi non esistono due
 * indirizzi da tenere allineati.
 */
import { useCallback, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, radius } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import type { MediaChannelKey } from "../../../onboarding/community/media-channels";
import { InfoMessage } from "../../../onboarding/ui";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import { PublicContactChannelRow } from "../../edit/sections/PublicContactChannelRow";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { normalizeExternalUrl } from "../../media/media-master-profile";
import { trackProfileEvent } from "../../profile-analytics";
import {
  MEDIA_CHANNELS,
  buildMediaChannelPatch,
  findUnpublishableMediaChannel,
  normalizeMediaChannelValue,
  type MediaChannelForm,
} from "../media-edit-rules";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  describeMediaSaveError,
  readMediaChannelForm,
  useCompleteProfileQuery,
  useMediaSectionSave,
} from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

export function MediaChannelsScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useMediaSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<MediaChannelForm | null>(
    () => (data ? readMediaChannelForm(data) : null),
    [data],
  );

  const [draft, setDraft] = useState<MediaChannelForm | null>(null);
  const [expandedKey, setExpandedKey] = useState<MediaChannelKey | null>(null);
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
          profileType: "media",
          section: "channels",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  const patch = useCallback(
    (changes: Partial<MediaChannelForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  function handleChangeValue(key: MediaChannelKey, next: string) {
    const previous = form?.[key].trim() ?? "";
    const wasEmpty = previous.length === 0;
    const isEmpty = next.trim().length === 0;

    if (wasEmpty && !isEmpty) {
      trackProfileEvent("media_channel_added", {
        channelType: key,
        profileType: "media",
        section: "channels",
      });
    }

    if (!wasEmpty && isEmpty) {
      trackProfileEvent("media_channel_removed", {
        channelType: key,
        profileType: "media",
        section: "channels",
      });
    }

    patch({
      [key]: next,
      /*
        Un valore rimosso porta via la sua visibilità nello stesso gesto: un
        interruttore acceso su un campo vuoto non è uno stato che l'utente
        debba vedere, nemmeno per un istante.
      */
      ...(isEmpty && form
        ? { visibility: { ...form.visibility, [key]: false } }
        : {}),
    } as Partial<MediaChannelForm>);
  }

  function handleSave() {
    if (!data || !form) {
      return;
    }

    const invalid = findUnpublishableMediaChannel(form);

    if (invalid) {
      setExpandedKey(invalid.key);
      setErrorMessage(invalid.invalidMessage);
      return;
    }

    const { values, visibility } = buildMediaChannelPatch(form);

    setErrorMessage(null);
    save.mutate(
      { data, patch: { kind: "channels", values, visibility } },
      {
        onError: (saveError) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "media",
            section: "channels",
            success: false,
          });
          setErrorMessage(describeMediaSaveError(saveError));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "media",
            section: "channels",
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
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="media-profile-edit-channels"
      title="Canali ufficiali"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={5} testID="media-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={MEDIA_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="media-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <AppText color="secondary" variant="bodySm">
            Aggiungi i canali da mostrare nel profilo.
          </AppText>

          <View style={styles.list}>
            {MEDIA_CHANNELS.map((channel) => {
              const normalized = normalizeMediaChannelValue(
                channel.key,
                form[channel.key],
              );
              const openable = normalizeExternalUrl(normalized);

              return (
                <PublicContactChannelRow
                  emptyActionLabel="Aggiungi canale"
                  expanded={expandedKey === channel.key}
                  icon={channel.icon}
                  invalidMessage={channel.invalidMessage}
                  key={channel.key}
                  keyboardType={channel.key === "website" ? "url" : undefined}
                  label={channel.label}
                  normalize={(value) =>
                    normalizeMediaChannelValue(channel.key, value)
                  }
                  onChangeValue={(next) =>
                    handleChangeValue(channel.key, next)
                  }
                  /*
                    L'anteprima apre il canale soltanto quando l'URL si
                    normalizza in qualcosa di sicuro: la stessa regola che il
                    Master Profile applica prima di rendere una riga
                    premibile.
                  */
                  onOpenValue={
                    openable
                      ? () => {
                          trackProfileEvent("media_channel_tapped", {
                            channelType: channel.key,
                            profileType: "media",
                            section: "channels",
                          });
                          void Linking.openURL(openable);
                        }
                      : undefined
                  }
                  onToggleExpanded={() =>
                    setExpandedKey(
                      expandedKey === channel.key ? null : channel.key,
                    )
                  }
                  onVisibilityChange={(visible) => {
                    trackProfileEvent("media_channel_visibility_changed", {
                      channelType: channel.key,
                      profileType: "media",
                      section: "channels",
                      visible,
                    });
                    patch({
                      visibility: { ...form.visibility, [channel.key]: visible },
                    });
                  }}
                  placeholder={channel.placeholder}
                  testID={`media-channel-${channel.key}`}
                  value={form[channel.key]}
                  visible={form.visibility[channel.key]}
                />
              );
            })}
          </View>

          <InfoMessage
            message="Sono pubblici solo i canali attivati."
            testID="media-channels-hint"
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
});
