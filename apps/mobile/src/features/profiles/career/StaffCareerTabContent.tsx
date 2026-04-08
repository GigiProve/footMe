import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Button, EmptyState } from "../../../ui";
import type {
  StaffCareerEntryRecord,
  StaffCoachCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "../profile-service";
import type { GroupedExperience } from "./career-grouping";
import { groupExperiencesByTeam } from "./career-grouping";
import { ExperienceBlock } from "./ExperienceBlock";
import { StaffExperienceBlock } from "./StaffExperienceBlock";
import {
  groupStaffCareerEntries,
  groupStaffCoachCareerEntries,
  mapStaffPlayerEntriesToPlayerExperiences,
  type StaffGroupedExperience,
} from "./staff-career-grouping";

type StaffCareerTabContentProps = {
  isOwner: boolean;
  onAdd: () => void;
  onDelete: (group: StaffGroupedExperience, section: "technical" | "coach") => void;
  onDeletePlayerEntry: (group: GroupedExperience) => void;
  onEdit: (group: StaffGroupedExperience, section: "technical" | "coach") => void;
  staffCareerEntries: StaffCareerEntryRecord[];
  staffCoachCareerEntries: StaffCoachCareerEntryRecord[];
  staffPlayerCareerEntries: StaffPlayerCareerEntryRecord[];
};

export function StaffCareerTabContent({
  isOwner,
  onAdd,
  onDelete,
  onDeletePlayerEntry,
  onEdit,
  staffCareerEntries,
  staffCoachCareerEntries,
  staffPlayerCareerEntries,
}: StaffCareerTabContentProps) {
  const technicalGroups = groupStaffCareerEntries(staffCareerEntries);
  const coachGroups = groupStaffCoachCareerEntries(staffCoachCareerEntries);
  const playerForms = mapStaffPlayerEntriesToPlayerExperiences(staffPlayerCareerEntries);
  const playerGroups = groupExperiencesByTeam(playerForms);
  const hasPlayerEntries =
    playerGroups.senior.length > 0 || playerGroups.youth.length > 0;

  const hasEntries =
    technicalGroups.length > 0 || coachGroups.length > 0 || hasPlayerEntries;

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
            description="Questo staff non ha ancora aggiunto esperienze strutturate."
            title="Nessuna esperienza"
          />
        </View>
      ) : null}

      {technicalGroups.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle icon="shield-outline" title="Staff tecnico" />
          <View style={styles.experienceList}>
            {technicalGroups.map((group, index) => (
              <StaffExperienceBlock
                group={group}
                isLast={index === technicalGroups.length - 1}
                isOwner={isOwner}
                key={group.entryId}
                onDelete={(g) => onDelete(g, "technical")}
                onEdit={(g) => onEdit(g, "technical")}
              />
            ))}
          </View>
        </View>
      ) : null}

      {coachGroups.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle icon="clipboard-outline" title="Allenatore" />
          <View style={styles.experienceList}>
            {coachGroups.map((group, index) => (
              <StaffExperienceBlock
                group={group}
                isLast={index === coachGroups.length - 1}
                isOwner={isOwner}
                key={group.entryId}
                onDelete={(g) => onDelete(g, "coach")}
                onEdit={(g) => onEdit(g, "coach")}
              />
            ))}
          </View>
        </View>
      ) : null}

      {hasPlayerEntries ? (
        <View style={styles.section}>
          <SectionTitle icon="shirt-outline" title="Carriera da calciatore" />

          {playerGroups.senior.length > 0 ? (
            <View style={styles.experienceList}>
              {playerGroups.senior.map((group, index) => (
                <ExperienceBlock
                  group={group}
                  isLast={
                    index === playerGroups.senior.length - 1 &&
                    playerGroups.youth.length === 0
                  }
                  isOwner={isOwner}
                  key={`${group.clubId ?? group.clubName}-${group.startYear}-${group.endYear}`}
                  onDelete={onDeletePlayerEntry}
                  onEdit={() => {}}
                />
              ))}
            </View>
          ) : null}

          {playerGroups.youth.length > 0 ? (
            <View style={styles.experienceList}>
              {playerGroups.youth.map((group, index) => (
                <ExperienceBlock
                  group={group}
                  isLast={index === playerGroups.youth.length - 1}
                  isOwner={isOwner}
                  key={`${group.clubId ?? group.clubName}-${group.startYear}-${group.endYear}`}
                  onDelete={onDeletePlayerEntry}
                  onEdit={() => {}}
                />
              ))}
            </View>
          ) : null}
        </View>
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
});
