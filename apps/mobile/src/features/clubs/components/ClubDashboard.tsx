import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../components/ui/screen";
import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { useSession } from "../../auth/use-session";
import {
  getHomeDashboard,
  type HomeDashboardData,
} from "../../home/home-dashboard-service";
import { colors, spacing } from "../../../theme/tokens";
import {
  AppText,
  Badge,
  Button,
  ChipGroup,
  EmptyState,
  ListItem,
  ModalHeader,
  ScreenHeader,
  SectionCard,
  StatCard,
} from "../../../ui";
import {
  fetchClubMembers,
  removeMember,
  rejectMember,
} from "../membership-service";
import { fetchClubTeams, type ClubTeam } from "../team-service";
import {
  fetchNotifications,
  getUnreadCount,
  markNotificationRead,
} from "../notification-service";
import type {
  AppNotification,
  ClubMember,
  MemberRole,
} from "../membership-types";
import { EditTeamsModal } from "../../profiles/edit-modals/EditTeamsModal";
import { AddMemberModal } from "./AddMemberModal";
import { ClubMemberRow } from "./ClubMemberRow";
import { InviteLinkModal } from "./InviteLinkModal";

type RosterFilter = "all" | "player" | "staff";

const filterOptions: { label: string; value: RosterFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Giocatori", value: "player" },
  { label: "Staff", value: "staff" },
];

