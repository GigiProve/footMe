import { useCallback, useEffect, useState } from "react";

import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../theme/tokens";
import { AppText, Badge, Button, EmptyState, ListItem, SectionCard } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { fetchClubTeams, type ClubTeam } from "../team-service";
import { EditTeamsModal } from "../../profiles/edit-modals/EditTeamsModal";

export function ClubTeamsSection() {
  const { profile } = useSession();
  const clubId = profile?.club_id ?? null;
  const clubName = profile?.club_name ?? "La tua societa'";
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [isTeamsModalOpen, setTeamsModalOpen] = useState(false);

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
    loadTeams();
  }, [loadTeams]);

  return (
    <>
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
    </>
  );
}
