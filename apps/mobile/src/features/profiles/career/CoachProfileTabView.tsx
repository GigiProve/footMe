import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getCoachMediaTagMeta } from "../coach-media";
import { withDefaultProfileAvatar } from "../profile-avatar";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { CoachCareerTabContent } from "./CoachCareerTabContent";
import { CoachInfoTab } from "./CoachInfoTab";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";
import type { CoachGroupedExperience } from "./coach-career-grouping";

type CoachProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onAddExperience: () => void;
  onDeleteExperience: (group: CoachGroupedExperience) => void;
  onEditExperience: (group: CoachGroupedExperience) => void;
  onEdit: (section: EditSection) => void;
  onManageMedia: () => void;
};

export function CoachProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onDeleteExperience,
  onEditExperience,
  onEdit,
  onManageMedia,
}: CoachProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  const mediaItems = useMemo<MediaContentItem[]>(() => {
    const profileMediaItems = completeProfile.coachProfile?.media_items ?? [];
    const technicalVideoUrl = completeProfile.coachProfile?.technical_video_url;

    if (profileMediaItems.length > 0) {
      return profileMediaItems.map((item) => {
        const tagMeta = getCoachMediaTagMeta(item.tag);

        return {
          commentCount: 0,
          comments: [],
          description: item.description ?? "",
          id: item.id,
          isFeatured: item.is_featured,
          isLiked: false,
          isSaved: false,
          likeCount: 0,
          tag: { icon: tagMeta.icon, label: tagMeta.label },
          thumbnailUrl:
            item.thumbnail_url ??
            withDefaultProfileAvatar(completeProfile.profile.avatar_url),
          type: item.type,
          videoUrl: item.type === "video" ? item.url : undefined,
        } satisfies MediaContentItem;
      });
    }

    if (!technicalVideoUrl) {
      return [];
    }

    return [
      {
        commentCount: 0,
        comments: [],
        description: "Video tecnico del profilo.",
        id: "coach-technical-video",
        isFeatured: false,
        isLiked: false,
        isSaved: false,
        likeCount: 0,
        tag: { icon: "play-circle-outline", label: "Video tecnico" },
        thumbnailUrl: withDefaultProfileAvatar(completeProfile.profile.avatar_url),
        type: "video",
        videoUrl: technicalVideoUrl,
      },
    ];
  }, [
    completeProfile.coachProfile?.media_items,
    completeProfile.coachProfile?.technical_video_url,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "career" ? (
        <CoachCareerTabContent
          coachCareerEntries={completeProfile.coachCareerEntries}
          coachDirectorCareerEntries={completeProfile.coachDirectorCareerEntries}
          coachPlayerCareerEntries={completeProfile.coachPlayerCareerEntries}
          isOwner={isOwner}
          onAdd={onAddExperience}
          onDelete={onDeleteExperience}
          onEdit={onEditExperience}
        />
      ) : activeTab === "media" ? (
        <MediaTabContent
          authorName={completeProfile.profile.full_name}
          initialItems={mediaItems}
          mode={isOwner ? "owner" : "visitor"}
          onAddContentPress={isOwner ? onManageMedia : undefined}
        />
      ) : (
        <CoachInfoTab
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
