import { type ComponentProps } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Badge } from "../../../ui";
import { getPlayerPositionLabel } from "../player-sports";
import { formatSpecialization } from "../profile-edit-helpers";
import {
  computePlayerBackground,
} from "../profile-display-helpers";
import {
  getSocialDisplayValue,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
} from "../profile-form-utils";
import type {
  CompleteProfessionalProfile,
  StaffCareerEntryRecord,
  UserContactsRecord,
} from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";

type StaffInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

type BadgeVariant = "accent" | "default" | "selected" | "success";

type InfoBadge = {
  label: string;
  variant: BadgeVariant;
};

type PublicContactItem = {
  iconName: ComponentProps<typeof Ionicons>["name"];
  key: string;
  linkUrl: string;
  value: string;
};

const CATEGORY_LEVEL_ORDER = [
  "Serie A",
  "Serie B",
  "Serie C",
  "Serie D",
  "Eccellenza",
  "Promozione",
  "Prima Categoria",
  "Seconda Categoria",
  "Terza Categoria",
  "Juniores",
  "Allievi",
  "Giovanissimi",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.sectionLabel}>
      {children.toUpperCase()}
    </AppText>
  );
}

function EditButton({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.editButton}
    >
      <Ionicons color={colors.textSecondary} name="pencil" size={16} />
    </Pressable>
  );
}

function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

