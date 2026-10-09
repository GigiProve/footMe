/**
 * Contatti pubblici (§N).
 *
 * Due regole guidano tutta la schermata:
 *
 * 1. Visibilità e valore sono cose diverse. Spegnere un contatto non lo
 *    cancella: resta salvato e torna disponibile riaccendendolo.
 * 2. Un contatto incompleto o non valido non si pubblica. Finché il valore non
 *    è valido l'interruttore resta disabilitato, invece di lasciar salvare un
 *    link rotto nel profilo pubblico.
 *
 * Il telefono NON è un canale pubblico in questo prodotto: vive in
 * `profile_private_contacts` e non ha un flag `show_phone`. Renderlo
 * pubblicabile richiederebbe una colonna nuova e una decisione di privacy che
 * non appartiene a questa schermata, quindi qui è dichiarato privato.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { OnboardingTextField, ToggleRow } from "../../../onboarding/ui";
import { trackProfileEvent, type PublicContactType } from "../../profile-analytics";
import {
  isEmailValid,
  isWebsiteValid,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizeTikTokInput,
  normalizeWebsiteInput,
  normalizeYouTubeInput,
} from "../../profile-form-utils";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import { ProfileEditFieldsSkeleton } from "../ProfileEditStates";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type ChannelKey =
  | "email"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "website";

type ContactsForm = Record<ChannelKey, string> & {
  phone: string;
  visibility: Record<ChannelKey, boolean>;
};

type ChannelDefinition = {
  icon: keyof typeof Ionicons.glyphMap;
  invalidMessage: string;
  key: ChannelKey;
  keyboardType?: "email-address" | "url";
  label: string;
  /** Vuoto = valore non pubblicabile. Non solleva errore se il campo è vuoto. */
  normalize: (value: string) => string;
  placeholder: string;
};

