import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Button, EmptyState } from "../../../ui";
import {
  CoachExperienceBlock,
} from "./CoachExperienceBlock";
import {
  groupCoachCareerEntries,
  groupCoachDirectorCareerEntries,
  groupCoachPlayerCareerEntries,
  type CoachGroupedExperience,
} from "./coach-career-grouping";
import type {
  CoachCareerEntryRecord,
  CoachDirectorCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
} from "../profile-service";

type CoachCareerTabContentProps = {
  coachCareerEntries: CoachCareerEntryRecord[];
  coachDirectorCareerEntries: CoachDirectorCareerEntryRecord[];
  coachPlayerCareerEntries: CoachPlayerCareerEntryRecord[];
  isOwner: boolean;
  onAdd: () => void;
  onDelete: (group: CoachGroupedExperience) => void;
  onEdit: (group: CoachGroupedExperience) => void;
};

export function CoachCareerTabContent({
  coachCareerEntries,
  coachDirectorCareerEntries,
  coachPlayerCareerEntries,
  isOwner,
  onAdd,
  onDelete,
  onEdit,
}: CoachCareerTabContentProps) {
  const technicalGroups = groupCoachCareerEntries(coachCareerEntries);
  const playerGroups = groupCoachPlayerCareerEntries(coachPlayerCareerEntries);
  const directorGroups = groupCoachDirectorCareerEntries(coachDirectorCareerEntries);
  const hasEntries =
    technicalGroups.length > 0 ||
    playerGroups.length > 0 ||
    directorGroups.length > 0;

  return (
    <View style={styles.container}>
      {isOwner ? (
        <View style={styles.addRow}>
          <Button
            label="Aggiungi esperienza"
            leftIcon={<Ionicons color={colors.accent} name="add" size={16} />}
            onPress={onAdd}
            size="sm"
            variant="secondary"
          />
        </View>
      ) : null}

      {!hasEntries ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            description="Questo allenatore non ha ancora aggiunto esperienze strutturate."
            title="Nessuna esperienza"
          />
        </View>
      ) : null}

      {technicalGroups.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle icon="shield-outline" title="Carriera tecnica" />
          <View style={styles.experienceList}>
            {technicalGroups.map((group, index) => (
              <CoachExperienceBlock
                group={group}
                isLast={index === technicalGroups.length - 1}
                isOwner={isOwner}
                key={group.entryId}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </View>
        </View>
      ) : null}

      {playerGroups.length > 0 ? (
        <SimpleSection
          icon="shirt-outline"
          items={playerGroups.map((entry) => ({
            description: entry.description,
            key: entry.entryId,
            meta: entry.seasonLabel,
            teamLogoUrl: entry.teamLogoUrl,
            title: entry.teamName,
          }))}
          title="Esperienze calcistiche precedenti"
        />
      ) : null}

      {directorGroups.length > 0 ? (
        <SimpleSection
          icon="briefcase-outline"
          items={directorGroups.map((entry) => ({
            description: entry.description ?? "",
            key: entry.entryId,
            meta: entry.durationLabel,
            teamLogoUrl: entry.teamLogoUrl,
            title: [entry.roleLabel, entry.teamName].filter(Boolean).join(" - "),
          }))}
          title="Esperienze da dirigente"
        />
      ) : null}
    </View>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons color={colors.accent} name={icon} size={18} />
      <AppText style={styles.sectionTitle} variant="headingSm">
        {title}
      </AppText>
    </View>
  );
}

function SimpleSection({
  icon,
  items,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  items: {
    description: string;
    key: string;
    meta: string;
    teamLogoUrl: string;
    title: string;
  }[];
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionTitle icon={icon} title={title} />
      <View style={styles.simpleList}>
        {items.map((item) => (
          <View key={item.key} style={styles.simpleItem}>
            <View style={styles.simpleItemHeader}>
              <Ionicons color={colors.textSecondary} name="shield-outline" size={16} />
              <View style={styles.simpleItemBody}>
                <AppText variant="titleSm">{item.title}</AppText>
                <AppText color="secondary" variant="bodySm">
                  {item.meta}
                </AppText>
                {item.description ? (
                  <AppText color="secondary" variant="caption">
                    {item.description}
                  </AppText>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: {
    alignItems: "flex-end",
    padding: spacing[16],
    paddingBottom: 0,
  },
  container: {
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    gap: spacing[8],
    paddingBottom: spacing[20],
  },
  emptyContainer: {
    marginHorizontal: spacing[16],
    marginTop: spacing[16],
  },
  experienceList: {
    gap: 0,
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[14],
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[18],
  },
  sectionTitle: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  simpleItem: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing[12],
  },
  simpleItemBody: {
    flex: 1,
    gap: spacing[4],
  },
  simpleItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[10],
  },
  simpleList: {
    gap: spacing[10],
  },
});
