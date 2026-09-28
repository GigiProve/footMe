import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getStaffMediaTagMeta } from "../staff-media";
import { withDefaultProfileAvatar } from "../profile-avatar";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { useTaggedMediaItems } from "../../content/use-tagged-content";
import type { GroupedExperience } from "./career-grouping";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

/**
 * Lo Staff mantiene la terza tab "Info": "Dettagli" è il nome introdotto dal
 * Master Profile del Calciatore (REV-PROF-01 §5) e riguarda solo quello.
 */
const STAFF_TABS: readonly { label: string; value: ProfileTab }[] = [
  { label: "Carriera", value: "career" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];
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
  onManageMedia: () => void;
};

export function StaffProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onDeleteExperience,
  onDeletePlayerExperience,
  onEdit,
  onEditExperience,
  onManageMedia,
}: StaffProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");
  const { onOpenTaggedItem, taggedItems } = useTaggedMediaItems(
    completeProfile.profile.id,
  );

  const mediaItems = useMemo<MediaContentItem[]>(() => {
    const profileMediaItems = completeProfile.staffProfile?.media_items ?? [];

    if (profileMediaItems.length > 0) {
      return profileMediaItems.map((item) => {
        const tagMeta = getStaffMediaTagMeta(item.tag);

        return {
          commentCount: 0,
          comments: [],
          description: item.description ?? "",
          id: item.id,
          isFeatured: item.is_featured,
          isLiked: false,
          isSaved: false,
          likeCount: 0,
          ...(tagMeta ? { tag: { icon: tagMeta.icon, label: tagMeta.label } } : {}),
          thumbnailUrl:
            item.thumbnail_url ??
            withDefaultProfileAvatar(completeProfile.profile.avatar_url),
          type: item.type,
          videoUrl: item.type === "video" ? item.url : undefined,
        } satisfies MediaContentItem;
      });
    }

    return [];
  }, [
    completeProfile.staffProfile?.media_items,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <View style={styles.container}>
      <ProfileTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={STAFF_TABS}
      />

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
          emptyDescription={
            isOwner
              ? "Aggiungi foto e video per mostrare il lavoro svolto sul campo."
              : "Questo profilo non ha ancora pubblicato contenuti."
          }
          authorName={completeProfile.profile.full_name}
          initialItems={[...mediaItems, ...taggedItems]}
          mode={isOwner ? "owner" : "visitor"}
          onAddContentPress={isOwner ? onManageMedia : undefined}
          onOpenTaggedItem={onOpenTaggedItem}
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