export function ClubDashboard() {
  const { profile, session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? null;
  const clubId = profile?.club_id ?? null;
  const clubName = profile?.club_name ?? "La tua societa'";

  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Modals
  const [addMemberRole, setAddMemberRole] = useState<MemberRole | null>(null);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [isTeamsModalOpen, setTeamsModalOpen] = useState(false);

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoadingDashboard(true);
      const data = await getHomeDashboard(userId, userEmail);
      setDashboard(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore nel caricamento";
      Alert.alert("Errore dashboard", message);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [userId, userEmail]);

  const loadMembers = useCallback(async () => {
    if (!clubId) return;
    try {
      setIsLoadingMembers(true);
      const data = await fetchClubMembers(clubId);
      setMembers(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore nel caricamento rosa";
      Alert.alert("Errore rosa", message);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [clubId]);

  const loadTeams = useCallback(async () => {
    if (!clubId) return;
    try {
      const data = await fetchClubTeams(clubId);
      setTeams(data);
    } catch {
      // Non-blocking — teams section is optional
    }
  }, [clubId]);

  const loadUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    } catch {
      // Ignore
    }
  }, [userId]);

  useEffect(() => {
    loadDashboard();
    loadMembers();
    loadTeams();
    loadUnreadCount();
  }, [loadDashboard, loadMembers, loadTeams, loadUnreadCount]);

  async function handleRemoveMember(memberId: string) {
    Alert.alert("Conferma", "Vuoi rimuovere questo membro dalla rosa?", [
      { style: "cancel", text: "Annulla" },
      {
        onPress: async () => {
          try {
            await removeMember(memberId);
            await loadMembers();
          } catch {
            Alert.alert("Errore", "Impossibile rimuovere il membro");
          }
        },
        style: "destructive",
        text: "Rimuovi",
      },
    ]);
  }

  async function handleRejectMember(memberId: string) {
    Alert.alert(
      "Conferma",
      "Vuoi rifiutare il collegamento di questo membro?",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              await rejectMember(memberId);
              await loadMembers();
            } catch {
              Alert.alert("Errore", "Impossibile rifiutare il membro");
            }
          },
          style: "destructive",
          text: "Rifiuta",
        },
      ],
    );
  }

  function handleMemberSaved() {
    setAddMemberRole(null);
    loadMembers();
    Alert.alert("Fatto", "Membro aggiunto alla rosa");
  }

  async function handleOpenNotifications() {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
      setNotificationsOpen(true);
    } catch {
      Alert.alert("Errore", "Impossibile caricare le notifiche");
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  }

  // Filter members
  const activeMembers = members.filter((m) => m.status === "active");
  const filteredMembers =
    rosterFilter === "all"
      ? activeMembers
      : rosterFilter === "player"
        ? activeMembers.filter((m) => m.member_role === "player")
        : activeMembers.filter((m) => m.member_role !== "player");

  const playersCount = activeMembers.filter(
    (m) => m.member_role === "player",
  ).length;
  const staffCount = activeMembers.filter(
    (m) => m.member_role !== "player",
  ).length;

  const toneMap: Record<string, "accent" | "hero" | "muted"> = {
    accent: "accent",
    hero: "hero",
  };

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          action={
            <View style={styles.headerAction}>
              <Button
                label={unreadCount > 0 ? `🔔 ${unreadCount}` : "🔔"}
                onPress={handleOpenNotifications}
                size="sm"
                variant="tertiary"
              />
            </View>
          }
          subtitle={clubName}
          title="Dashboard"
        />

        <View style={styles.statRow}>
          {(dashboard?.highlights ?? []).map((highlight) => (
            <StatCard
              key={highlight.label}
              label={highlight.label}
              tone={toneMap[highlight.tone] ?? "muted"}
              value={isLoadingDashboard ? "..." : highlight.value}
            />
          ))}
        </View>

        <View style={styles.statRow}>
          <StatCard
            label="Giocatori"
            tone="accent"
            value={String(playersCount)}
          />
          <StatCard label="Staff" tone="hero" value={String(staffCount)} />
        </View>

        <SectionCard
          description="Prima squadra e settore giovanile"
          title="Squadre"
        >
          {teams.length === 0 ? (
            <EmptyState
              description="Aggiungi la prima squadra e le squadre giovanili della tua societa'"
              icon="shield-outline"
              title="Nessuna squadra"
            />
          ) : (
            <>
              {teams
                .filter((t) => t.team_type === "senior")
                .map((team) => (
                  <ListItem
                    key={team.id}
                    left={
                      <Ionicons color={colors.accent} name="shield" size={22} />
                    }
                    right={<Badge label={team.category} variant="accent" />}
                    subtitle="Prima squadra"
                    title={team.name}
                  />
                ))}
              {teams.filter((t) => t.team_type === "youth").length > 0 ? (
                <AppText variant="overline" color="secondary">
                  SETTORE GIOVANILE
                </AppText>
              ) : null}
              {teams
                .filter((t) => t.team_type === "youth")
                .map((team) => (
                  <ListItem
                    key={team.id}
                    left={
                      <Ionicons
                        color={colors.textMuted}
                        name="shield-outline"
                        size={20}
                      />
                    }
                    right={<Badge label={team.category} variant="default" />}
                    title={team.name}
                  />
                ))}
            </>
          )}
          <Button
            label="Gestisci squadre"
            onPress={() => setTeamsModalOpen(true)}
            size="sm"
            variant="secondary"
          />
        </SectionCard>

        <SectionCard
          description="Gestisci giocatori e staff della tua societa'"
          title="Rosa"
        >
          <ChipGroup<RosterFilter>
            onChange={(value) => { if (value !== null) setRosterFilter(value); }}
            options={filterOptions}
            value={rosterFilter}
          />

          {filteredMembers.length === 0 && !isLoadingMembers ? (
            <EmptyState
              description="Aggiungi giocatori e staff alla rosa della tua societa'"
              icon="people-outline"
              title="Rosa vuota"
            />
          ) : (
            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ClubMemberRow
                  member={item}
                  onReject={handleRejectMember}
                  onRemove={handleRemoveMember}
                />
              )}
              scrollEnabled={false}
            />
          )}

          <View style={styles.actionRow}>
            <Button
              label="Aggiungi giocatore"
              onPress={() => setAddMemberRole("player")}
              size="sm"
              variant="secondary"
            />
            <Button
              label="Aggiungi staff"
              onPress={() => setAddMemberRole("staff")}
              size="sm"
              variant="secondary"
            />
          </View>
        </SectionCard>

        <SectionCard
          description="Genera e condividi link per far registrare giocatori e staff"
          title="Link di invito"
        >
          <Button
            label="Genera link invito"
            onPress={() => setInviteModalOpen(true)}
            variant="primary"
          />
        </SectionCard>
      </KeyboardAwareForm>

      {/* Edit Teams Modal */}
      <EditTeamsModal
        clubId={clubId ?? ""}
        clubName={clubName}
        onClose={() => setTeamsModalOpen(false)}
        onSaved={() => {
          setTeamsModalOpen(false);
          loadTeams();
        }}
        teams={teams}
        visible={isTeamsModalOpen}
      />

      {/* Add Member Modal */}
      {addMemberRole ? (
        <AddMemberModal
          clubId={clubId ?? ""}
          memberRole={addMemberRole}
          onClose={() => setAddMemberRole(null)}
          onSaved={handleMemberSaved}
          visible={addMemberRole !== null}
        />
      ) : null}

      {/* Invite Link Modal */}
      <InviteLinkModal
        clubId={clubId ?? ""}
        createdBy={userId ?? ""}
        onClose={() => setInviteModalOpen(false)}
        visible={isInviteModalOpen}
      />

      {/* Notifications Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setNotificationsOpen(false)}
        visible={isNotificationsOpen}
      >
        <SafeAreaView style={styles.notificationsRoot}>
          <ModalHeader
            onClose={() => setNotificationsOpen(false)}
            title="Notifiche"
          />
          {notifications.length === 0 ? (
            <View style={styles.notificationsEmpty}>
              <EmptyState
                icon="notifications-outline"
                title="Nessuna notifica"
                description="Le notifiche sui membri della tua rosa appariranno qui"
              />
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.notificationsList}
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListItem
                  left={
                    <Ionicons
                      color={item.is_read ? colors.textMuted : colors.accent}
                      name={
                        item.is_read ? "notifications-outline" : "notifications"
                      }
                      size={22}
                    />
                  }
                  onPress={() => handleMarkRead(item.id)}
                  right={
                    !item.is_read ? (
                      <Badge label="Nuova" variant="accent" />
                    ) : undefined
                  }
                  subtitle={item.body ?? ""}
                  title={item.title}
                />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  headerAction: {
    flexDirection: "row",
    gap: spacing[8],
  },
  notificationsEmpty: {
    flex: 1,
    justifyContent: "center",
    padding: spacing[20],
  },
  notificationsList: {
    padding: spacing[12],
  },
  notificationsRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: spacing[18],
    paddingBottom: spacing[48],
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
});
