/**
 * Contatti pubblici (REV-PROF-05 schermata 8, REV-PROF-08 schermata 6).
 *
 * Tre regole reggono tutta la schermata:
 *
 * 1. Visibilità e valore sono cose diverse. Spegnere un contatto non lo
 *    cancella: resta salvato e torna disponibile riaccendendolo.
 * 2. Un contatto senza un valore valido non si pubblica. L'interruttore resta
 *    disabilitato finché il valore non si normalizza in qualcosa di
 *    utilizzabile, invece di lasciar finire un link rotto nel profilo pubblico.
 * 3. La privacy non è solo qui. `profile_contacts` ha una RLS owner-only e i
 *    contatti che un Visitor riceve passano da `get_profile_public_contacts`,
 *    che restituisce NULL per ogni canale spento: un contatto privato non
 *    lascia il database, quindi non c'è cache, deep link o condivisione che
 *    possa esporlo.
 *
 * Il valore si modifica sul posto: non esiste un'altra schermata in cui
 * "configurare" un contatto, e un canale vuoto mostra il suo campo invece di
 * un valore finto.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { OnboardingTextField, ToggleSwitch } from "../../../onboarding/ui";
import {
  trackProfileEvent,
  type PublicContactType,
} from "../../profile-analytics";
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
import type { ProfileFormState } from "../../profile-edit-helpers";
import type { CompleteProfessionalProfile } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../ProfileEditStates";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type ChannelKey = PublicContactType;

type ContactsForm = Record<ChannelKey, string> & {
  visibility: Record<ChannelKey, boolean>;
};

type ChannelDefinition = {
  icon: keyof typeof Ionicons.glyphMap;
  invalidMessage: string;
  key: ChannelKey;
  keyboardType?: "email-address" | "phone-pad" | "url";
  label: string;
  /** Vuoto = valore non pubblicabile. Non è un errore se il campo è vuoto. */
  normalize: (value: string) => string;
  placeholder: string;
};

/** Un numero pubblicabile: almeno otto cifre, con prefisso facoltativo. */
function normalizePhoneInput(value: string): string {
  const trimmed = value.trim().replace(/[\s.\-()]/g, "");

  return /^\+?\d{8,15}$/.test(trimmed) ? value.trim() : "";
}

const CHANNELS: readonly ChannelDefinition[] = [
  {
    icon: "call-outline",
    invalidMessage: "Inserisci un numero di telefono valido.",
    key: "phone",
    keyboardType: "phone-pad",
    label: "Telefono",
    normalize: normalizePhoneInput,
    placeholder: "+39 000 000 0000",
  },
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
    icon: "logo-tiktok",
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
    normalize: (value) =>
      isWebsiteValid(value) ? normalizeWebsiteInput(value) : "",
    placeholder: "www.esempio.it",
  },
] as const;

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

type ProfilePublicContactsScreenProps = {
  data: CompleteProfessionalProfile | undefined;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onSave: (
    data: CompleteProfessionalProfile,
    patch: Partial<ProfileFormState>,
    handlers: { onError: (error: Error) => void; onSuccess: () => void },
  ) => void;
  profileType: string;
  saving: boolean;
  testIDPrefix: string;
};

export function ProfilePublicContactsScreen({
  data,
  isError,
  isPending,
  onRetry,
  onSave,
  profileType,
  saving,
  testIDPrefix,
}: ProfilePublicContactsScreenProps) {
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
        phone: contacts.showPhone ?? false,
        tiktok: contacts.showTikTok ?? false,
        website: contacts.showWebsite ?? false,
        youtube: contacts.showYouTube ?? false,
      },
      website: contacts.website ?? "",
      youtube: contacts.youtube ?? "",
    };
  }, [data]);

  const [draft, setDraft] = useState<ContactsForm | null>(null);
  const [expandedKey, setExpandedKey] = useState<ChannelKey | null>(null);
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
          section: "contacts",
        });
      }

      router.back();
    },
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

    const invalid = CHANNELS.find(
      (channel) =>
        form.visibility[channel.key] && !channel.normalize(form[channel.key]),
    );

    if (invalid) {
      setExpandedKey(invalid.key);
      setErrorMessage(invalid.invalidMessage);
      return;
    }

    setErrorMessage(null);
    onSave(
      data,
      {
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
        showContactPhone: form.visibility.phone,
        showContactTikTok: form.visibility.tiktok,
        showContactWebsite: form.visibility.website,
        showContactYouTube: form.visibility.youtube,
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType,
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
            profileType,
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
      saving={saving}
      testID={`${testIDPrefix}-profile-edit-contacts`}
      title="Contatti pubblici"
    >
      {isPending ? (
        <ProfileEditFieldsSkeleton
          rows={4}
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
          <AppText color="secondary" variant="bodySm">
            Scegli quali contatti rendere visibili. La chat PROLINK resta il
            canale principale.
          </AppText>

          <View style={styles.list}>
            {CHANNELS.map((channel) => {
              const value = form[channel.key];
              const normalized = channel.normalize(value);
              const isPublishable = normalized.length > 0;
              const isExpanded = expandedKey === channel.key;
              const showsInvalid = value.trim().length > 0 && !isPublishable;

              return (
                <View key={channel.key} style={styles.channel}>
                  <Pressable
                    accessibilityHint="Modifica il valore del contatto"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() =>
                      setExpandedKey(isExpanded ? null : channel.key)
                    }
                    style={styles.row}
                    testID={`${testIDPrefix}-contact-${channel.key}-row`}
                  >
                    <Ionicons
                      color={
                        isPublishable ? colors.accent : colors.textSecondary
                      }
                      name={channel.icon}
                      size={20}
                    />
                    <View style={styles.rowText}>
                      <AppText color="secondary" variant="meta">
                        {channel.label}
                      </AppText>
                      {/* Mai un valore finto: se non c'è, si dice che non c'è. */}
                      <AppText
                        color={value.trim() ? "primary" : "muted"}
                        numberOfLines={1}
                        variant="bodySm"
                      >
                        {value.trim() || "Non configurato"}
                      </AppText>
                    </View>

                    <ToggleSwitch
                      accessibilityLabel={`Rendi visibile ${channel.label}`}
                      disabled={!isPublishable}
                      onValueChange={(visible) => {
                        trackProfileEvent("public_contact_visibility_changed", {
                          contactType: channel.key,
                          profileType,
                          section: "contacts",
                          visible,
                        });
                        patch({
                          visibility: {
                            ...form.visibility,
                            [channel.key]: visible,
                          },
                        });
                      }}
                      testID={`${testIDPrefix}-contact-${channel.key}-visibility`}
                      value={form.visibility[channel.key]}
                    />
                  </Pressable>

                  {isExpanded ? (
                    <View style={styles.editor}>
                      <OnboardingTextField
                        autoCapitalize="none"
                        errorMessage={
                          showsInvalid ? channel.invalidMessage : undefined
                        }
                        helperText={
                          isPublishable
                            ? undefined
                            : "Inserisci un valore valido per poterlo rendere pubblico."
                        }
                        keyboardType={channel.keyboardType}
                        onChangeText={(next) =>
                          patch({
                            [channel.key]: next,
                          } as Partial<ContactsForm>)
                        }
                        placeholder={channel.placeholder}
                        testID={`${testIDPrefix}-contact-${channel.key}-input`}
                        value={value}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <AppText color="muted" variant="meta">
            I contatti non visibili restano salvati ma non vengono mostrati agli
            altri utenti, né condivisi tramite il tuo profilo pubblico.
          </AppText>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  channel: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
  editor: {
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[16],
  },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
