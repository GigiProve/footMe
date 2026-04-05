import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Button, EmptyState } from "../../../ui";
import type { PlayerExperienceForm } from "../player-sports";
import type { GroupedExperience } from "./career-grouping";
import { groupExperiencesByTeam } from "./career-grouping";
import { CareerChart } from "./CareerChart";
import { ExperienceBlock } from "./ExperienceBlock";

type CareerTabContentProps = {
  entries: PlayerExperienceForm[];
  isOwner: boolean;
  onAdd: () => void;
  onDelete: (group: GroupedExperience) => void;
  onEdit: (group: GroupedExperience) => void;
};

export function CareerTabContent({
  entries,
  isOwner,
  onAdd,
  onDelete,
  onEdit,
}: CareerTabContentProps) {
  const groups = groupExperiencesByTeam(entries);
  const hasEntries = entries.length > 0;

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

      {!hasEntries && !isOwner ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            description="Questo calciatore non ha ancora aggiunto esperienze calcistiche."
            title="Nessuna esperienza"
          />
        </View>
      ) : null}

      {groups.senior.length > 0 ? (
        <ExperienceSection
          groups={groups.senior}
          isOwner={isOwner}
          onDelete={onDelete}
          onEdit={onEdit}
          title="Prima squadra"
        />
      ) : null}

      {groups.youth.length > 0 ? (
        <ExperienceSection
          groups={groups.youth}
          isOwner={isOwner}
          onDelete={onDelete}
          onEdit={onEdit}
          title="Settore giovanile"
        />
      ) : null}

      {hasEntries ? <CareerChart entries={entries} /> : null}
    </View>
  );
}

type ExperienceSectionProps = {
  groups: GroupedExperience[];
  isOwner: boolean;
  onDelete: (group: GroupedExperience) => void;
  onEdit: (group: GroupedExperience) => void;
  title: string;
};

function ExperienceSection({
  groups,
  isOwner,
  onDelete,
  onEdit,
  title,
}: ExperienceSectionProps) {
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle} variant="headingSm">
        {title}
      </AppText>
      <View style={styles.experienceList}>
        {groups.map((group, index) => (
          <ExperienceBlock
            group={group}
            isLast={index === groups.length - 1}
            isOwner={isOwner}
            key={`${group.clubId ?? group.clubName}-${group.startYear}-${group.endYear}`}
            onDelete={onDelete}
            onEdit={onEdit}
          />
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
});