const CHANNELS: readonly ChannelDefinition[] = [
  {
    icon: "mail-outline",
    invalidMessage: "Inserisci un indirizzo email valido.",
    key: "email",
    keyboardType: "email-address",
    label: "Email",
    normalize: (value) =>
      isEmailValid(value) ? normalizeContactEmail(value) : "",
    placeholder: "nome@esempio.it",
  },
  {
    icon: "logo-instagram",
    invalidMessage: "Inserisci un username o un link Instagram valido.",
    key: "instagram",
    label: "Instagram",
    normalize: normalizeInstagramInput,
    placeholder: "@username",
  },
  {
    icon: "musical-notes-outline",
    invalidMessage: "Inserisci un username o un link TikTok valido.",
    key: "tiktok",
    label: "TikTok",
    normalize: normalizeTikTokInput,
    placeholder: "@username",
  },
  {
    icon: "logo-facebook",
    invalidMessage: "Inserisci un username o un link Facebook valido.",
    key: "facebook",
    label: "Facebook",
    normalize: normalizeFacebookInput,
    placeholder: "username",
  },
  {
    icon: "logo-youtube",
    invalidMessage: "Inserisci un canale o un link YouTube valido.",
    key: "youtube",
    label: "YouTube",
    normalize: normalizeYouTubeInput,
    placeholder: "@canale",
  },
  {
    icon: "globe-outline",
    invalidMessage: "Inserisci un indirizzo web valido.",
    key: "website",
    keyboardType: "url",
    label: "Sito web",
    normalize: (value) => (isWebsiteValid(value) ? normalizeWebsiteInput(value) : ""),
    placeholder: "www.esempio.it",
  },
] as const;

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function PublicContactsScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<ContactsForm | null>(() => {
    if (!data) {
      return null;
    }

    const contacts = data.userContacts;

    return {
      email: contacts.email ?? "",
      facebook: contacts.facebook ?? "",
      instagram: contacts.instagram ?? "",
      phone: contacts.phone ?? "",
      tiktok: contacts.tiktok ?? "",
      visibility: {
        email: contacts.showEmail,
        facebook: contacts.showFacebook,
        instagram: contacts.showInstagram,
        tiktok: contacts.showTikTok ?? false,
        website: contacts.showWebsite ?? false,
        youtube: contacts.showYouTube ?? false,
      },
      website: contacts.website ?? "",
      youtube: contacts.youtube ?? "",
    };
  }, [data]);

  const [draft, setDraft] = useState<ContactsForm | null>(null);
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
    (changes: Partial<ContactsForm>) => {
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
      Un canale può essere pubblico solo se il suo valore si normalizza in
      qualcosa di utilizzabile: altrimenti pubblicheremmo un contatto che non
      porta da nessuna parte.
    */
    const invalid = CHANNELS.find(
      (channel) =>
        form.visibility[channel.key] && !channel.normalize(form[channel.key]),
    );

    if (invalid) {
      setErrorMessage(invalid.invalidMessage);
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          // L'email pubblica non tocca le credenziali di accesso: la scrittura
          // arriva solo a `profile_contacts`.
          contactEmail: form.email,
          contactFacebook: form.facebook,
          contactInstagram: form.instagram,
          contactPhone: form.phone,
          contactTikTok: form.tiktok,
          contactWebsite: form.website,
          contactYouTube: form.youtube,
          showContactEmail: form.visibility.email,
          showContactFacebook: form.visibility.facebook,
          showContactInstagram: form.visibility.instagram,
          showContactTikTok: form.visibility.tiktok,
          showContactWebsite: form.visibility.website,
          showContactYouTube: form.visibility.youtube,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
            section: "contacts",
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
            section: "contacts",
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
      testID="profile-edit-contacts"
      title="Contatti pubblici"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton />
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
          <AppText color="secondary" variant="bodySm">
            Scegli quali contatti rendere visibili. La chat PROLINK resta il
            canale principale.
          </AppText>

          {CHANNELS.map((channel) => {
            const value = form[channel.key];
            const normalized = channel.normalize(value);
            const isPublishable = normalized.length > 0;
            const showsInvalid = value.trim().length > 0 && !isPublishable;

            return (
              <View key={channel.key} style={styles.channel}>
                <View style={styles.channelHeader}>
                  <Ionicons
                    color={colors.textSecondary}
                    name={channel.icon}
                    size={18}
                  />
                  <AppText style={styles.channelLabel} variant="titleSm">
                    {channel.label}
                  </AppText>
                </View>

                <OnboardingTextField
                  autoCapitalize="none"
                  errorMessage={showsInvalid ? channel.invalidMessage : undefined}
                  keyboardType={channel.keyboardType}
                  onChangeText={(next) =>
                    patch({ [channel.key]: next } as Partial<ContactsForm>)
                  }
                  placeholder={channel.placeholder}
                  testID={`contact-${channel.key}-input`}
                  value={value}
                />

                <ToggleRow
                  description={
                    isPublishable
                      ? undefined
                      : "Inserisci un valore valido per poterlo rendere pubblico."
                  }
                  disabled={!isPublishable}
                  label="Visibile nel profilo"
                  onValueChange={(visible) => {
                    trackProfileEvent("public_contact_visibility_changed", {
                      contactType: channel.key as PublicContactType,
                      profileType: "player",
                      section: "contacts",
                      visible,
                    });
                    patch({
                      visibility: { ...form.visibility, [channel.key]: visible },
                    });
                  }}
                  testID={`contact-${channel.key}-visibility`}
                  value={form.visibility[channel.key]}
                />
              </View>
            );
          })}

          <View style={styles.channel}>
            <View style={styles.channelHeader}>
              <Ionicons
                color={colors.textSecondary}
                name="call-outline"
                size={18}
              />
              <AppText style={styles.channelLabel} variant="titleSm">
                Telefono
              </AppText>
            </View>
            <OnboardingTextField
              keyboardType="phone-pad"
              onChangeText={(next) => patch({ phone: next })}
              placeholder="+39 000 000 0000"
              testID="contact-phone-input"
              value={form.phone}
            />
            <AppText color="muted" variant="meta">
              Il telefono resta privato e non viene mostrato nel profilo.
            </AppText>
          </View>

          <AppText color="secondary" variant="bodySm">
            I contatti non pubblici non saranno visibili agli altri utenti.
          </AppText>
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
  channel: {
    gap: spacing[8],
    padding: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[16],
  },
  channelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
  },
  channelLabel: {
    flex: 1,
  },
});
