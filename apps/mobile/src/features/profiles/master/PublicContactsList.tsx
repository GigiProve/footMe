/**
 * Contatti pubblici del Master Profile (REV-PROF-01 §30).
 *
 * Costruisce la lista a partire dai soli contatti marcati pubblici. Un
 * contatto non pubblico non arriva qui: non viene renderizzato, non finisce
 * negli analytics e non viaggia in nessun payload di questa vista.
 *
 * Il telefono resta fuori per costruzione — vive in `profile_private_contacts`
 * e il prodotto non ha una preferenza che lo renda pubblico.
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
  const websiteUrl = contacts.showWebsite
    ? normalizeUrl(contacts.website ?? "")
    : "";

  const rows: (PublicContact | null)[] = [
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
