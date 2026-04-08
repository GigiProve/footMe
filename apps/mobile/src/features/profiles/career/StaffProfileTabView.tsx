import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import type { GroupedExperience } from "./career-grouping";
import { MediaTabContent } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";
import { StaffCareerTabContent } from "./StaffCareerTabContent";
import { StaffInfoTab } from "./StaffInfoTab";
import type { StaffGroupedExperience } from "./staff-career-grouping";

type StaffProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onAddExperience: () => void;
  onDeleteExperience: (group: StaffGroupedExperience, section: "technical" | "coach") => void;
  onDeletePlayerExperience: (group: GroupedExperience) => void;
  onEdit: (section: EditSection) => void;
  onEditExperience: () => void;
};

export function StaffProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onDeleteExperience,
  onDeletePlayerExperience,
  onEdit,
  onEditExperience,
}: StaffProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "career" ? (
        <StaffCareerTabContent
          isOwner={isOwner}
          onAdd={onAddExperience}
          onDelete={onDeleteExperience}
          onDeletePlayerEntry={onDeletePlayerExperience}
          onEdit={(group, section) => {
            onEditExperience();
            void group;
            void section;
          }}
          staffCareerEntries={completeProfile.staffCareerEntries}
          staffCoachCareerEntries={completeProfile.staffCoachCareerEntries}
          staffPlayerCareerEntries={completeProfile.staffPlayerCareerEntries}
        />
      ) : activeTab === "media" ? (
        <MediaTabContent
          authorName={completeProfile.profile.full_name}
          initialItems={[]}
          mode={isOwner ? "owner" : "visitor"}
          onAddContentPress={isOwner ? () => {} : undefined}
        />
      ) : (
        <StaffInfoTab
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
