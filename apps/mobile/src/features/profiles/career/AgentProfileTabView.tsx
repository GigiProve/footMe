import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { AgentCareerTabContent } from "./AgentCareerTabContent";
import { AgentInfoTab } from "./AgentInfoTab";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

type AgentProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

export function AgentProfileTabView({
  completeProfile,
  isOwner,
  onEdit,
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
        <View style={styles.emptyState}>
          <AppText variant="titleSm">Media in arrivo</AppText>
          <AppText color="secondary" variant="bodySm">
            Questa tab resta visibile per allineamento al design, ma il media model
            agente non è ancora disponibile.
          </AppText>
        </View>
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
  emptyState: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
    paddingBottom: spacing[28],
  },
});
