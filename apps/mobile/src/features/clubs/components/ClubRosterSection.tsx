import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import {
  Button,
  ChipGroup,
  EmptyState,
  SectionCard,
  StatCard,
} from "../../../ui";
import { useSession } from "../../auth/use-session";
import {
  getHomeDashboard,
  type HomeDashboardData,
} from "../../home/home-dashboard-service";
import {
  fetchClubMembers,
  removeMember,
  rejectMember,
} from "../membership-service";
import { fetchClubTeams, type ClubTeam } from "../team-service";
import type { ClubMember, MemberRole } from "../membership-types";
import { AddMemberModal } from "./AddMemberModal";
import { ClubMemberRow } from "./ClubMemberRow";

type RosterFilter = "all" | "player" | "staff";

const filterOptions: { label: string; value: RosterFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Giocatori", value: "player" },
  { label: "Staff", value: "staff" },
];

type ClubRosterSectionProps = {
  /** Show the highlight/players-staff StatCard rows above the section. Defaults to true. */
  showStats?: boolean;
};

export function ClubRosterSection({
  showStats = true,
}: ClubRosterSectionProps) {
  const { profile, session } = useSession();
  const clubId = profile?.club_id ?? null;
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? null;

  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [addMemberRole, setAddMemberRole] = useState<MemberRole | null>(null);

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

  useEffect(() => {
    loadDashboard();
    loadMembers();
    loadTeams();
  }, [loadDashboard, loadMembers, loadTeams]);

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

  // Build a team name lookup from loaded teams
  const teamNameById = new Map<string, string>(
    teams.map((t) => [t.id, t.name]),
  );

  // Show active + pending members; hide rejected/removed
  const visibleMembers = members.filter(
    (m) => m.status === "active" || m.status === "pending",
  );
  const filteredMembers =
    rosterFilter === "all"
      ? visibleMembers
      : rosterFilter === "player"
        ? visibleMembers.filter((m) => m.member_role === "player")
        : visibleMembers.filter((m) => m.member_role !== "player");

  const activeMembers = members.filter((m) => m.status === "active");
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
    <>
      {showStats ? (
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
      ) : null}

      {showStats ? (
        <View style={styles.statRow}>
          <StatCard
            label="Giocatori"
            tone="accent"
            value={String(playersCount)}
          />
          <StatCard label="Staff" tone="hero" value={String(staffCount)} />
        </View>
      ) : null}

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
                teamName={item.team_id ? (teamNameById.get(item.team_id) ?? null) : null}
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

      {addMemberRole ? (
        <AddMemberModal
          clubId={clubId ?? ""}
          memberRole={addMemberRole}
          onClose={() => setAddMemberRole(null)}
          onSaved={handleMemberSaved}
          visible={addMemberRole !== null}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
});
