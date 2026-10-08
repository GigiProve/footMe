/**
 * Contatti pubblici della Società (REV-PROF-18, schermata 6).
 *
 * Stessa forma dei Contatti pubblici delle persone — riga con icona, nome del
 * canale, valore, interruttore, e il valore che si modifica sul posto — ma su
 * un dato diverso: questi sono i recapiti del club, non quelli di chi lo
 * amministra.
 *
 * La distinzione non è una convenzione di schermata, è nel modello: l'email
 * di login dell'owner e il suo numero personale vivono su `profiles` e
 * `profile_private_contacts`, e da qui non sono nemmeno raggiungibili. Niente
 * viene precompilato con i dati del referente.
 *
 * Tre regole, le stesse del modulo persona:
 *
 * 1. visibilità e valore sono cose diverse: spegnere un contatto non lo
 *    cancella, resta salvato e torna disponibile riaccendendolo;
 * 2. un contatto senza valore valido non si pubblica, e l'interruttore resta
 *    disabilitato finché non lo diventa;
 * 3. la privacy non la applica il client: `fetch_society_master_profile`
 *    restituisce `null` per ogni canale spento, quindi un recapito privato
 *    non lascia il database e nessuna cache o condivisione può esporlo.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { trackProfileEvent } from "../../../profiles/profile-analytics";
import { PublicContactChannelRow } from "../../../profiles/edit/sections/PublicContactChannelRow";
import { ProfileEditScaffold } from "../../../profiles/edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import {
  findInvalidVisibleContact,
  SOCIETY_CONTACT_INVALID_MESSAGES,
  SOCIETY_CONTACT_NORMALIZERS,
  type SocietyContactKey,
  type SocietyContactsDraft,
} from "../society-edit-rules";
import { buildContactsDraftFromClub } from "../society-hub-summaries";
import { useSocietySectionEditor } from "./use-society-section-editor";

type ChannelDefinition = {
  icon: keyof typeof Ionicons.glyphMap;
  key: SocietyContactKey;
  keyboardType?: "email-address" | "phone-pad" | "url";
  label: string;
  placeholder: string;
};

/**
 * I quattro canali del mockup, più Facebook: sono i cinque che il Master
 * Profile Società sa mostrare. TikTok e YouTube esistono sulla riga `clubs`
 * ma nessuna superficie li pubblica, quindi un interruttore qui non
 * cambierebbe niente per il visitatore — e i loro valori restano intatti,
 * perché questo editor non li scrive.
 */
const CHANNELS: readonly ChannelDefinition[] = [
  {
    icon: "mail-outline",
    key: "email",
    keyboardType: "email-address",
    label: "Email",
    placeholder: "info@club.it",
  },
  {
    icon: "call-outline",
    key: "phone",
    keyboardType: "phone-pad",
    label: "Telefono",
    placeholder: "+39 000 000 0000",
  },
  {
    icon: "globe-outline",
    key: "website",
    keyboardType: "url",
    label: "Sito web",
    placeholder: "www.club.it",
  },
  {
    icon: "logo-instagram",
    key: "instagram",
    label: "Instagram",
    placeholder: "@username",
  },
  {
    icon: "logo-facebook",
    key: "facebook",
    label: "Facebook",
    placeholder: "username",
  },
] as const;

export function SocietyPublicContactsScreen() {
  const editor = useSocietySectionEditor("contacts");
  const club = editor.club;

  const initialForm = useMemo<SocietyContactsDraft | null>(
    () => (club ? buildContactsDraftFromClub(club) : null),
    [club],
  );

  const [draft, setDraft] = useState<SocietyContactsDraft | null>(null);
  const [expandedKey, setExpandedKey] = useState<SocietyContactKey | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
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
    (changes: Partial<SocietyContactsDraft>) => {
      editor.clearError();
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [editor, initialForm],
  );

  function handleSave() {
    if (!form) {
      return;
    }

    const invalid = findInvalidVisibleContact(form);

    if (invalid) {
      setExpandedKey(invalid);
      editor.setErrorMessage(SOCIETY_CONTACT_INVALID_MESSAGES[invalid]);
      return;
    }

    editor.save(
      {
        club_email: form.values.email,
        club_phone: form.values.phone,
        facebook: form.values.facebook,
        instagram: form.values.instagram,
        show_club_email: form.visibility.email,
        show_club_phone: form.visibility.phone,
        show_facebook: form.visibility.facebook,
        show_instagram: form.visibility.instagram,
        show_website: form.visibility.website,
        website_url: form.values.website,
      },
      () => setDraft(null),
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={editor.errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      onSecondary={editor.hasConflict ? editor.reload : undefined}
      saveDisabled={!isDirty}
      saving={editor.saving}
      secondaryLabel={editor.hasConflict ? "Ricarica" : undefined}
      testID="society-profile-edit-contacts"
      title="Contatti pubblici"
    >
      {editor.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="society-edit-skeleton" />
      ) : null}

      {editor.isError ? (
        <ProfileEditErrorState
          onRetry={editor.reload}
          testID="society-edit-error"
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
              const value = form.values[channel.key] ?? "";

              return (
                <PublicContactChannelRow
                  expanded={expandedKey === channel.key}
                  icon={channel.icon}
                  invalidMessage={SOCIETY_CONTACT_INVALID_MESSAGES[channel.key]}
                  key={channel.key}
                  keyboardType={channel.keyboardType}
                  label={channel.label}
                  normalize={SOCIETY_CONTACT_NORMALIZERS[channel.key]}
                  onChangeValue={(next) =>
                    patch({ values: { ...form.values, [channel.key]: next } })
                  }
                  onToggleExpanded={() =>
                    setExpandedKey(
                      expandedKey === channel.key ? null : channel.key,
                    )
                  }
                  onVisibilityChange={(visible) => {
                    trackProfileEvent("public_contact_visibility_changed", {
                      contactType: channel.key,
                      profileType: "society",
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
                  placeholder={channel.placeholder}
                  testID={`society-contact-${channel.key}`}
                  value={value}
                  visible={form.visibility[channel.key] ?? false}
                />
              );
            })}
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  /* Un modulo solo con le righe separate da hairline, come nel mockup. */
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
});
