import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  fetchRepresentedPlayers,
  setRepresentationVisibility,
  type RepresentedPlayer,
} from "../../relationships/agent-representation-service";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { colors, spacing } from "../../../theme/tokens";
import { Avatar, Button, EmptyState, ListItem } from "../../../ui";
import { AppText } from "../../../ui/AppText/AppText";
import { AgentMediaTabContent } from "./AgentMediaTabContent";
import { AgentCareerTabContent } from "./AgentCareerTabContent";
import { AgentInfoTab } from "./AgentInfoTab";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

type AgentProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onDeleteMedia: (itemId: string) => void;
  onEdit: (section: EditSection) => void;
  onEditMedia: (itemId: string) => void;
  onManageMedia: () => void;
};

export function AgentProfileTabView({
  completeProfile,
  isOwner,
  onDeleteMedia,
  onEdit,
  onEditMedia,
  onManageMedia,
}: AgentProfileTabViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");
  const [representedPlayers, setRepresentedPlayers] = useState<RepresentedPlayer[]>([]);
  const [isLoadingRepresented, setIsLoadingRepresented] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const agentProfileId = completeProfile.profile.id;

  const loadRepresentedPlayers = useCallback(async () => {
    setIsLoadingRepresented(true);
    try {
      const data = await fetchRepresentedPlayers(agentProfileId);
      setRepresentedPlayers(data);
    } catch {
      setRepresentedPlayers([]);
    } finally {
      setIsLoadingRepresented(false);
    }
  }, [agentProfileId]);

  useEffect(() => {
    void loadRepresentedPlayers();
  }, [loadRepresentedPlayers]);

  function handlePlayerPress(playerProfileId: string) {
    router.push(`/profile/${playerProfileId}` as never);
  }

  async function handleToggleVisibility(player: RepresentedPlayer) {
    const next = player.visibility === "public" ? "private" : "public";
    try {
      setTogglingId(player.id);
      await setRepresentationVisibility(player.id, next);
      await loadRepresentedPlayers();
    } catch {
      // Best-effort; keep the current list on failure.
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "career" ? (
        <>
          <AgentCareerTabContent
            completeProfile={completeProfile}
            isOwner={isOwner}
            onEdit={() => onEdit("agentProfile")}
          />
          <View style={styles.assistitiSection}>
            <AppText style={styles.assistitiTitle} variant="titleSm">
              Assistiti
            </AppText>
            {isLoadingRepresented ? (
              <AppText color="secondary" variant="bodySm">
                Caricamento assistiti...
              </AppText>
            ) : representedPlayers.length > 0 ? (
              representedPlayers.map((player, index) => (
                <ListItem
                  key={player.id}
                  left={
                    <Avatar
                      name={player.player_full_name ?? ""}
                      size="md"
                      uri={player.player_avatar_url}
                    />
                  }
                  onPress={() => handlePlayerPress(player.player_profile_id)}
                  right={
                    isOwner ? (
                      <Button
                        disabled={togglingId === player.id}
                        label={
                          player.visibility === "public"
                            ? "Pubblico"
                            : "Privato"
                        }
                        onPress={() => handleToggleVisibility(player)}
                        size="sm"
                        variant="outline"
                      />
                    ) : undefined
                  }
                  showDivider={index < representedPlayers.length - 1}
                  title={player.player_full_name ?? "Giocatore"}
                />
              ))
            ) : (
              <EmptyState
                description="I giocatori accettati appariranno qui."
                icon="people-outline"
                title="Nessun assistito"
              />
            )}
          </View>
        </>
      ) : activeTab === "media" ? (
        <AgentMediaTabContent
          authorAvatarUrl={completeProfile.profile.avatar_url}
          authorName={completeProfile.profile.full_name}
          initialItems={completeProfile.agentProfile?.media_items ?? []}
          mode={isOwner ? "owner" : "visitor"}
          onAddContentPress={isOwner ? onManageMedia : undefined}
          onDeleteContentPress={isOwner ? onDeleteMedia : undefined}
          onEditContentPress={isOwner ? onEditMedia : undefined}
        />
      ) : (
        <AgentInfoTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onEdit={onEdit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  assistitiSection: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  assistitiTitle: {
    marginBottom: spacing[8],
  },
  container: {
    flex: 1,
  },
});
