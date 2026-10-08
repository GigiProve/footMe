/**
 * Contatti pubblici del Master Profile (REV-PROF-01 §30).
 *
 * Costruisce la lista a partire dai soli contatti marcati pubblici. Un
 * contatto non pubblico non arriva qui: non viene renderizzato, non finisce
 * negli analytics e non viaggia in nessun payload di questa vista.
 *
 * Il telefono vive in `profile_private_contacts` e resta privato per default:
 * entra in questa lista solo se il proprietario ha acceso `showPhone`
 * (REV-PROF-05). È l unico contatto la cui visibilità non sta in
 * `profile_contacts`.
 */
import { type ComponentProps } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { PublicContactType } from "../profile-analytics";
import {
  getSocialDisplayValue,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizeLinkedInInput,
} from "../profile-form-utils";
import type { UserContactsRecord } from "../profile-service";

export type PublicContact = {
  href: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  type: PublicContactType;
  value: string;
};

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Etichetta di un profilo social: "@nomeutente" sia che l'utente abbia salvato
 * l'handle sia che abbia incollato l'URL completo.
 */
function formatHandle(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const lastSegment = trimmed.split("/").pop() ?? trimmed;

  return `@${lastSegment.replace(/^@/, "")}`;
}

function normalizeHandleUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${baseUrl}${trimmed.replace(/^@/, "")}`;
}

/**
 * Un contatto salvato ma non marcato pubblico. Serve solo a dire all'Owner
 * che esiste: il valore non viene mai letto né mostrato.
 */
export function hasPrivateContacts(contacts: UserContactsRecord): boolean {
  const saved = [
    contacts.email,
    contacts.instagram,
    contacts.facebook,
    contacts.linkedin,
    contacts.tiktok,
    contacts.youtube,
    contacts.website,
  ].some((value) => Boolean(value?.trim()));

  return saved && buildPublicContacts(contacts).length === 0;
}

export function buildPublicContacts(
  contacts: UserContactsRecord,
): PublicContact[] {
  const instagramUrl = contacts.showInstagram
    ? normalizeInstagramInput(contacts.instagram)
    : "";
  const facebookUrl = contacts.showFacebook
    ? normalizeFacebookInput(contacts.facebook)
    : "";
  const email = contacts.showEmail ? normalizeContactEmail(contacts.email) : "";
  const tiktokUrl = contacts.showTikTok
    ? normalizeHandleUrl(contacts.tiktok ?? "", "https://www.tiktok.com/@")
    : "";
  const youtubeUrl = contacts.showYouTube
    ? normalizeHandleUrl(contacts.youtube ?? "", "https://www.youtube.com/@")
    : "";
  const linkedinUrl = contacts.showLinkedIn
    ? normalizeLinkedInInput(contacts.linkedin ?? "")
    : "";
  const websiteUrl = contacts.showWebsite
    ? normalizeUrl(contacts.website ?? "")
    : "";
  const phone = contacts.showPhone ? contacts.phone.trim() : "";

  const rows: (PublicContact | null)[] = [
    phone
      ? {
          href: `tel:${phone.replace(/\s+/g, "")}`,
          icon: "call-outline" as const,
          label: "Telefono",
          type: "phone" as const,
          value: phone,
        }
      : null,
    email
      ? {
          href: `mailto:${email}`,
          icon: "mail-outline" as const,
          label: "Email",
          type: "email" as const,
          value: email,
        }
      : null,
    instagramUrl
      ? {
          href: instagramUrl,
          icon: "logo-instagram" as const,
          label: "Instagram",
          type: "instagram" as const,
          value: getSocialDisplayValue("instagram", instagramUrl),
        }
      : null,
    linkedinUrl
      ? {
          href: linkedinUrl,
          icon: "logo-linkedin" as const,
          label: "LinkedIn",
          type: "linkedin" as const,
          // "/in/luca-rinaldi": il percorso dice gia di che profilo si tratta,
          // il dominio no — e il mockup mostra proprio quello.
          value: linkedinUrl.replace(/^https?:\/\/(?:www\.)?linkedin\.com/i, ""),
        }
      : null,
    tiktokUrl
      ? {
          href: tiktokUrl,
          icon: "logo-tiktok" as const,
          label: "TikTok",
          type: "tiktok" as const,
          value: formatHandle(contacts.tiktok ?? ""),
        }
      : null,
    facebookUrl
      ? {
          href: facebookUrl,
          icon: "logo-facebook" as const,
          label: "Facebook",
          type: "facebook" as const,
          value: getSocialDisplayValue("facebook", facebookUrl),
        }
      : null,
    youtubeUrl
      ? {
          href: youtubeUrl,
          icon: "logo-youtube" as const,
          label: "YouTube",
          type: "youtube" as const,
          value: formatHandle(contacts.youtube ?? ""),
        }
      : null,
    websiteUrl
      ? {
          href: websiteUrl,
          icon: "globe-outline" as const,
          label: "Sito web",
          type: "website" as const,
          value: websiteUrl.replace(/^https?:\/\//i, ""),
        }
      : null,
  ];

  return rows.filter((contact): contact is PublicContact => contact !== null);
}

type PublicContactsListProps = {
  contacts: readonly PublicContact[];
  onContactPress?: (contact: PublicContact) => void;
};

export function PublicContactsList({
  contacts,
  onContactPress,
}: PublicContactsListProps) {
  if (contacts.length === 0) {
    return null;
  }

  return (
    <View>
      {contacts.map((contact, index) => (
        <Pressable
          accessibilityLabel={`${contact.label}, ${contact.value}`}
          accessibilityRole="link"
          key={contact.type}
          onPress={() => {
            onContactPress?.(contact);
            void Linking.openURL(contact.href).catch(() => undefined);
          }}
          style={({ pressed }) => [
            styles.row,
            index > 0 ? styles.rowDivided : null,
            pressed ? styles.rowPressed : null,
          ]}
        >
          <Ionicons color={colors.accent} name={contact.icon} size={19} />
          <AppText numberOfLines={1} style={styles.value} variant="bodyLg">
            {contact.value}
          </AppText>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingVertical: spacing[8],
  },
  rowDivided: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.6,
  },
  value: {
    flex: 1,
    minWidth: 0,
  },
});
