import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  buildAgentAgeBandTags,
  buildAgentCategoryDistribution,
  buildAgentCategorySummary,
  buildAgentPlayerTypeTags,
  buildOperationalModeItems,
  formatAgentPeriod,
  getAgentManagedPlayersCount,
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
  const managedPlayersCount = getAgentManagedPlayersCount(
    completeProfile.agentManagedPlayerEntries,
    agentProfile?.managed_players_count,
  );
  const categorySummary = buildAgentCategorySummary(
    completeProfile.agentManagedPlayerEntries,
    agentProfile?.player_types ?? [],
  );
  const categoryDistribution = buildAgentCategoryDistribution(
    completeProfile.agentManagedPlayerEntries,
  );
  const playerRoleTags = buildAgentPlayerTypeTags(
    completeProfile.agentManagedPlayerEntries,
    agentProfile?.main_player_roles ?? [],
  );
  const ageBandTags = buildAgentAgeBandTags(completeProfile.agentManagedPlayerEntries);
  const allTags = [...playerRoleTags, ...ageBandTags];
  const operationalItems = buildOperationalModeItems(agentProfile);
  const totalPlayers = completeProfile.agentManagedPlayerEntries.length;

  return (
    <View>
      {/* Main experience block */}
      <View style={styles.mainBlock}>
        <View style={styles.mainBlockHeader}>
          <AppText variant="displaySm">{currentAgency}</AppText>
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

        <View style={styles.roleRow}>
          <AppText color="accent" variant="titleSm">
            {currentRole}
          </AppText>
          <View style={styles.dot} />
          <AppText color="secondary" variant="bodySm">
            {currentPeriod}
          </AppText>
        </View>

        <View style={styles.highlightBox}>
          <View style={styles.highlightAccent} />
          <View style={styles.highlightContent}>
            <View style={styles.highlightCountRow}>
              {managedPlayersCount !== null ? (
                <>
                  <AppText variant="displaySm">{managedPlayersCount}</AppText>
                  <AppText style={styles.highlightCountLabel} variant="titleSm">
                    {managedPlayersCount === 1 ? " giocatore gestito" : " giocatori gestiti"}
                  </AppText>
                </>
              ) : (
                <AppText variant="titleSm">Portfolio in definizione</AppText>
              )}
            </View>
            <AppText color="secondary" variant="bodySm">
              {categorySummary}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText color="secondary" variant="overline">
            Distribuzione giocatori
          </AppText>
          {categoryDistribution.length > 0 ? (
            <View style={styles.distList}>
              {categoryDistribution.map((item) => {
                const pct = Math.max(8, Math.round((item.count / totalPlayers) * 100));
                return (
                  <View key={item.label} style={styles.distRow}>
                    <AppText style={styles.distLabel} variant="bodySm">
                      {item.label}
                    </AppText>
                    <View style={styles.distTrack}>
                      <View style={[styles.distFill, { width: `${pct}%` }]} />
                    </View>
                    <AppText color="primary" style={styles.distValue} variant="bodySm">
                      {item.count}
                    </AppText>
                  </View>
                );
              })}
            </View>
          ) : (
            <AppText color="secondary" variant="bodySm">
              Nessuna distribuzione disponibile.
            </AppText>
          )}
        </View>

        <View style={styles.section}>
          <AppText color="secondary" variant="overline">
            Tipologia giocatori
          </AppText>
          {allTags.length > 0 ? (
            <View style={styles.tagWrap}>
              {allTags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <AppText variant="bodySm">{tag}</AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText color="secondary" variant="bodySm">
              Completa il portfolio per mostrare ruoli e fasce d&apos;età prevalenti.
            </AppText>
          )}
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <AppText color="secondary" variant="overline">
            Modalità operativa
          </AppText>
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
      </View>

      {/* Previous career entries */}
      {completeProfile.agentCareerEntries.map((entry, index) => (
        <View
          key={entry.id}
          style={[
            styles.secondaryBlock,
            index === completeProfile.agentCareerEntries.length - 1
              ? styles.secondaryBlockLast
              : null,
          ]}
        >
          <AppText color="secondary" variant="headingMd">
            {entry.agency_name}
          </AppText>
          <View style={styles.roleRow}>
            <AppText color="secondary" variant="bodySm">
              {entry.role}
            </AppText>
            <View style={styles.dot} />
            <AppText color="secondary" variant="bodySm">
              {formatAgentPeriod({
                endMonth: entry.period_end_month,
                endYear: entry.period_end_year,
                startMonth: entry.period_start_month,
                startYear: entry.period_start_year,
              })}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  distFill: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 6,
  },
  distLabel: {
    width: 88,
  },
  distList: {
    gap: spacing[10],
  },
  distRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  distTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    flex: 1,
    height: 6,
    overflow: "hidden",
  },
  distValue: {
    fontWeight: "700",
    textAlign: "right",
    width: 24,
  },
  dot: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.full,
    height: 4,
    opacity: 0.5,
    width: 4,
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
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
    marginTop: spacing[20],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  highlightContent: {
    flex: 1,
    gap: spacing[6],
  },
  highlightCountLabel: {
    alignSelf: "flex-end",
    marginBottom: 2,
  },
  highlightCountRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing[4],
  },
  lastSection: {
    marginBottom: 0,
  },
  mainBlock: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[24],
    paddingTop: spacing[28],
  },
  mainBlockHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[6],
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
  roleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  secondaryBlock: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[6],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[24],
  },
  secondaryBlockLast: {
    borderBottomWidth: 0,
  },
  section: {
    gap: spacing[14],
    marginTop: spacing[24],
  },
  tag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
