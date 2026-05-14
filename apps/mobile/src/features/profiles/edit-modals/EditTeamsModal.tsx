import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { spacing } from "../../../theme/tokens";
import { AppText, Button, Input, SectionCard } from "../../../ui";
import {
  deleteClubTeam,
  fetchClubTeamProfiles,
  insertClubTeams,
  upsertClubTeam,
  upsertClubTeamProfile,
  type ClubTeam,
  type ClubTeamProfileDetails,
} from "../../clubs/team-service";
import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../player-sports";
import { EditModalShell } from "./EditModalShell";

type TeamDraft = {
  category: string;
  competitionName: string;
  existingId: string | null;
  groupName: string;
  mediaUrls: string;
  name: string;
  promotedPlayersCount: string;
  recentResults: string[];
};

type EditTeamsModalProps = {
  clubId: string;
  clubName: string;
  onClose: () => void;
  onSaved: () => void;
  teams: ClubTeam[];
  visible: boolean;
};

export function EditTeamsModal({
  clubId,
  clubName,
  onClose,
  onSaved,
  teams,
  visible,
}: EditTeamsModalProps) {
  const seniorTeam = useMemo(
    () => teams.find((team) => team.team_type === "senior"),
    [teams],
  );
  const youthTeams = useMemo(
    () => teams.filter((team) => team.team_type === "youth"),
    [teams],
  );

  const [seniorDraft, setSeniorDraft] = useState<TeamDraft>(() =>
    buildTeamDraft(seniorTeam, clubName, {}),
  );
  const [youthDrafts, setYouthDrafts] = useState<TeamDraft[]>(() =>
    youthTeams.map((team) => buildTeamDraft(team, clubName, {})),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setIsSaving(false);

    async function hydrateTeamProfiles() {
      try {
        const profiles = await fetchClubTeamProfiles(teams.map((team) => team.id));
        setSeniorDraft(buildTeamDraft(seniorTeam, clubName, profiles));
        setYouthDrafts(
          youthTeams.map((team) => buildTeamDraft(team, clubName, profiles)),
        );
      } catch {
        setSeniorDraft(buildTeamDraft(seniorTeam, clubName, {}));
        setYouthDrafts(
          youthTeams.map((team) => buildTeamDraft(team, clubName, {})),
        );
      }
    }

    void hydrateTeamProfiles();
  }, [clubName, seniorTeam, teams, visible, youthTeams]);

  function updateSeniorDraft<K extends keyof TeamDraft>(
    key: K,
    value: TeamDraft[K],
  ) {
    setSeniorDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateYouthDraft<K extends keyof TeamDraft>(
    index: number,
    key: K,
    value: TeamDraft[K],
  ) {
    setYouthDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [key]: value } : draft,
      ),
    );
  }

  function handleAddYouth() {
    setYouthDrafts((prev) => [...prev, createEmptyTeamDraft("Under")]);
  }

  function handleRemoveYouth(index: number) {
    setYouthDrafts((prev) => prev.filter((_, draftIndex) => draftIndex !== index));
  }

  async function handleSave() {
    if (!seniorDraft.name.trim() || !seniorDraft.category.trim()) {
      Alert.alert(
        "Errore",
        "Inserisci nome e categoria della prima squadra.",
      );
      return;
    }

    if (
      youthDrafts.some(
        (draft) => !draft.name.trim() || !draft.category.trim(),
      )
    ) {
      Alert.alert(
        "Errore",
        "Inserisci nome e categoria per ogni squadra giovanile.",
      );
      return;
    }

    setIsSaving(true);

    try {
      let savedSeniorId = seniorTeam?.id ?? null;

      if (seniorTeam) {
        const savedSenior = await upsertClubTeam({
          ...seniorTeam,
          category: seniorDraft.category.trim(),
          name: seniorDraft.name.trim(),
        });
        savedSeniorId = savedSenior.id;
      } else {
        const savedSenior = await upsertClubTeam({
          category: seniorDraft.category.trim(),
          city: null,
          club_id: clubId,
          inherited: false,
          logo_url: null,
          name: seniorDraft.name.trim(),
          parent_team_id: null,
          region: null,
          sort_order: 0,
          team_type: "senior",
        });
        savedSeniorId = savedSenior.id;
      }

      if (savedSeniorId) {
        await upsertClubTeamProfile(toTeamProfileDetails(savedSeniorId, seniorDraft));
      }

      const keptYouthIds = new Set(
        youthDrafts
          .filter((draft) => draft.existingId)
          .map((draft) => draft.existingId!),
      );

      const removedYouth = youthTeams.filter((team) => !keptYouthIds.has(team.id));
      for (const removed of removedYouth) {
        await deleteClubTeam(removed.id);
      }

      for (const draft of youthDrafts) {
        if (!draft.existingId) {
          continue;
        }

        const existing = youthTeams.find((team) => team.id === draft.existingId);

        if (!existing) {
          continue;
        }

        const savedTeam = await upsertClubTeam({
          ...existing,
          category: draft.category.trim(),
          name: draft.name.trim(),
        });
        await upsertClubTeamProfile(toTeamProfileDetails(savedTeam.id, draft));
      }

      const newYouthDrafts = youthDrafts.filter((draft) => !draft.existingId);
      const newYouth = newYouthDrafts.map((draft, index) => ({
        category: draft.category.trim(),
        city: seniorTeam?.city ?? null,
        club_id: clubId,
        inherited: true,
        logo_url: seniorTeam?.logo_url ?? null,
        name: draft.name.trim(),
        parent_team_id: savedSeniorId,
        region: seniorTeam?.region ?? null,
        sort_order: youthTeams.length + index + 1,
        team_type: "youth" as const,
      }));

      if (newYouth.length > 0) {
        const insertedTeams = await insertClubTeams(newYouth);
        await Promise.all(
          insertedTeams.map((team, index) =>
            upsertClubTeamProfile(
              toTeamProfileDetails(team.id, newYouthDrafts[index]),
            ),
          ),
        );
      }

      onSaved();
    } catch {
      Alert.alert("Errore", "Impossibile salvare le squadre");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Gestisci squadre"
      visible={visible}
    >
      <SectionCard title="Prima squadra">
        <Input
          label="Nome squadra *"
          onChangeText={(value) => updateSeniorDraft("name", value)}
          placeholder="Es. Prima squadra"
          value={seniorDraft.name}
        />
        <SelectField
          label="Categoria *"
          onChange={(value) => updateSeniorDraft("category", value)}
          options={SENIOR_CATEGORY_OPTIONS}
          placeholder="Seleziona la categoria"
          value={seniorDraft.category}
        />
        <Input
          label="Competizione"
          onChangeText={(value) => updateSeniorDraft("competitionName", value)}
          placeholder="Es. Serie D Girone B"
          value={seniorDraft.competitionName}
        />
        <Input
          label="Girone"
          onChangeText={(value) => updateSeniorDraft("groupName", value)}
          placeholder="Es. Girone B"
          value={seniorDraft.groupName}
        />
        <Input
          keyboardType="number-pad"
          label="Giocatori promossi"
          onChangeText={(value) => updateSeniorDraft("promotedPlayersCount", value)}
          placeholder="0"
          value={seniorDraft.promotedPlayersCount}
        />
        <Input
          label="Media squadra"
          onChangeText={(value) => updateSeniorDraft("mediaUrls", value)}
          placeholder="URL separati da virgola"
          value={seniorDraft.mediaUrls}
        />
      </SectionCard>

      <SectionCard title="Settore giovanile">
        {youthDrafts.length === 0 ? (
          <AppText variant="bodySm" color="muted">
            Nessuna squadra giovanile
          </AppText>
        ) : (
          youthDrafts.map((draft, index) => (
            <View
              key={draft.existingId ?? `new-${index}`}
              style={styles.youthCard}
            >
              <Input
                label={`Nome squadra ${index + 1} *`}
                onChangeText={(value) => updateYouthDraft(index, "name", value)}
                placeholder="Es. Under 17"
                value={draft.name}
              />
              <SelectField
                label="Categoria *"
                onChange={(value) => updateYouthDraft(index, "category", value)}
                options={YOUTH_CATEGORY_OPTIONS}
                placeholder="Seleziona categoria"
                value={draft.category}
              />
              <Input
                label="Competizione"
                onChangeText={(value) =>
                  updateYouthDraft(index, "competitionName", value)
                }
                placeholder="Es. Campionato Regionale"
                value={draft.competitionName}
              />
              <Input
                label="Girone"
                onChangeText={(value) => updateYouthDraft(index, "groupName", value)}
                placeholder="Es. Girone A"
                value={draft.groupName}
              />
              <Input
                keyboardType="number-pad"
                label="Giocatori promossi"
                onChangeText={(value) =>
                  updateYouthDraft(index, "promotedPlayersCount", value)
                }
                placeholder="0"
                value={draft.promotedPlayersCount}
              />
              <Input
                label="Media squadra"
                onChangeText={(value) => updateYouthDraft(index, "mediaUrls", value)}
                placeholder="URL separati da virgola"
                value={draft.mediaUrls}
              />
              <Button
                label="Rimuovi squadra"
                onPress={() => handleRemoveYouth(index)}
                size="sm"
                variant="danger"
              />
            </View>
          ))
        )}
        <Button
          label="Aggiungi squadra giovanile"
          onPress={handleAddYouth}
          size="sm"
          variant="secondary"
        />
      </SectionCard>
    </EditModalShell>
  );
}