function normalizeValues(values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function sortCategories(values: string[]) {
  return [...values].sort((left, right) => {
    const leftIndex = CATEGORY_LEVEL_ORDER.indexOf(left);
    const rightIndex = CATEGORY_LEVEL_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right, "it");
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function formatCompactValues(values: (string | null | undefined)[], limit = 3) {
  const normalized = normalizeValues(values);

  if (normalized.length === 0) {
    return null;
  }

  const visible = normalized.slice(0, limit);
  const remaining = normalized.length - visible.length;

  return remaining > 0
    ? `${visible.join(" • ")} • +${remaining}`
    : visible.join(" • ");
}

function getSeasonStartYear(seasonLabel: string) {
  const parsed = Number.parseInt(seasonLabel.split("/")[0] ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getExperienceYears(entries: StaffCareerEntryRecord[]) {
  const years = new Set<number>();
  const opaqueSeasons = new Set<string>();

  entries.forEach((entry) => {
    const seasonLabels = normalizeValues(entry.seasons);

    seasonLabels.forEach((seasonLabel) => {
      const startYear = getSeasonStartYear(seasonLabel);

      if (startYear !== null) {
        years.add(startYear);
      } else {
        opaqueSeasons.add(seasonLabel);
      }
    });

    if (seasonLabels.length > 0) {
      return;
    }

    const startYear = entry.period_start_year ?? entry.period_end_year;
    const endYear = entry.period_end_year ?? entry.period_start_year;

    if (startYear === null || endYear === null) {
      return;
    }

    const minYear = Math.min(startYear, endYear);
    const maxYear = Math.max(startYear, endYear);

    for (let year = minYear; year <= maxYear; year += 1) {
      years.add(year);
    }
  });

  return years.size + opaqueSeasons.size;
}

function collectWorkedCategories(entries: StaffCareerEntryRecord[]) {
  const categories = entries.flatMap((entry) => {
    const seasonCategories = Object.values(entry.season_details ?? {}).map(
      (detail) => detail.category,
    );

    return [entry.category, ...seasonCategories];
  });

  return sortCategories(normalizeValues(categories));
}

function collectOperationalPoints(entries: StaffCareerEntryRecord[]) {
  return normalizeValues(entries.map((entry) => entry.description)).slice(0, 3);
}

function collectCollaborators(entries: StaffCareerEntryRecord[]) {
  return normalizeValues(entries.map((entry) => entry.head_coach_name)).slice(0, 4);
}

function buildAvailabilityBadges(
  completeProfile: CompleteProfessionalProfile,
): InfoBadge[] {
  const staffProfile = completeProfile.staffProfile;
  const isAvailable = Boolean(staffProfile?.open_to_work);
  const badges: InfoBadge[] = [
    {
      label: isAvailable ? "Disponibile" : "Non disponibile",
      variant: isAvailable ? "success" : "default",
    },
  ];

  if (!isAvailable || !staffProfile) {
    return badges;
  }

  const geographicLabel =
    staffProfile.availability_type === "REGIONS"
      ? formatCompactValues(staffProfile.preferred_regions, 2)
      : staffProfile.availability_type === "PROVINCES"
        ? formatCompactValues(staffProfile.preferred_provinces, 2)
        : "Tutta Italia";

  if (geographicLabel) {
    badges.push({
      label: geographicLabel,
      variant: "default",
    });
  }

  const categoriesLabel = formatCompactValues(staffProfile.preferred_categories, 3);
  if (categoriesLabel) {
    badges.push({
      label: categoriesLabel,
      variant: "default",
    });
  }

  if (staffProfile.available_from?.trim()) {
    badges.push({
      label: staffProfile.available_from.trim(),
      variant: "accent",
    });
  }

  return badges;
}

function buildPrimaryRole(completeProfile: CompleteProfessionalProfile) {
  const staffProfile = completeProfile.staffProfile;

  return (
    staffProfile?.primary_staff_role?.trim() ||
    (staffProfile?.specialization
      ? formatSpecialization(staffProfile.specialization)
      : "") ||
    normalizeValues(staffProfile?.staff_roles ?? [])[0] ||
    "Staff tecnico"
  );
}

function buildIdentityTags(
  completeProfile: CompleteProfessionalProfile,
  primaryRole: string,
) {
  const staffProfile = completeProfile.staffProfile;
  const specializationLabel = staffProfile?.specialization
    ? formatSpecialization(staffProfile.specialization)
    : null;

  return normalizeValues([
    specializationLabel,
    ...(staffProfile?.staff_roles ?? []),
  ]).filter((value) => value.toLowerCase() !== primaryRole.trim().toLowerCase());
}

function buildPublicContactItems(contacts: UserContactsRecord): PublicContactItem[] {
  const emailValue = normalizeContactEmail(contacts.email);
  const instagramUrl = normalizeInstagramInput(contacts.instagram);
  const facebookUrl = normalizeFacebookInput(contacts.facebook);

  return [
    contacts.showEmail && emailValue
      ? {
          iconName: "mail-outline" as const,
          key: "email",
          linkUrl: `mailto:${emailValue}`,
          value: emailValue,
        }
      : null,
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
  ].filter(Boolean) as PublicContactItem[];
}

function resolveCertificationIcon(label: string): ComponentProps<typeof Ionicons>["name"] {
  return /laurea|master|diploma|scienze/i.test(label)
    ? "school-outline"
    : "ribbon-outline";
}

export function StaffInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: StaffInfoTabProps) {
  const staffProfile = completeProfile.staffProfile;
  const careerEntries = [
    ...completeProfile.staffCareerEntries,
    ...completeProfile.staffCoachCareerEntries,
  ];

  const availabilityBadges = buildAvailabilityBadges(completeProfile);
  const primaryRole = buildPrimaryRole(completeProfile);
  const identityTags = buildIdentityTags(completeProfile, primaryRole);
  const experienceYears = getExperienceYears(careerEntries);
  const workedCategories = collectWorkedCategories(careerEntries);
  const operationalSummary = staffProfile?.experience_summary?.trim() || null;
  const operationalPoints = operationalSummary
    ? []
    : collectOperationalPoints(careerEntries);
  const certifications = normalizeValues(staffProfile?.certifications ?? []);
  const collaborators = collectCollaborators(careerEntries);
  const playerBackground = computePlayerBackground(
    completeProfile.staffPlayerCareerEntries,
  );
  const playerCategories = sortCategories(
    normalizeValues(
      completeProfile.staffPlayerCareerEntries.map((entry) => entry.category),
    ),
  );
  const playerPositionLabel = playerBackground.primaryPosition
    ? getPlayerPositionLabel(
        playerBackground.primaryPosition,
        playerBackground.primaryPosition,
      )
    : null;
  const publicContacts = buildPublicContactItems(completeProfile.userContacts);
  const credentialSummary =
    experienceYears > 0
      ? `${experienceYears} ${experienceYears === 1 ? "anno" : "anni"} esperienza`
      : null;

  const shouldShowCredentials =
    Boolean(credentialSummary) ||
    workedCategories.length > 0 ||
    certifications.length > 0;
  const shouldShowBackground =
    playerBackground.careerYears > 0 &&
    Boolean(playerPositionLabel || playerCategories.length > 0);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topSection}>
        <View style={styles.sectionHeaderRow}>
          <SectionLabel>Disponibilita'</SectionLabel>
          {isOwner ? (
            <EditButton
              accessibilityLabel="Modifica disponibilita e profilo staff"
              onPress={() => onEdit("staffInfo")}
            />
          ) : null}
        </View>

        <View style={styles.badgesWrap}>
          {availabilityBadges.map((badge) => (
            <Badge key={badge.label} label={badge.label} variant={badge.variant} />
          ))}
        </View>

        <View style={styles.identityBlock}>
          <SectionLabel>Identita' professionale</SectionLabel>
          <AppText style={styles.primaryRole}>{primaryRole}</AppText>
          {identityTags.length > 0 ? (
            <View style={styles.badgesWrap}>
              {identityTags.map((tag) => (
                <Badge key={tag} label={tag} variant="selected" />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {(operationalSummary || operationalPoints.length > 0) ? (
        <>
          <SectionDivider />
          <View style={styles.section}>
            <SectionLabel>Profilo operativo</SectionLabel>
            {operationalSummary ? (
              <AppText color="secondary" style={styles.operationalSummary} variant="bodySm">
                {operationalSummary}
              </AppText>
            ) : (
              <View style={styles.simpleList}>
                {operationalPoints.map((point) => (
                  <View key={point} style={styles.simpleListItem}>
                    <View style={styles.simpleListDot} />
                    <AppText style={styles.simpleListText} variant="bodySm">
                      {point}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      ) : null}

      {shouldShowCredentials ? (
        <>
          <SectionDivider />
          <View style={styles.section}>
            <SectionLabel>Credenziali</SectionLabel>
            {credentialSummary ? (
              <AppText style={styles.credentialMetric}>{credentialSummary}</AppText>
            ) : null}
            {workedCategories.length > 0 ? (
              <AppText color="secondary" style={styles.credentialLevels} variant="bodySm">
                {workedCategories.join(" • ")}
              </AppText>
            ) : null}

            {certifications.length > 0 ? (
              <View style={styles.certificationsList}>
                {certifications.map((item) => (
                  <View key={item} style={styles.certificationItem}>
                    <Ionicons
                      color={colors.textPrimary}
                      name={resolveCertificationIcon(item)}
                      size={18}
                    />
                    <AppText style={styles.certificationText} variant="bodySm">
                      {item}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {collaborators.length > 0 ? (
        <>
          <SectionDivider />
          <View style={styles.section}>
            <SectionLabel>Ha lavorato con</SectionLabel>
            <View style={styles.peopleList}>
              {collaborators.map((name) => (
                <AppText key={name} style={styles.personName} variant="titleSm">
                  {name}
                </AppText>
              ))}
            </View>
          </View>
        </>
      ) : null}

      {shouldShowBackground ? (
        <>
          <SectionDivider />
          <View style={styles.section}>
            <SectionLabel>Background</SectionLabel>
            <AppText style={styles.backgroundRole} variant="titleSm">
              {playerPositionLabel ? `Ex ${playerPositionLabel}` : "Ex calciatore"}
            </AppText>
            <AppText color="secondary" style={styles.backgroundMeta} variant="bodySm">
              {playerCategories.length > 0
                ? playerCategories.join(" • ")
                : `${playerBackground.careerYears} ${
                    playerBackground.careerYears === 1 ? "anno" : "anni"
                  } di carriera`}
            </AppText>
          </View>
        </>
      ) : null}

      <SectionDivider />
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <SectionLabel>Contatti</SectionLabel>
          {isOwner ? (
            <EditButton
              accessibilityLabel="Modifica contatti"
              onPress={() => onEdit("contact")}
            />
          ) : null}
        </View>

        {publicContacts.length > 0 ? (
          <View style={styles.contactsList}>
            {publicContacts.map((contact, index) => (
              <Pressable
                accessibilityRole="button"
                key={contact.key}
                onPress={() => {
                  void Linking.openURL(contact.linkUrl);
                }}
                style={[
                  styles.contactRow,
                  index === publicContacts.length - 1 ? styles.contactRowLast : null,
                ]}
              >
                <View style={styles.contactIcon}>
                  <Ionicons
                    color={colors.textSecondary}
                    name={contact.iconName}
                    size={18}
                  />
                </View>
                <AppText style={styles.contactValue} variant="bodySm">
                  {contact.value}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <AppText color="secondary" variant="bodySm">
            Nessun contatto pubblico condiviso. Usa la chat interna footMe per iniziare
            la conversazione.
          </AppText>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backgroundMeta: {
    marginTop: spacing[4],
  },
  backgroundRole: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  certificationItem: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  certificationsList: {
    gap: spacing[10],
    marginTop: spacing[16],
  },
  certificationText: {
    color: colors.textPrimary,
    flex: 1,
    fontWeight: "600",
  },
  contactsList: {
    marginTop: spacing[4],
  },
  contactIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  contactRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingVertical: spacing[10],
  },
  contactRowLast: {
    borderBottomWidth: 0,
  },
  contactValue: {
    color: colors.textPrimary,
    flex: 1,
    fontWeight: "600",
  },
  container: {
    paddingBottom: spacing[48],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  credentialLevels: {
    marginTop: spacing[4],
  },
  credentialMetric: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  identityBlock: {
    gap: spacing[12],
    marginTop: spacing[24],
  },
  operationalSummary: {
    lineHeight: 22,
  },
  peopleList: {
    gap: spacing[8],
  },
  personName: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  primaryRole: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  section: {
    gap: spacing[12],
    paddingTop: spacing[4],
  },
  sectionDivider: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: spacing[28],
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  simpleList: {
    gap: spacing[12],
  },
  simpleListDot: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.full,
    height: 6,
    marginTop: spacing[6],
    width: 6,
  },
  simpleListItem: {
    flexDirection: "row",
    gap: spacing[10],
  },
  simpleListText: {
    color: colors.textPrimary,
    flex: 1,
    fontWeight: "500",
  },
  topSection: {
    gap: spacing[4],
  },
});
