/**
 * Profilo della singola squadra (REV-PROF-17 §"TAP SU UNA SQUADRA").
 *
 * È una pagina vera, non una card espansa: ha una route, un deep link e i
 * propri stati. Resta però una sottoentità della Società — nessun account,
 * nessuna identità amministrativa, nessun dominio di permessi separato.
 *
 * Esattamente due tab: Organico e Media. Le informazioni sportive che prima
 * vivevano in una terza tab stanno nell'header, in forma leggera.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, EmptyState, TabBar, type TabBarItem } from "../../../ui";
import { TaggedContentGrid } from "../../content/components/TaggedContentGrid";
import { getPlayerPositionLabel } from "../../profiles/player-sports";
import { composeTeamDisplayName } from "./society-profile-model";
import { SocietyProfileHeader } from "./SocietyProfileHeader";
import { SocietyPersonRow } from "./SocietyRows";
import type { SocietyTeamDetail, SocietyTeamMember } from "./society-profile-types";

export type SocietyTeamTab = "squad" | "media";

const TABS: readonly TabBarItem<SocietyTeamTab>[] = [
  { label: "Organico", value: "squad" },
  { label: "Media", value: "media" },
];

const SQUAD_PREVIEW_AVATARS = 4;

type SocietyTeamProfileViewProps = {
  activeTab: SocietyTeamTab;
  detail: SocietyTeamDetail;
  onFollowPress: () => void;
  onMessagePress: () => void;
  onMorePress: () => void;
  onOpenProfile: (profileId: string) => void;
  onOpenSquadList: () => void;
  onSharePress: () => void;
  onTabChange: (tab: SocietyTeamTab) => void;
};

export function SocietyTeamProfileView({
  activeTab,
  detail,
  onFollowPress,
  onMessagePress,
  onMorePress,
  onOpenProfile,
  onOpenSquadList,
  onSharePress,
  onTabChange,
}: SocietyTeamProfileViewProps) {
  const { club, squad, staff, team, viewer } = detail;
  const isOwner = viewer.mode === "owner";
  const displayName = composeTeamDisplayName(club.name, team.name);

  // Informazioni sportive leggere, sotto il nome: niente card "Profilo
  // sportivo" e niente KPI a zero.
  const metaRows = [
    team.season
      ? { icon: "calendar-outline" as const, key: "season", text: `Stagione ${team.season}` }
      : null,
    team.city
      ? {
          icon: "location-outline" as const,
          key: "city",
          text: [team.city, team.region].filter(Boolean).join(", "),
        }
      : null,
    team.venueName
      ? { icon: "business-outline" as const, key: "venue", text: team.venueName }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <View style={styles.container} testID="society-team-profile">
      <SocietyProfileHeader
        actions={
          <>
            {/*
              L'owner non segue né scrive a sé stesso. Le azioni gestionali
              della squadra restano nella Dashboard: qui non ne compaiono.
            */}
            {isOwner ? null : (
              <>
                <Button
                  accessibilityState={{ selected: viewer.isFollowing }}
                  label={viewer.isFollowing ? "Seguito" : "Segui"}
                  onPress={onFollowPress}
                  size="sm"
                  testID="society-team-follow"
                  variant={viewer.isFollowing ? "secondary" : "primary"}
                />
                <Button
                  label="Messaggio"
                  onPress={onMessagePress}
                  size="sm"
                  testID="society-team-message"
                  variant="secondary"
                />
              </>
            )}
            <TeamIconAction
              icon="share-outline"
              label="Condividi profilo squadra"
              onPress={onSharePress}
              testID="society-team-share"
            />
            <TeamIconAction
              icon="ellipsis-horizontal"
              label="Altre azioni"
              onPress={onMorePress}
              testID="society-team-more"
            />
          </>
        }
        categoryLabel={team.competitionName?.trim() || team.category}
        coverUrl={team.coverUrl}
        logoUrl={team.logoUrl}
        metaRows={metaRows}
        name={displayName}
        testID="society-team-header"
      />

      <TabBar
        active={activeTab}
        fill
        items={TABS}
        onChange={onTabChange}
        testID="society-team-tab-bar"
      />

      <View style={styles.tabBody}>
        {activeTab === "squad" ? (
          <TeamSquadTab
            onOpenProfile={onOpenProfile}
            onOpenSquadList={onOpenSquadList}
            squad={squad}
            staff={staff}
          />
        ) : (
          /*
            Modulo contenuti condiviso, filtrato sul team: un contenuto della
            Società senza associazione alla squadra resta nel Media del club e
            non viene copiato qui.
          */
          <View style={styles.mediaSection}>
            <TaggedContentGrid
              emptyDescription="Non ci sono ancora contenuti pubblicati per questa squadra."
              emptyTitle="Nessun contenuto per questa squadra"
              targetId={team.id}
              targetType="team"
            />
          </View>
        )}
      </View>
    </View>
  );
}