function createEmptyTeamDraft(name: string): TeamDraft {
  return {
    category: "",
    competitionName: "",
    existingId: null,
    groupName: "",
    mediaUrls: "",
    name,
    promotedPlayersCount: "",
    recentResults: [],
  };
}

function buildTeamDraft(
  team: ClubTeam | undefined,
  clubName: string,
  profiles: Record<string, ClubTeamProfileDetails>,
): TeamDraft {
  if (!team) {
    return createEmptyTeamDraft(clubName || "Prima squadra");
  }

  const profile = profiles[team.id];

  return {
    category: team.category,
    competitionName: profile?.competition_name ?? "",
    existingId: team.id,
    groupName: profile?.group_name ?? "",
    mediaUrls: toDelimitedString(profile?.media_urls ?? []),
    name: team.name || clubName,
    promotedPlayersCount:
      profile?.promoted_players_count ? String(profile.promoted_players_count) : "",
    recentResults: profile?.recent_results ?? [],
  };
}

function toTeamProfileDetails(
  teamId: string,
  draft: TeamDraft,
): ClubTeamProfileDetails {
  const promotedPlayersCount = Number.parseInt(draft.promotedPlayersCount, 10);

  return {
    competition_name: draft.competitionName.trim() || null,
    group_name: draft.groupName.trim() || null,
    media_urls: fromDelimitedString(draft.mediaUrls),
    promoted_players_count: Number.isNaN(promotedPlayersCount)
      ? 0
      : promotedPlayersCount,
    recent_results: draft.recentResults,
    team_id: teamId,
  };
}

function fromDelimitedString(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toDelimitedString(values: string[]) {
  return values.join(", ");
}

const styles = StyleSheet.create({
  youthCard: {
    borderBottomColor: "#00000014",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[12],
    paddingBottom: spacing[16],
  },
});
