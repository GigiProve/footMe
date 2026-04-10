import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
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
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "career" ? (
        <AgentCareerTabContent
          completeProfile={completeProfile}
          isOwner={isOwner}
          onEdit={() => onEdit("agentProfile")}
        />
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
  container: {
    flex: 1,
  },
});
