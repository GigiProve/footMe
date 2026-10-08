/**
 * Tab Info del Master Profile Società (REV-PROF-17 §"TAB 4").
 *
 * Raccoglie ciò che è istituzionale e descrittivo, e che per questo non deve
 * appesantire la tab Profilo. Al visitor le righe senza valore non compaiono:
 * non esiste "Da completare" su un profilo che si sta guardando, e un campo
 * mancante si compila dalla Modifica profilo, non da qui.
 */
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, EmptyState } from "../../../ui";
import {
  ProfileFactRow,
  ProfileSectionError,
} from "../../profiles/master/ProfileSectionBlock";
import type { PublicContactType } from "../../profiles/profile-analytics";
import { buildVenueRows, parseClubColors } from "./society-profile-model";
import type { SocietyClub } from "./society-profile-types";

const DESCRIPTION_PREVIEW_LENGTH = 320;

type SocietyInfoTabProps = {
  club: SocietyClub;
  hasError?: boolean;
  onContactPress?: (type: PublicContactType) => void;
  onRetry?: () => void;
};

type ContactRow = {
  href: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  type: PublicContactType;
  value: string;
};

export function SocietyInfoTab({
  club,
  hasError = false,
  onContactPress,
  onRetry,
}: SocietyInfoTabProps) {
  const [isDescriptionExpanded, setDescriptionExpanded] = useState(false);

  if (hasError) {
    return (
      <View style={styles.section}>
        <ProfileSectionError
          message="Non è stato possibile caricare le informazioni. Riprova."
          onRetry={onRetry}
          testID="society-info-error"
        />
      </View>
    );
  }

  const colorNames = parseClubColors(club.clubColors);
  const venueRows = buildVenueRows(club);
  const contacts = buildClubContacts(club);
  const description = club.description?.trim() ?? "";

  const clubFacts: { label: string; value: string }[] = [
    club.name.trim()
      ? { label: "Denominazione", value: club.name.trim() }
      : null,
    club.foundingYear
      ? { label: "Anno di fondazione", value: String(club.foundingYear) }
      : null,
    colorNames.length > 0
      ? { label: "Colori sociali", value: colorNames.join(" · ") }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const isEmpty =
    clubFacts.length === 0 &&
    venueRows.length === 0 &&
    !description &&
    contacts.length === 0;

  if (isEmpty) {
    return (
      <View style={styles.section} testID="society-info-empty">
        <EmptyState
          description="Il club non ha ancora pubblicato informazioni aggiuntive."
          icon="information-circle-outline"
          title="Informazioni non disponibili"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="society-info-tab">
      {clubFacts.length > 0 ? (
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="titleMd">
            Informazioni del club
          </AppText>
          <View>
            {clubFacts.map((fact, index) => (
              <ProfileFactRow
                isLast={index === clubFacts.length - 1}
                key={fact.label}
                label={fact.label}
                value={fact.value}
              />
            ))}
          </View>
        </View>
      ) : null}

      {venueRows.length > 0 ? (
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="titleMd">
            Sede e impianto
          </AppText>
          <View>
            {venueRows.map((row, index) => (
              <ProfileFactRow
                isLast={index === venueRows.length - 1}
                key={row.label}
                label={row.label}
                value={row.value}
              />
            ))}
          </View>
        </View>
      ) : null}

      {description ? (
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="titleMd">
            Descrizione
          </AppText>
          {/*
            Testo semplice: nessun markup viene interpretato, le interruzioni
            di riga salvate dall'owner restano come le ha scritte.
          */}
          <AppText color="secondary" variant="bodySm">
            {isDescriptionExpanded || description.length <= DESCRIPTION_PREVIEW_LENGTH
              ? description
              : `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}…`}
          </AppText>
          {description.length > DESCRIPTION_PREVIEW_LENGTH ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setDescriptionExpanded((value) => !value)}
              style={styles.moreButton}
            >
              <AppText color="accent" variant="metaStrong">
                {isDescriptionExpanded ? "Mostra meno" : "Mostra altro"}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {contacts.length > 0 ? (
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="titleMd">
            Contatti pubblici
          </AppText>
          <View>
            {contacts.map((contact, index) => (
              <Pressable
                accessibilityLabel={`${contact.label}, ${contact.value}`}
                accessibilityRole="link"
                key={contact.type}
                onPress={() => {
                  onContactPress?.(contact.type);
                  void Linking.openURL(contact.href).catch(() => undefined);
                }}
                style={({ pressed }) => [
                  styles.contactRow,
                  index > 0 ? styles.contactRowDivided : null,
                  pressed ? styles.contactRowPressed : null,
                ]}
                testID={`society-contact-${contact.type}`}
              >
                <Ionicons color={colors.accent} name={contact.icon} size={19} />
                <AppText numberOfLines={1} style={styles.contactValue} variant="bodyLg">
                  {contact.value}
                </AppText>
                <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Solo i canali che hanno un valore valido. I recapiti dell'amministratore
 * non arrivano in questo payload, quindi non esiste il caso in cui vadano
 * filtrati qui.
 */
function buildClubContacts(club: SocietyClub): ContactRow[] {
  const rows: (ContactRow | null)[] = [
    club.clubEmail?.trim()
      ? {
          href: `mailto:${club.clubEmail.trim()}`,
          icon: "mail-outline" as const,
          label: "Email",
          type: "email" as const,
          value: club.clubEmail.trim(),
        }
      : null,
    club.clubPhone?.trim()
      ? {
          href: `tel:${club.clubPhone.replace(/\s+/g, "")}`,
          icon: "call-outline" as const,
          label: "Telefono",
          type: "phone" as const,
          value: club.clubPhone.trim(),
        }
      : null,
    club.websiteUrl?.trim()
      ? {
          href: normalizeUrl(club.websiteUrl),
          icon: "globe-outline" as const,
          label: "Sito web",
          type: "website" as const,
          value: stripProtocol(club.websiteUrl),
        }
      : null,
    club.instagram?.trim()
      ? {
          href: normalizeHandleUrl(club.instagram, "https://instagram.com/"),
          icon: "logo-instagram" as const,
          label: "Instagram",
          type: "instagram" as const,
          value: formatHandle(club.instagram),
        }
      : null,
    club.facebook?.trim()
      ? {
          href: normalizeHandleUrl(club.facebook, "https://facebook.com/"),
          icon: "logo-facebook" as const,
          label: "Facebook",
          type: "facebook" as const,
          value: formatHandle(club.facebook),
        }
      : null,
  ];

  return rows.filter((row): row is ContactRow => row !== null && row.href !== "");
}

/** Un URL senza schema non è un link sicuro: lo si normalizza prima di aprirlo. */
function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function stripProtocol(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function normalizeHandleUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  return /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${baseUrl}${trimmed.replace(/^@/, "")}`;
}

function formatHandle(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const lastSegment = trimmed.split("/").pop() ?? trimmed;

  return `@${lastSegment.replace(/^@/, "")}`;
}

const styles = StyleSheet.create({
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingVertical: spacing[8],
  },
  contactRowDivided: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  contactRowPressed: {
    opacity: 0.6,
  },
  contactValue: {
    flex: 1,
    minWidth: 0,
  },
  container: {
    gap: spacing[8],
  },
  moreButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
});
