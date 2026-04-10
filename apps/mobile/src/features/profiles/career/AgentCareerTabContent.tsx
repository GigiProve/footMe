import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  buildAgentAgeBandTags,
  buildAgentCategoryDistribution,
  buildAgentCategorySummary,
  buildAgentPlayerTypeTags,
  buildOperationalModeItems,
  formatAgentPeriod,
  getAgentManagedPlayersLabel,
} from "../agent-profile";
import type { CompleteProfessionalProfile } from "../profile-service";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type AgentCareerTabContentProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: () => void;
};

export function AgentCareerTabContent({
  completeProfile,
  isOwner,
  onEdit,
}: AgentCareerTabContentProps) {
  const agentProfile = completeProfile.agentProfile;
  const currentAgency = agentProfile?.agency_name?.trim() || "Agenzia attuale da completare";
  const currentRole = agentProfile?.agency_role?.trim() || "Agente sportivo";
  const currentPeriod = formatAgentPeriod({
    endMonth: agentProfile?.period_end_month,
    endYear: agentProfile?.period_end_year,
    startMonth: agentProfile?.period_start_month,
    startYear: agentProfile?.period_start_year,
  });
  const managedPlayersLabel = getAgentManagedPlayersLabel(
    completeProfile.agentManagedPlayerEntries,
    agentProfile?.managed_players_count,
  );
  const categoryDistribution = buildAgentCategoryDistribution(
    completeProfile.agentManagedPlayerEntries,
  );
  const categorySummary = buildAgentCategorySummary(
    completeProfile.agentManagedPlayerEntries,
    agentProfile?.player_types ?? [],
  );
  const playerRoleTags = buildAgentPlayerTypeTags(
    completeProfile.agentManagedPlayerEntries,
    agentProfile?.main_player_roles ?? [],
  );
  const ageBandTags = buildAgentAgeBandTags(completeProfile.agentManagedPlayerEntries);
  const operationalItems = buildOperationalModeItems(agentProfile);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <AppText variant="overline">Carriera</AppText>
        {isOwner ? (
          <Pressable
            accessibilityLabel="Modifica carriera agente"
            hitSlop={8}
            onPress={onEdit}
            style={styles.editButton}
          >
            <Ionicons color={colors.textSecondary} name="create-outline" size={18} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.currentAgencyBlock}>
        <AppText variant="displaySm">{currentAgency}</AppText>
        <View style={styles.currentMetaRow}>
          <AppText color="accent" variant="titleSm">
            {currentRole}
          </AppText>
          <AppText color="secondary" variant="titleSm">
            {currentPeriod}
          </AppText>
        </View>
      </View>

      <View style={styles.highlightBox}>
        <View style={styles.highlightAccent} />
        <View style={styles.highlightContent}>
          <AppText variant="headingLg">{managedPlayersLabel}</AppText>
          <AppText color="secondary" variant="bodySm">
            {categorySummary}
          </AppText>
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="titleSm">Distribuzione giocatori</AppText>
        {categoryDistribution.length > 0 ? (
          <View style={styles.distributionList}>
            {categoryDistribution.map((item) => {
              const percentage = Math.max(
                12,
                Math.round(
                  (item.count / completeProfile.agentManagedPlayerEntries.length) * 100,
                ),
              );

              return (
                <View key={item.label} style={styles.distributionRow}>
                  <View style={styles.distributionHeader}>
                    <AppText variant="bodySm">{item.label}</AppText>
                    <AppText color="secondary" variant="bodySm">
                      {item.count}
                    </AppText>
                  </View>
                  <View style={styles.distributionTrack}>
                    <View style={[styles.distributionBar, { width: `${percentage}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <AppText color="secondary" variant="bodySm">
            Nessuna distribuzione disponibile finché il portfolio non viene compilato.
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="titleSm">Tipologia giocatori</AppText>
        <View style={styles.tagsBlock}>
          {playerRoleTags.length > 0 ? (
            <>
              <AppText color="secondary" variant="caption">
                Ruoli seguiti
              </AppText>
              <View style={styles.tagWrap}>
                {playerRoleTags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <AppText variant="bodySm">{tag}</AppText>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {ageBandTags.length > 0 ? (
            <>
              <AppText color="secondary" variant="caption">
                Fasce d&apos;età
              </AppText>
              <View style={styles.tagWrap}>
                {ageBandTags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <AppText variant="bodySm">{tag}</AppText>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {playerRoleTags.length === 0 && ageBandTags.length === 0 ? (
            <AppText color="secondary" variant="bodySm">
              Completa il portfolio per mostrare ruoli e fasce d&apos;età prevalenti.
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="titleSm">Modalità operativa</AppText>
        {operationalItems.length > 0 ? (
          <View style={styles.operationalList}>
            {operationalItems.map((item) => (
              <View key={item} style={styles.operationalRow}>
                <Ionicons color={colors.accent} name="chevron-forward" size={16} />
                <AppText style={styles.operationalText} variant="bodySm">
                  {item}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText color="secondary" variant="bodySm">
            Nessuna modalità operativa inserita.
          </AppText>
        )}
      </View>

      <View style={[styles.section, styles.previousSection]}>
        <AppText variant="titleSm">Esperienze precedenti</AppText>
        {completeProfile.agentCareerEntries.length > 0 ? (
          <View style={styles.previousList}>
            {completeProfile.agentCareerEntries.map((entry) => (
              <View key={entry.id} style={styles.previousItem}>
                <AppText color="secondary" variant="headingMd">
                  {entry.agency_name}
                </AppText>
                <AppText color="accent" variant="bodySm">
                  {entry.role}
                </AppText>
                <AppText color="secondary" variant="bodySm">
                  {formatAgentPeriod({
                    endMonth: entry.period_end_month,
                    endYear: entry.period_end_year,
                    startMonth: entry.period_start_month,
                    startYear: entry.period_start_year,
                  })}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText color="secondary" variant="bodySm">
            Nessuna esperienza precedente inserita.
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    gap: spacing[20],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[18],
    paddingBottom: spacing[24],
  },
  currentAgencyBlock: {
    gap: spacing[6],
  },
  currentMetaRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[10],
  },
  distributionBar: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 10,
  },
  distributionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  distributionList: {
    gap: spacing[12],
  },
  distributionRow: {
    gap: spacing[6],
  },
  distributionTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 10,
    overflow: "hidden",
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  highlightAccent: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    width: 4,
  },
  highlightBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  highlightContent: {
    flex: 1,
    gap: spacing[4],
  },
  operationalList: {
    gap: spacing[10],
  },
  operationalRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  operationalText: {
    flex: 1,
  },
  previousItem: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingTop: spacing[14],
  },
  previousList: {
    gap: spacing[4],
  },
  previousSection: {
    gap: spacing[12],
  },
  section: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[12],
    paddingTop: spacing[18],
  },
  tag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  tagsBlock: {
    gap: spacing[8],
  },
});