type TeamSquadTabProps = {
  onOpenProfile: (profileId: string) => void;
  onOpenSquadList: () => void;
  squad: readonly SocietyTeamMember[];
  staff: readonly SocietyTeamMember[];
};

/**
 * Organico: rosa e staff tecnico, separati. L'allenatore è dentro lo staff —
 * non ha una sezione né una tab propria. Nessuna anteprima di foto, video o
 * comunicati: quelli stanno nella tab Media.
 */
function TeamSquadTab({
  onOpenProfile,
  onOpenSquadList,
  squad,
  staff,
}: TeamSquadTabProps) {
  return (
    <View style={styles.squadContainer}>
      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="titleMd">
          Rosa
        </AppText>
        {squad.length > 0 ? (
          <Pressable
            accessibilityLabel={`Giocatori della squadra, ${squad.length}`}
            accessibilityRole="button"
            onPress={onOpenSquadList}
            style={({ pressed }) => [
              styles.squadCard,
              pressed ? styles.squadCardPressed : null,
            ]}
            testID="society-team-squad-card"
          >
            <View style={styles.avatarStack}>
              {squad.slice(0, SQUAD_PREVIEW_AVATARS).map((member, index) => (
                <View
                  key={member.id}
                  style={[styles.avatarSlot, index > 0 ? styles.avatarOverlap : null]}
                >
                  <Avatar
                    name={member.fullName}
                    size="sm"
                    uri={member.avatarUrl ?? undefined}
                  />
                </View>
              ))}
            </View>
            <AppText style={styles.squadLabel} variant="titleSm">
              Giocatori della squadra
            </AppText>
            <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
          </Pressable>
        ) : (
          <EmptyState
            description="Il club non ha ancora pubblicato i giocatori di questa squadra."
            icon="people-outline"
            title="Rosa non ancora disponibile"
          />
        )}
      </View>

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="titleMd">
          Staff tecnico
        </AppText>
        {staff.length > 0 ? (
          <View>
            {staff.map((member, index) => (
              <SocietyPersonRow
                avatarUrl={member.avatarUrl}
                isLast={index === staff.length - 1}
                key={member.id}
                name={member.fullName}
                onPress={
                  member.isLinked && member.profileId
                    ? () => onOpenProfile(member.profileId as string)
                    : undefined
                }
                roleLabel={formatStaffRole(member.roleLabel)}
                testID={`society-team-staff-${member.id}`}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            description="Il club non ha ancora pubblicato lo staff di questa squadra."
            icon="clipboard-outline"
            title="Staff tecnico non ancora disponibile"
          />
        )}
      </View>
    </View>
  );
}

/** Lista completa della rosa, aperta dalla card Organico. */
export function SocietyTeamSquadList({
  onOpenProfile,
  squad,
}: {
  onOpenProfile: (profileId: string) => void;
  squad: readonly SocietyTeamMember[];
}) {
  if (squad.length === 0) {
    return (
      <View style={styles.section}>
        <EmptyState
          description="Il club non ha ancora pubblicato i giocatori di questa squadra."
          icon="people-outline"
          title="Rosa non ancora disponibile"
        />
      </View>
    );
  }

  return (
    <View style={styles.section} testID="society-team-squad-list">
      {squad.map((member, index) => (
        <SocietyPersonRow
          avatarUrl={member.avatarUrl}
          isLast={index === squad.length - 1}
          key={member.id}
          name={member.fullName}
          onPress={
            member.isLinked && member.profileId
              ? () => onOpenProfile(member.profileId as string)
              : undefined
          }
          roleLabel={
            member.primaryPosition
              ? getPlayerPositionLabel(member.primaryPosition)
              : null
          }
          testID={`society-team-player-${member.id}`}
        />
      ))}
    </View>
  );
}

const STAFF_ROLE_LABELS: Record<string, string> = {
  coach: "Allenatore",
  staff: "Staff tecnico",
};

function formatStaffRole(role: string | null): string | null {
  if (!role) return null;

  return STAFF_ROLE_LABELS[role] ?? role;
}

function TeamIconAction({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconAction,
        pressed ? styles.iconActionPressed : null,
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarOverlap: {
    marginLeft: -spacing[10],
  },
  avatarSlot: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 2,
  },
  avatarStack: {
    flexDirection: "row",
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  iconAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconActionPressed: {
    opacity: 0.6,
  },
  mediaSection: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  squadCard: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 60,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  squadCardPressed: {
    opacity: 0.7,
  },
  squadContainer: {
    gap: spacing[8],
  },
  squadLabel: {
    flex: 1,
    minWidth: 0,
  },
  tabBody: {
    flex: 1,
  },
});
