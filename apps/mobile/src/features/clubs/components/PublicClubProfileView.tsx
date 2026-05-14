import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, EmptyState } from "../../../ui";
import type {
  ClubHeaderStats,
  ClubPositionSummary,
  PublicClubMember,
  PublicClubProfile,
  PublicClubSquadraOverview,
} from "../club-service";
import type { ClubTeam } from "../team-service";
import {
  PublicClubHeader,
  type ClubHeaderTab,
} from "./PublicClubHeader";

type PublicClubProfileViewProps = {
  activeTab: ClubHeaderTab;
  club: PublicClubProfile;
  isFollowed: boolean;
  isFollowing: boolean;
  isOwner?: boolean;
  members: PublicClubMember[];
  onContactPress: () => void;
  onEditAffiliations?: () => void;
  onEditSeasons?: () => void;
  onEditSportProfile?: () => void;
  onEditTeams?: () => void;
  onOpenAffiliate: (clubId: string) => void;
  onOpenPositions: () => void;
  onOpenTeam: (teamId: string) => void;
  onTabChange: (tab: ClubHeaderTab) => void;
  onToggleFollow: () => void;
  overview: PublicClubSquadraOverview;
  stats: ClubHeaderStats;
  teams: ClubTeam[];
};

const roleLabels: Record<string, string> = {
  coach: "Allenatore",
  defender: "Difensore",
  director: "Dirigente",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  midfielder: "Centrocampista",
  player: "Giocatore",
  staff: "Staff",
};

export function PublicClubProfileView({
  activeTab,
  club,
  isFollowed,
  isFollowing,
  isOwner = false,
  members,
  onContactPress,
  onEditAffiliations,
  onEditSeasons,
  onEditSportProfile,
  onEditTeams,
  onOpenAffiliate,
  onOpenPositions,
  onOpenTeam,
  onTabChange,
  onToggleFollow,
  overview,
  stats,
  teams,
}: PublicClubProfileViewProps) {
  const affiliationLabel = overview.parentAffiliation
    ? `Società affiliata ad ${overview.parentAffiliation.name}`
    : null;

  return (
    <View style={styles.container}>
      <PublicClubHeader
        activeTab={activeTab}
        affiliationLabel={affiliationLabel}
        club={club}
        isFollowed={isFollowed}
        isFollowing={isFollowing}
        mode={isOwner ? "owner" : "visitor"}
        onContactPress={onContactPress}
        onTabChange={onTabChange}
        onToggleFollow={onToggleFollow}
        stats={stats}
        teams={teams}
      />

      {activeTab === "team" ? (
        <ClubSquadraTab
          club={club}
          isOwner={isOwner}
          onEditAffiliations={onEditAffiliations}
          onEditSeasons={onEditSeasons}
          onEditSportProfile={onEditSportProfile}
          onEditTeams={onEditTeams}
          onOpenAffiliate={onOpenAffiliate}
          onOpenPositions={onOpenPositions}
          onOpenTeam={onOpenTeam}
          overview={overview}
          stats={stats}
          teams={teams}
        />
      ) : activeTab === "roster" ? (
        <ClubRosterTab members={members} />
      ) : (
        <ClubMediaTab club={club} />
      )}
    </View>
  );
}

