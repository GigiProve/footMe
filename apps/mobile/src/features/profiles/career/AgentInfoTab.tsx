import { useMemo } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import {
  getSocialDisplayValue,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
} from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { AssistitiSection } from "./AssistitiSection";

type AgentInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

type PublicContactRow = {
  iconName: keyof typeof Ionicons.glyphMap;
  key: string;
  linkUrl: string;
  value: string;
};

export function AgentInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: AgentInfoTabProps) {
  const router = useRouter();
  const agentProfile = completeProfile.agentProfile;

  const positioningTitle = useMemo(
    () => buildPositioningTitle(agentProfile?.operational_focuses ?? []),
    [agentProfile?.operational_focuses],
  );
  const positioningSubtitle = useMemo(
    () =>
      buildPositioningSubtitle({
        macroAreas: agentProfile?.operating_macro_areas ?? [],
      }),
    [agentProfile?.operating_macro_areas],
  );
  const publicContacts = useMemo(
    () => buildPublicContactRows(completeProfile),
    [completeProfile],
  );
  const networkRows = useMemo(
    () => buildNetworkRows(completeProfile),
    [completeProfile],
  );

  void router;

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.positioningCopy}>
            <AppText variant="headingLg">{positioningTitle}</AppText>
            <AppText color="secondary" variant="bodySm">
              {positioningSubtitle}
            </AppText>
          </View>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica posizionamento agente"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("agentProfile")}
              style={styles.editButton}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <AssistitiSection
        agentProfileId={completeProfile.profile.id}
        isOwner={isOwner}
      />

      {networkRows.length > 0 || publicContacts.length > 0 ? (
        <View style={styles.footerSection}>
          {networkRows.length > 0 ? (
            <View style={styles.footerBlock}>
              <AppText color="secondary" variant="caption">
                Network e operatività
              </AppText>
              <View style={styles.footerRows}>
                {networkRows.map((row) => (
                  <View key={row.label} style={styles.footerRow}>
                    <AppText color="secondary" variant="caption">
                      {row.label}
                    </AppText>
                    <AppText variant="bodySm">
                      {row.value}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {publicContacts.length > 0 ? (
            <View style={styles.footerBlock}>
              <View style={styles.footerHeaderRow}>
                <AppText color="secondary" variant="caption">
                  Contatti
                </AppText>
                {isOwner ? (
                  <Pressable
                    accessibilityLabel="Modifica contatti agente"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onEdit("contact")}
                    style={styles.editTextButton}
                  >
                    <Ionicons color={colors.textSecondary} name="pencil" size={14} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.contactList}>
                {publicContacts.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item.key}
                    onPress={() => void Linking.openURL(item.linkUrl)}
                    style={({ pressed }) => [
                      styles.contactRow,
                      pressed ? styles.pressedRow : null,
                    ]}
                  >
                    <View style={styles.contactIcon}>
                      <Ionicons color={colors.accent} name={item.iconName} size={16} />
                    </View>
                    <AppText style={styles.contactValue} variant="bodySm">
                      {item.value}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function buildPositioningTitle(focuses: string[]): string {
  const primaryFocus = focuses.find((item) => item.trim().length > 0)?.trim();

  if (primaryFocus) {
    return primaryFocus;
  }

  return "Portfolio in definizione";
}

function buildPositioningSubtitle(input: { macroAreas: string[] }): string {
  if (input.macroAreas.length > 0) {
    return input.macroAreas.join(" • ");
  }

  return "Ricerca rapida dei profili rappresentati.";
}

function buildPublicContactRows(
  completeProfile: CompleteProfessionalProfile,
): PublicContactRow[] {
  const contacts = completeProfile.userContacts;
  const instagramUrl = normalizeInstagramInput(contacts.instagram);
  const facebookUrl = normalizeFacebookInput(contacts.facebook);
  const emailValue = normalizeContactEmail(contacts.email);

  return [
    contacts.showInstagram && instagramUrl
      ? {
          iconName: "logo-instagram" as const,
          key: "instagram",
          linkUrl: instagramUrl,
          value: getSocialDisplayValue("instagram", instagramUrl),
        }
      : null,
    contacts.showFacebook && facebookUrl
      ? {
          iconName: "logo-facebook" as const,
          key: "facebook",
          linkUrl: facebookUrl,
          value: getSocialDisplayValue("facebook", facebookUrl),
        }
      : null,
    contacts.showEmail && emailValue
      ? {
          iconName: "mail-outline" as const,
          key: "email",
          linkUrl: `mailto:${emailValue}`,
          value: emailValue,
        }
      : null,
  ].filter(Boolean) as PublicContactRow[];
}

function buildNetworkRows(completeProfile: CompleteProfessionalProfile) {
  const agentProfile = completeProfile.agentProfile;
  const rows: { label: string; value: string }[] = [];

  if ((agentProfile?.operational_focuses ?? []).length > 0) {
    rows.push({
      label: "Focus",
      value: agentProfile!.operational_focuses.join(" • "),
    });
  }

  if ((agentProfile?.operating_macro_areas ?? []).length > 0) {
    rows.push({
      label: "Macro aree",
      value: agentProfile!.operating_macro_areas.join(" • "),
    });
  }

  if ((agentProfile?.operating_regions ?? []).length > 0) {
    rows.push({
      label: "Regioni",
      value: agentProfile!.operating_regions.join(", "),
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  contactIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  contactList: {
    gap: spacing[10],
  },
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  contactValue: {
    flex: 1,
  },
  container: {
    gap: spacing[32],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[24],
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    marginTop: spacing[4],
    width: 32,
  },
  editTextButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  footerBlock: {
    gap: spacing[12],
  },
  footerHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerRow: {
    flexDirection: "column",
    gap: spacing[4],
  },
  footerRows: {
    gap: spacing[8],
  },
  footerSection: {
    gap: spacing[24],
  },
  positioningCopy: {
    flex: 1,
    gap: spacing[8],
  },
  pressedRow: {
    opacity: 0.82,
  },
  section: {
    gap: spacing[4],
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
});
