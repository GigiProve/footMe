import { useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, EmptyState } from "../../../ui";
import {
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../profiles/player-sports";
import type {
  ClubHeaderStats,
  ClubPositionSummary,
  PublicClubMember,
  PublicClubProfile,
  PublicClubSquadraOverview,
} from "../club-service";
import type { ClubTeam, ClubTeamProfileDetails } from "../team-service";
import {
  PublicClubHeader,
  type ClubHeaderTab,
} from "./PublicClubHeader";
import { ClubMediaTabContent } from "./ClubMediaTabContent";

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
  onOpenProfile: (profileId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onTabChange: (tab: ClubHeaderTab) => void;
  onToggleFollow: () => void;
  overview: PublicClubSquadraOverview;
  stats: ClubHeaderStats;
  teamProfiles?: Record<string, ClubTeamProfileDetails>;
  teams: ClubTeam[];
  viewerProfileId?: string | null;
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

type OrganicoSection = "rosters" | "staff" | "directors" | "operations";

type RoleFilter = "all" | "goalkeepers" | "defenders" | "midfielders" | "forwards";

type PlayerDepartment = Exclude<RoleFilter, "all">;

const organicoSections: { label: string; value: OrganicoSection }[] = [
  { label: "Rose", value: "rosters" },
  { label: "Staff", value: "staff" },
  { label: "Dirigenza", value: "directors" },
  { label: "Area operativa", value: "operations" },
];

const roleFilters: { label: string; value: RoleFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Portieri", value: "goalkeepers" },
  { label: "Difensori", value: "defenders" },
  { label: "Centrocampisti", value: "midfielders" },
  { label: "Attaccanti", value: "forwards" },
];

const playerDepartmentLabels: Record<PlayerDepartment, string> = {
  defenders: "DIF",
  forwards: "ATT",
  goalkeepers: "POR",
  midfielders: "CEN",
};

const playerDepartmentOrder: PlayerDepartment[] = [
  "goalkeepers",
  "defenders",
  "midfielders",
  "forwards",
];

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
  onOpenProfile,
  onOpenTeam,
  onTabChange,
  onToggleFollow,
  overview,
  stats,
  teamProfiles = {},
  teams,
  viewerProfileId = null,
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
        <ClubRosterTab
          club={club}
          members={members}
          onOpenProfile={onOpenProfile}
          teamProfiles={teamProfiles}
          teams={teams}
        />
      ) : (
        <ClubMediaTabContent
          club={club}
          isOwner={isOwner}
          onOpenProfile={onOpenProfile}
          viewerProfileId={viewerProfileId}
        />
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

function ClubRosterTab({
  club,
  members,
  onOpenProfile,
  teamProfiles,
  teams,
}: {
  club: PublicClubProfile;
  members: PublicClubMember[];
  onOpenProfile: (profileId: string) => void;
  teamProfiles: Record<string, ClubTeamProfileDetails>;
  teams: ClubTeam[];
}) {
  const [activeSection, setActiveSection] =
    useState<OrganicoSection>("rosters");

  return (
    <View style={styles.tabContent}>
      <View style={styles.organicoIntro} testID="club-section-roster">
        <AppText style={styles.organicoTitle} variant="headingSm">
          Organico
        </AppText>
        <AppText color="secondary" style={styles.organicoSubtitle} variant="bodySm">
          Consulta rose, staff e struttura della società.
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.secondaryTabs}
        contentContainerStyle={styles.secondaryTabsContent}
      >
        {organicoSections.map((section) => {
          const isActive = activeSection === section.value;

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={section.value}
              onPress={() => setActiveSection(section.value)}
              style={styles.secondaryTab}
              testID={`club-roster-section-tab-${section.value}`}
            >
              <AppText
                color={isActive ? "accent" : "secondary"}
                style={[
                  styles.secondaryTabLabel,
                  isActive ? styles.secondaryTabLabelActive : null,
                ]}
                variant="bodySm"
              >
                {section.label}
              </AppText>
              {isActive ? <View style={styles.secondaryTabIndicator} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {activeSection === "rosters" ? (
        <RosterSquadsSection
          club={club}
          members={members}
          onOpenProfile={onOpenProfile}
          teamProfiles={teamProfiles}
          teams={teams}
        />
      ) : activeSection === "staff" ? (
        <PeopleSection
          emptyDescription="La società non ha ancora pubblicato lo staff tecnico."
          emptyIcon="people-outline"
          emptyTitle="Staff da completare"
          groups={buildStaffGroups(members, teams)}
          onOpenProfile={onOpenProfile}
          subtitle="Staff suddiviso per squadra e area sportiva"
          title="Staff tecnico"
        />
      ) : activeSection === "directors" ? (
        <PeopleSection
          emptyDescription="La società non ha ancora pubblicato figure dirigenziali."
          emptyIcon="briefcase-outline"
          emptyTitle="Dirigenza da completare"
          groups={buildDirectorGroups(members)}
          onOpenProfile={onOpenProfile}
          subtitle="Figure gestionali e sportive della società"
          title="Dirigenza"
        />
      ) : (
        <PeopleSection
          emptyDescription="La società non ha ancora pubblicato figure operative."
          emptyIcon="construct-outline"
          emptyTitle="Area operativa da completare"
          groups={buildOperationalGroups(members)}
          onOpenProfile={onOpenProfile}
          subtitle="Figure organizzative e di supporto"
          title="Area operativa"
        />
      )}
    </View>
  );
}

function RosterSquadsSection({
  club,
  members,
  onOpenProfile,
  teamProfiles,
  teams,
}: {
  club: PublicClubProfile;
  members: PublicClubMember[];
  onOpenProfile: (profileId: string) => void;
  teamProfiles: Record<string, ClubTeamProfileDetails>;
  teams: ClubTeam[];
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const sortedTeams = useMemo(
    () => [...teams].sort((left, right) => left.sort_order - right.sort_order),
    [teams],
  );
  const players = members.filter((member) => member.member_role === "player");
  const defaultTeam =
    sortedTeams.find((team) => team.team_type === "senior") ?? sortedTeams[0] ?? null;
  const selectedTeam =
    sortedTeams.find((team) => team.id === selectedTeamId) ?? defaultTeam;
  const isDefaultTeamSelected = selectedTeam?.id === defaultTeam?.id;
  const selectedPlayers = selectedTeam
    ? players.filter(
        (member) =>
          member.team_id === selectedTeam.id ||
          (!member.team_id && isDefaultTeamSelected),
      )
    : players;
  const filteredPlayers =
    roleFilter === "all"
      ? selectedPlayers
      : selectedPlayers.filter(
          (member) => getPlayerDepartment(member.primary_position) === roleFilter,
        );

  function handleTeamSelect(teamId: string) {
    setSelectedTeamId(teamId);
    setRoleFilter("all");
  }

  return (
    <View style={styles.organicoBody} testID="club-roster-section-rosters">
      <SectionIntro
        subtitle="Seleziona una squadra per consultare la rosa"
        title="Rose"
      />

      {players.length === 0 ? (
        <EmptyState
          description="La società non ha ancora pubblicato giocatori."
          icon="people-outline"
          title="Rose da completare"
        />
      ) : (
        <>
          {sortedTeams.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipScrollContent}
            >
              {sortedTeams.map((team) => {
                const isSelected = selectedTeam?.id === team.id;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={team.id}
                    onPress={() => handleTeamSelect(team.id)}
                    style={[
                      styles.teamChip,
                      isSelected ? styles.teamChipActive : null,
                    ]}
                    testID={`club-roster-team-chip-${team.id}`}
                  >
                    <AppText
                      color={isSelected ? "accent" : "secondary"}
                      style={[
                        styles.teamChipText,
                        isSelected ? styles.teamChipTextActive : null,
                      ]}
                      variant="bodySm"
                    >
                      {getTeamDisplayName(team)}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <RosterSummary
            club={club}
            players={selectedPlayers}
            team={selectedTeam}
            teamProfile={selectedTeam ? teamProfiles[selectedTeam.id] : undefined}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            {roleFilters.map((filter) => {
              const isSelected = roleFilter === filter.value;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={filter.value}
                  onPress={() => setRoleFilter(filter.value)}
                  style={[
                    styles.filterChip,
                    isSelected ? styles.filterChipActive : null,
                  ]}
                  testID={`club-roster-role-filter-${filter.value}`}
                >
                  <AppText
                    color={isSelected ? "inverse" : "secondary"}
                    style={styles.filterChipText}
                    variant="bodySm"
                  >
                    {filter.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredPlayers.length > 0 ? (
            <View style={styles.personList}>
              {filteredPlayers.map((member) => (
                <PersonRow
                  key={member.id}
                  member={member}
                  onOpenProfile={onOpenProfile}
                  subtitle={buildPlayerSubtitle(member)}
                  testID={`club-roster-player-row-${member.id}`}
                />
              ))}
            </View>
          ) : (
            <CompactEmpty
              icon="people-outline"
              label="Nessun giocatore in questo reparto."
            />
          )}
        </>
      )}
    </View>
  );
}

function RosterSummary({
  club,
  players,
  team,
  teamProfile,
}: {
  club: PublicClubProfile;
  players: PublicClubMember[];
  team: ClubTeam | null;
  teamProfile?: ClubTeamProfileDetails;
}) {
  const distribution = getRosterDistribution(players);
  const summaryTitle = team ? getTeamDisplayName(team) : club.name;
  const competitionLabel = buildTeamCompetitionLabel(team, teamProfile, club);

  return (
    <View style={styles.rosterSummary} testID="club-roster-team-summary">
      <View style={styles.rosterSummaryAccent} />
      <View style={styles.rosterSummaryContent}>
        <AppText numberOfLines={1} style={styles.rosterSummaryTitle} variant="titleSm">
          {summaryTitle}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="bodySm">
          {competitionLabel}
        </AppText>
        <View style={styles.rosterSummaryBottom}>
          <View style={styles.rosterCount}>
            <Ionicons color={colors.accent} name="people-outline" size={17} />
            <AppText style={styles.rosterCountText} variant="bodySm">
              {formatPlayersCount(players.length)}
            </AppText>
          </View>
          <View style={styles.distributionList}>
            {distribution.map((item) => (
              <View key={item.department} style={styles.distributionChip}>
                <AppText color="secondary" style={styles.distributionText} variant="caption">
                  {item.count} {playerDepartmentLabels[item.department]}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function SectionIntro({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={styles.organicoSectionHeader}>
      <AppText style={styles.sectionTitle} variant="titleSm">
        {title}
      </AppText>
      <AppText color="secondary" variant="bodySm">
        {subtitle}
      </AppText>
    </View>
  );
}

function PeopleSection({
  emptyDescription,
  emptyIcon,
  emptyTitle,
  groups,
  onOpenProfile,
  subtitle,
  title,
}: {
  emptyDescription: string;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyTitle: string;
  groups: PersonGroup[];
  onOpenProfile: (profileId: string) => void;
  subtitle: string;
  title: string;
}) {
  const visibleGroups = groups.filter((group) => group.members.length > 0);

  return (
    <View style={styles.organicoBody} testID={`club-roster-section-${slugTestId(title)}`}>
      <SectionIntro subtitle={subtitle} title={title} />
      {visibleGroups.length === 0 ? (
        <EmptyState
          description={emptyDescription}
          icon={emptyIcon}
          title={emptyTitle}
        />
      ) : (
        <View style={styles.peopleGroups}>
          {visibleGroups.map((group) => (
            <PeopleGroupView
              group={group}
              key={group.title}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type PersonGroup = {
  icon: keyof typeof Ionicons.glyphMap;
  members: PublicClubMember[];
  title: string;
};

function PeopleGroupView({
  group,
  onOpenProfile,
}: {
  group: PersonGroup;
  onOpenProfile: (profileId: string) => void;
}) {
  return (
    <View style={styles.peopleGroup}>
      <View style={styles.groupTitleRow}>
        <Ionicons color={colors.textMuted} name={group.icon} size={14} />
        <AppText color="secondary" style={styles.groupTitle} variant="caption">
          {group.title}
        </AppText>
        <View style={styles.groupTitleDivider} />
      </View>
      <View style={styles.personList}>
        {group.members.map((member) => (
          <PersonRow
            key={member.id}
            member={member}
            onOpenProfile={onOpenProfile}
            subtitle={member.staff_title ?? formatRole(member.member_role)}
            testID={`club-roster-person-row-${member.id}`}
          />
        ))}
      </View>
    </View>
  );
}

function PersonRow({
  member,
  onOpenProfile,
  subtitle,
  testID,
}: {
  member: PublicClubMember;
  onOpenProfile: (profileId: string) => void;
  subtitle: string;
  testID: string;
}) {
  const name = member.full_name ?? member.manual_name ?? "Membro squadra";
  const canOpenProfile = Boolean(member.profile_id);
  const content = (
    <>
      <View style={styles.memberAvatar}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={styles.memberImage} />
        ) : (
          <AppText color="secondary" variant="caption">
            {getInitials(name)}
          </AppText>
        )}
      </View>
      <View style={styles.rowText}>
        <AppText numberOfLines={1} style={styles.rowTitle} variant="bodySm">
          {name}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {subtitle}
        </AppText>
      </View>
      {canOpenProfile ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  if (canOpenProfile && member.profile_id) {
    return (
      <Pressable
        accessibilityLabel={`Apri profilo di ${name}`}
        accessibilityRole="button"
        onPress={() => onOpenProfile(member.profile_id!)}
        style={({ pressed }) => [
          styles.memberRow,
          pressed ? styles.memberRowPressed : null,
        ]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.memberRow} testID={testID}>
      {content}
    </View>
  );
}

function buildStaffGroups(members: PublicClubMember[], teams: ClubTeam[]): PersonGroup[] {
  const technicalMembers = members.filter(isTechnicalStaffMember);
  const teamGroups = [...teams]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((team) => ({
      icon: "shield-outline" as const,
      members: technicalMembers.filter((member) => member.team_id === team.id),
      title: getTeamDisplayName(team),
    }));
  const knownTeamIds = new Set(teams.map((team) => team.id));
  const crossAreaMembers = technicalMembers.filter(
    (member) => !member.team_id || !knownTeamIds.has(member.team_id),
  );

  return [
    ...teamGroups,
    {
      icon: "pulse-outline",
      members: crossAreaMembers,
      title: "Area trasversale",
    },
  ];
}

function buildDirectorGroups(members: PublicClubMember[]): PersonGroup[] {
  const directors = members.filter((member) => member.member_role === "director");

  return [
    {
      icon: "briefcase-outline",
      members: directors.filter(
        (member) => classifyDirectorArea(member) === "Direzione sportiva",
      ),
      title: "Direzione sportiva",
    },
    {
      icon: "school-outline",
      members: directors.filter(
        (member) => classifyDirectorArea(member) === "Settore giovanile",
      ),
      title: "Settore giovanile",
    },
    {
      icon: "business-outline",
      members: directors.filter(
        (member) => classifyDirectorArea(member) === "Area gestionale",
      ),
      title: "Area gestionale",
    },
  ];
}

function buildOperationalGroups(members: PublicClubMember[]): PersonGroup[] {
  const operationalMembers = members.filter(
    (member) => member.member_role === "staff" && !isTechnicalStaffMember(member),
  );

  return [
    {
      icon: "folder-open-outline",
      members: operationalMembers.filter(
        (member) => classifyOperationalArea(member) === "Segreteria sportiva",
      ),
      title: "Segreteria sportiva",
    },
    {
      icon: "megaphone-outline",
      members: operationalMembers.filter(
        (member) => classifyOperationalArea(member) === "Comunicazione",
      ),
      title: "Comunicazione",
    },
    {
      icon: "construct-outline",
      members: operationalMembers.filter(
        (member) => classifyOperationalArea(member) === "Logistica e impianti",
      ),
      title: "Logistica e impianti",
    },
    {
      icon: "people-outline",
      members: operationalMembers.filter(
        (member) => classifyOperationalArea(member) === "Supporto operativo",
      ),
      title: "Supporto operativo",
    },
  ];
}

function isTechnicalStaffMember(member: PublicClubMember) {
  if (member.member_role === "coach") {
    return true;
  }

  if (member.member_role !== "staff") {
    return false;
  }

  const role = normalizeRoleText(member.staff_title);

  return [
    "allen",
    "analyst",
    "collaboratore",
    "fisi",
    "match",
    "medic",
    "portier",
    "prepar",
    "tecnic",
    "trainer",
  ].some((keyword) => role.includes(keyword));
}

function classifyDirectorArea(member: PublicClubMember) {
  const role = normalizeRoleText(member.staff_title);

  if (
    ["direttore sportivo", "scouting", "scout", "area tecnica"].some((keyword) =>
      role.includes(keyword),
    )
  ) {
    return "Direzione sportiva";
  }

  if (
    ["academy", "giovanile", "settore giovanile", "vivaio", "under"].some(
      (keyword) => role.includes(keyword),
    )
  ) {
    return "Settore giovanile";
  }

  return "Area gestionale";
}

function classifyOperationalArea(member: PublicClubMember) {
  const role = normalizeRoleText(member.staff_title);

  if (
    ["segreter", "tesserament"].some((keyword) => role.includes(keyword))
  ) {
    return "Segreteria sportiva";
  }

  if (
    ["comunic", "marketing", "media", "social", "stampa"].some((keyword) =>
      role.includes(keyword),
    )
  ) {
    return "Comunicazione";
  }

  if (
    ["campo", "impiant", "logistic", "magazz", "struttur", "trasport"].some(
      (keyword) => role.includes(keyword),
    )
  ) {
    return "Logistica e impianti";
  }

  return "Supporto operativo";
}

function normalizeRoleText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getPlayerDepartment(
  position: PlayerPosition | null | undefined,
): PlayerDepartment | null {
  switch (position) {
    case "goalkeeper":
      return "goalkeepers";
    case "defender":
    case "center_back":
    case "right_back":
    case "left_back":
      return "defenders";
    case "midfielder":
    case "defensive_midfielder":
    case "central_midfielder":
    case "attacking_midfielder":
      return "midfielders";
    case "forward":
    case "right_winger":
    case "left_winger":
    case "striker":
      return "forwards";
    default:
      return null;
  }
}

function getRosterDistribution(players: PublicClubMember[]) {
  return playerDepartmentOrder.map((department) => ({
    count: players.filter(
      (player) => getPlayerDepartment(player.primary_position) === department,
    ).length,
    department,
  }));
}

function buildPlayerSubtitle(member: PublicClubMember) {
  return [
    getPlayerPositionLabel(member.primary_position, "Ruolo da completare"),
    getBirthYear(member.birth_date),
    formatMemberStatus(member.contract_status ?? member.current_condition),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" • ");
}

function getBirthYear(birthDate: string | null) {
  if (!birthDate) {
    return null;
  }

  const year = birthDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function formatMemberStatus(value: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase().replace(/[_-]/g, " ");
  const knownLabels: Record<string, string> = {
    "free agent": "Svincolato",
    available: "Disponibile",
    contracted: "Sotto contratto",
    "under contract": "Sotto contratto",
  };

  return knownLabels[normalized] ?? trimmed;
}

function buildTeamCompetitionLabel(
  team: ClubTeam | null,
  teamProfile: ClubTeamProfileDetails | undefined,
  club: PublicClubProfile,
) {
  const competition = teamProfile?.competition_name?.trim();

  if (team) {
    return [team.category, competition].filter(Boolean).join(" • ");
  }

  return club.category ?? "Squadra da definire";
}

function formatPlayersCount(count: number) {
  return count === 1 ? "1 giocatore" : `${count} giocatori`;
}

function slugTestId(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
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
  chipScroll: {
    marginHorizontal: -spacing[20],
  },
  chipScrollContent: {
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[18],
  },
  distributionChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[6],
    borderWidth: 1,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  distributionList: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    justifyContent: "flex-end",
  },
  distributionText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing[14],
  },
  filterChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  filterChipText: {
    fontWeight: typography.fontWeight.semibold,
  },
  filterScrollContent: {
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[16],
  },
  groupTitle: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  groupTitleDivider: {
    backgroundColor: colors.border,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  groupTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
  },
  memberAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    height: 42,
    justifyContent: "center",
    overflow: "hidden",
    width: 42,
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
    minHeight: 58,
    paddingVertical: spacing[10],
  },
  memberRowPressed: {
    opacity: 0.62,
  },
  organicoBody: {
    backgroundColor: colors.background,
    gap: spacing[14],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[22],
  },
  organicoIntro: {
    backgroundColor: colors.background,
    gap: spacing[6],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
    paddingBottom: spacing[16],
  },
  organicoSectionHeader: {
    gap: spacing[6],
  },
  organicoSubtitle: {
    lineHeight: 20,
  },
  organicoTitle: {
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.bold,
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
  peopleGroup: {
    gap: spacing[8],
  },
  peopleGroups: {
    gap: spacing[22],
  },
  personList: {
    backgroundColor: colors.background,
  },
  rosterGroup: {
    gap: spacing[8],
  },
  rosterGroups: {
    gap: spacing[18],
  },
  rosterCount: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  rosterCountText: {
    fontWeight: typography.fontWeight.bold,
  },
  rosterSummary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  rosterSummaryAccent: {
    backgroundColor: colors.accent,
    width: 4,
  },
  rosterSummaryBottom: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingTop: spacing[14],
  },
  rosterSummaryContent: {
    flex: 1,
    padding: spacing[16],
  },
  rosterSummaryTitle: {
    fontWeight: typography.fontWeight.heavy,
    marginBottom: spacing[4],
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
  secondaryTab: {
    justifyContent: "center",
    minHeight: 48,
    position: "relative",
  },
  secondaryTabIndicator: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    bottom: -1,
    height: 3,
    left: 0,
    position: "absolute",
    right: 0,
  },
  secondaryTabLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryTabLabelActive: {
    fontWeight: typography.fontWeight.bold,
  },
  secondaryTabs: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  secondaryTabsContent: {
    gap: spacing[24],
    paddingHorizontal: spacing[20],
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
  teamChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: "transparent",
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing[16],
  },
  teamChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(10, 102, 194, 0.2)",
  },
  teamChipText: {
    fontWeight: typography.fontWeight.semibold,
  },
  teamChipTextActive: {
    fontWeight: typography.fontWeight.bold,
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