function ClubSquadraTab({
  club,
  isOwner,
  onEditAffiliations,
  onEditSeasons,
  onEditSportProfile,
  onEditTeams,
  onOpenAffiliate,
  onOpenPositions,
  onOpenTeam,
  overview,
  stats,
  teams,
}: {
  club: PublicClubProfile;
  isOwner: boolean;
  onEditAffiliations?: () => void;
  onEditSeasons?: () => void;
  onEditSportProfile?: () => void;
  onEditTeams?: () => void;
  onOpenAffiliate: (clubId: string) => void;
  onOpenPositions: () => void;
  onOpenTeam: (teamId: string) => void;
  overview: PublicClubSquadraOverview;
  stats: ClubHeaderStats;
  teams: ClubTeam[];
}) {
  const sportFocus = getSportFocus(club);
  const sortedTeams = [...teams].sort((left, right) => left.sort_order - right.sort_order);

  return (
    <View style={styles.tabContent}>
      <Section
        sectionId="sport-profile"
        title="Profilo sportivo"
        onEdit={isOwner ? onEditSportProfile : undefined}
      >
        <View style={styles.sportGrid}>
          <SportInfoCard
            icon="trophy-outline"
            label="Competizione"
            value={club.category ?? getPrimaryTeam(teams)?.category ?? "Da definire"}
          />
          <SportInfoCard
            icon="layers-outline"
            label="Ambito"
            value={buildClubScopeLabel(teams)}
          />
          <View style={styles.focusCard}>
            <View style={styles.iconBox}>
              <Ionicons color={colors.accent} name="football-outline" size={18} />
            </View>
            <View style={styles.focusTextBlock}>
              <AppText color="secondary" style={styles.overline} variant="caption">
                Focus sportivo
              </AppText>
              <AppText numberOfLines={2} style={styles.focusText} variant="bodySm">
                {sportFocus}
              </AppText>
            </View>
          </View>
        </View>
      </Section>

      <Section
        sectionId="highlights"
        title="Highlights del club"
        onEdit={isOwner ? onEditSeasons : undefined}
      >
        <View style={styles.highlightCard}>
          <View style={styles.highlightTop}>
            <HighlightStat
              label="Massimo livello"
              value={club.top_level_reached ?? club.category ?? "Da definire"}
            />
            <HighlightStat
              label="Squadre attive"
              value={String(stats.activeTeamsCount)}
            />
          </View>
          <View style={styles.highlightDivider} />
          <View style={styles.highlightList}>
            <AppText color="inverse" style={styles.highlightKicker} variant="caption">
              Stagioni per categoria
            </AppText>
            {overview.seasonSummaries.length > 0 ? (
              overview.seasonSummaries.slice(0, 3).map((summary) => (
                <View key={summary.category} style={styles.highlightRow}>
                  <View style={styles.highlightName}>
                    <View style={styles.highlightDot} />
                    <AppText color="inverse" variant="bodySm">
                      {summary.category}
                    </AppText>
                  </View>
                  <AppText style={styles.highlightValue} variant="bodySm">
                    {summary.seasonsCount} stagioni
                  </AppText>
                </View>
              ))
            ) : (
              <AppText style={styles.highlightValue} variant="bodySm">
                Storico stagioni da completare
              </AppText>
            )}
          </View>
          {club.key_results.length > 0 ? (
            <>
              <View style={styles.highlightDivider} />
              <View style={styles.keyResultsList}>
                {club.key_results.slice(0, 2).map((result) => (
                  <View key={result} style={styles.keyResult}>
                    <Ionicons color="#38BDF8" name="checkmark-circle" size={15} />
                    <AppText color="inverse" numberOfLines={2} variant="bodySm">
                      {result}
                    </AppText>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </Section>

      <Section sectionId="positions" title="Posizioni aperte">
        <View style={styles.positionsPanel}>
          <View style={styles.positionsHeader}>
            <View>
              <AppText style={styles.positionsCount} variant="headingSm">
                {overview.positionsTotal} ricerche attive
              </AppText>
              <AppText color="secondary" variant="bodySm">
                Anteprima delle figure ricercate
              </AppText>
            </View>
            <View style={styles.softBadge}>
              <AppText color="accent" style={styles.softBadgeText} variant="caption">
                Recruiting
              </AppText>
            </View>
          </View>
          {overview.positionPreview.length > 0 ? (
            <View style={styles.positionList}>
              {overview.positionPreview.slice(0, 3).map((position) => (
                <PositionPreviewRow key={position.id} position={position} />
              ))}
            </View>
          ) : (
            <CompactEmpty icon="briefcase-outline" label="Nessuna posizione aperta al momento." />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onOpenPositions}
            style={styles.viewAllPositions}
            testID="club-positions-view-all"
          >
            <AppText color="accent" style={styles.viewAllText} variant="bodySm">
              Vedi tutte le posizioni
            </AppText>
            <Ionicons color={colors.accent} name="arrow-forward" size={17} />
          </Pressable>
        </View>
      </Section>

      <Section
        description="Seleziona una squadra per vedere il profilo dedicato"
        sectionId="teams"
        title="Le nostre squadre"
        onEdit={isOwner ? onEditTeams : undefined}
      >
        {sortedTeams.length > 0 ? (
          <View style={styles.rowsList}>
            {sortedTeams.map((team) => (
              <TeamRow key={team.id} onPress={() => onOpenTeam(team.id)} team={team} />
            ))}
          </View>
        ) : (
          <CompactEmpty icon="shield-outline" label="Nessuna squadra interna pubblicata." />
        )}
      </Section>

      <Section
        description="Academy, scuole calcio o centri tecnici collegati"
        sectionId="affiliates"
        title="Società affiliate"
        onEdit={isOwner ? onEditAffiliations : undefined}
      >
        {overview.affiliations.length > 0 ? (
          <View style={styles.rowsList}>
            {overview.affiliations.map((affiliate) => (
              <AffiliateRow
                affiliate={affiliate}
                key={affiliate.id}
                onPress={() => onOpenAffiliate(affiliate.id)}
              />
            ))}
          </View>
        ) : (
          <CompactEmpty icon="git-network-outline" label="Nessuna società affiliata collegata." />
        )}
      </Section>
    </View>
  );
}

function Section({
  children,
  description,
  onEdit,
  sectionId,
  title,
}: {
  children: ReactNode;
  description?: string;
  onEdit?: () => void;
  sectionId: string;
  title: string;
}) {
  return (
    <View style={styles.section} testID={`club-section-${sectionId}`}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <AppText style={styles.sectionTitle} variant="titleSm">
            {title}
          </AppText>
          {description ? (
            <AppText color="secondary" variant="bodySm">
              {description}
            </AppText>
          ) : null}
        </View>
        {onEdit ? (
          <Pressable
            accessibilityLabel={`Modifica ${title}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEdit}
            style={styles.sectionEditButton}
          >
            <Ionicons color={colors.textSecondary} name="create-outline" size={17} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SportInfoCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.sportCard}>
      <View style={styles.iconBox}>
        <Ionicons color={colors.accent} name={icon} size={18} />
      </View>
      <AppText color="secondary" style={styles.overline} variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={2} style={styles.sportValue} variant="bodySm">
        {value}
      </AppText>
    </View>
  );
}

function HighlightStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.highlightStat}>
      <AppText color="inverse" style={styles.highlightStatValue} variant="headingSm">
        {value}
      </AppText>
      <AppText style={styles.highlightStatLabel} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function PositionPreviewRow({ position }: { position: ClubPositionSummary }) {
  const teamLabel =
    position.team_name || position.team_category || position.category || "Squadra da definire";

  return (
    <View style={styles.positionRow} testID={`club-position-preview-${position.id}`}>
      <View style={styles.positionIcon}>
        <Ionicons color={colors.textPrimary} name="briefcase-outline" size={17} />
      </View>
      <View style={styles.rowText}>
        <AppText numberOfLines={1} style={styles.rowTitle} variant="bodySm">
          {formatRole(position.role_required)}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {teamLabel}
        </AppText>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </View>
  );
}

function TeamRow({
  onPress,
  team,
}: {
  onPress: () => void;
  team: ClubTeam;
}) {
  return (
    <Pressable
      accessibilityLabel={`Apri ${getTeamDisplayName(team)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.teamRow}
      testID={`club-team-row-${team.id}`}
    >
      <View style={styles.teamAccent} />
      <View style={styles.rowText}>
        <AppText numberOfLines={1} style={styles.rowTitle} variant="bodySm">
          {getTeamDisplayName(team)}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {team.category}
        </AppText>
      </View>
      <AppText color="accent" style={styles.openLabel} variant="caption">
        Apri
      </AppText>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function AffiliateRow({
  affiliate,
  onPress,
}: {
  affiliate: {
    category: string | null;
    city: string;
    id: string;
    logo_url: string | null;
    name: string;
    relationship_label: string | null;
  };
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Apri società affiliata ${affiliate.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.affiliateRow}
      testID={`club-affiliate-row-${affiliate.id}`}
    >
      <View style={styles.affiliateAvatar}>
        {affiliate.logo_url ? (
          <Image source={{ uri: affiliate.logo_url }} style={styles.affiliateLogo} />
        ) : (
          <Ionicons color={colors.textMuted} name="shield-outline" size={19} />
        )}
      </View>
      <View style={styles.rowText}>
        <AppText numberOfLines={1} style={styles.rowTitle} variant="bodySm">
          {affiliate.name}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {affiliate.relationship_label ?? affiliate.category ?? affiliate.city}
        </AppText>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function ClubRosterTab({ members }: { members: PublicClubMember[] }) {
  const players = members.filter((member) => member.member_role === "player");
  const staff = members.filter((member) => member.member_role !== "player");

  return (
    <View style={styles.tabContent}>
      <Section sectionId="roster" title="Organico">
        {members.length === 0 ? (
          <EmptyState
            description="La società non ha ancora pubblicato giocatori o staff."
            icon="people-outline"
            title="Organico da completare"
          />
        ) : (
          <View style={styles.rosterGroups}>
            <RosterGroup members={players} title="Giocatori" />
            <RosterGroup members={staff} title="Staff" />
          </View>
        )}
      </Section>
    </View>
  );
}

function RosterGroup({
  members,
  title,
}: {
  members: PublicClubMember[];
  title: string;
}) {
  if (members.length === 0) {
    return null;
  }

  return (
    <View style={styles.rosterGroup}>
      <AppText color="secondary" style={styles.overline} variant="caption">
        {title}
      </AppText>
      {members.map((member) => (
        <View key={member.id} style={styles.memberRow}>
          <View style={styles.memberAvatar}>
            {member.avatar_url ? (
              <Image source={{ uri: member.avatar_url }} style={styles.memberImage} />
            ) : (
              <AppText color="secondary" variant="caption">
                {getInitials(member.full_name ?? member.manual_name ?? "FM")}
              </AppText>
            )}
          </View>
          <View style={styles.rowText}>
            <AppText numberOfLines={1} style={styles.rowTitle} variant="bodySm">
              {member.full_name ?? member.manual_name ?? "Membro squadra"}
            </AppText>
            <AppText color="secondary" numberOfLines={1} variant="caption">
              {member.staff_title ?? formatRole(member.member_role)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function ClubMediaTab({ club }: { club: PublicClubProfile }) {
  return (
    <View style={styles.tabContent}>
      <Section sectionId="media" title="Media">
        {club.gallery_urls.length === 0 ? (
          <EmptyState
            description="La società non ha ancora pubblicato contenuti media."
            icon="images-outline"
            title="Media da completare"
          />
        ) : (
          <View style={styles.mediaGrid}>
            {club.gallery_urls.slice(0, 6).map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.mediaItem} />
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

function CompactEmpty({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.compactEmpty}>
      <Ionicons color={colors.textMuted} name={icon} size={18} />
      <AppText color="secondary" variant="bodySm">
        {label}
      </AppText>
    </View>
  );
}

function getPrimaryTeam(teams: ClubTeam[]) {
  return teams.find((team) => team.team_type === "senior") ?? teams[0];
}

function buildClubScopeLabel(teams: ClubTeam[]) {
  const hasSenior = teams.some((team) => team.team_type === "senior");
  const youthCount = teams.filter((team) => team.team_type === "youth").length;

  if (hasSenior && youthCount > 0) {
    return "Prima squadra / Settore giovanile";
  }

  if (hasSenior) {
    return "Prima squadra";
  }

  if (youthCount > 0) {
    return "Settore giovanile / Scuola calcio";
  }

  return "Ambito da definire";
}

function getSportFocus(club: PublicClubProfile) {
  const value = club.sports_focus?.trim() || club.description?.trim();
  return value || "Focus sportivo da completare.";
}

function getTeamDisplayName(team: ClubTeam) {
  if (team.team_type === "senior") {
    return team.name.trim() || "Prima squadra";
  }

  return team.name.trim() && team.name.trim() !== team.category.trim()
    ? team.name
    : team.category;
}

function formatRole(role: string) {
  return roleLabels[role] ?? role;
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

const styles = StyleSheet.create({
  affiliateAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  affiliateLogo: {
    height: "100%",
    width: "100%",
  },
  affiliateRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 68,
    padding: spacing[14],
  },
  compactEmpty: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[8],
    padding: spacing[14],
  },
  container: {
    backgroundColor: colors.background,
  },
  focusCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
    width: "100%",
  },
  focusText: {
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 20,
  },
  focusTextBlock: {
    flex: 1,
    gap: spacing[4],
  },
  highlightCard: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius[8],
    gap: spacing[16],
    padding: spacing[18],
  },
  highlightDivider: {
    backgroundColor: "rgba(255,255,255,0.12)",
    height: 1,
  },
  highlightDot: {
    backgroundColor: "#38BDF8",
    borderRadius: radius.full,
    height: 6,
    width: 6,
  },
  highlightKicker: {
    color: colors.textInverseMuted,
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  highlightList: {
    gap: spacing[12],
  },
  highlightName: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  highlightRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  highlightStat: {
    flex: 1,
    gap: spacing[4],
  },
  highlightStatLabel: {
    color: colors.textInverseMuted,
    fontWeight: typography.fontWeight.semibold,
    textTransform: "uppercase",
  },
  highlightStatValue: {
    color: colors.inkInvert,
    fontWeight: typography.fontWeight.bold,
  },
  highlightTop: {
    flexDirection: "row",
    gap: spacing[20],
  },
  highlightValue: {
    color: colors.textInverseMuted,
    fontWeight: typography.fontWeight.semibold,
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[6],
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  keyResult: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  keyResultsList: {
    gap: spacing[10],
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  mediaItem: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    width: "31.8%",
  },
  memberAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 38,
    justifyContent: "center",
    overflow: "hidden",
    width: 38,
  },
  memberImage: {
    height: "100%",
    width: "100%",
  },
  memberRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  openLabel: {
    fontWeight: typography.fontWeight.bold,
  },
  overline: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  positionIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  positionList: {
    gap: spacing[10],
  },
  positionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  positionsCount: {
    fontWeight: typography.fontWeight.heavy,
  },
  positionsHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  positionsPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    gap: spacing[14],
    padding: spacing[16],
  },
  rosterGroup: {
    gap: spacing[8],
  },
  rosterGroups: {
    gap: spacing[18],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  rowTitle: {
    fontWeight: typography.fontWeight.semibold,
  },
  rowsList: {
    gap: spacing[10],
  },
  section: {
    backgroundColor: colors.background,
    gap: spacing[14],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[22],
  },
  sectionEditButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
  },
  softBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  softBadgeText: {
    fontWeight: typography.fontWeight.bold,
  },
  sportCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flex: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
  sportValue: {
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 20,
  },
  tabContent: {
    backgroundColor: colors.background,
    paddingBottom: spacing[32],
  },
  teamAccent: {
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    width: 4,
  },
  teamRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 68,
    overflow: "hidden",
    padding: spacing[14],
  },
  viewAllPositions: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    justifyContent: "center",
    minHeight: 46,
  },
  viewAllText: {
    fontWeight: typography.fontWeight.bold,
  },
});
