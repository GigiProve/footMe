import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { sortPlayerExperiencesBySeason, toPlayerExperienceForm } from "../player-sports";
import { withDefaultProfileAvatar } from "../profile-avatar";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import type { GroupedExperience } from "./career-grouping";
import { CareerTabContent } from "./CareerTabContent";
import { InfoTab } from "./InfoTab";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";
import { getPlayerMediaTagMeta } from "../player-media";

type ProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onAddExperience: () => void;
  onDeleteExperience: (group: GroupedExperience) => void;
  onEdit: (section: EditSection) => void;
  onManageMedia: () => void;
};

export function ProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onDeleteExperience,
  onEdit,
  onManageMedia,
}: ProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  const playerExperienceEntries = useMemo(
    () =>
      sortPlayerExperiencesBySeason(
        (completeProfile.playerCareerEntries ?? []).map((entry) =>
          toPlayerExperienceForm(entry),
        ),
      ),
    [completeProfile.playerCareerEntries],
  );

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "career" ? (
        <CareerTabContent
          entries={playerExperienceEntries}
          isOwner={isOwner}
          onAdd={onAddExperience}
          onDelete={onDeleteExperience}
          onEdit={onAddExperience}
        />
      ) : activeTab === "media" ? (
        <MediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onManageMedia={onManageMedia}
        />
      ) : (
        <InfoTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onEdit={onEdit}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Media tab
// ---------------------------------------------------------------------------

function MediaTab({
  completeProfile,
  isOwner,
  onManageMedia,
}: {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onManageMedia: () => void;
}) {
  const mediaItems = useMemo<MediaContentItem[]>(() => {
    const profileMediaItems = completeProfile.playerProfile?.media_items ?? [];

    if (profileMediaItems.length > 0) {
      return profileMediaItems.map((item) => {
        const tagMeta = getPlayerMediaTagMeta(item.tag);

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

    const highlightVideoUrl = completeProfile.playerProfile?.highlight_video_url;

    return highlightVideoUrl
      ? [
          {
            commentCount: 0,
            comments: [],
            description: "Video highlights del profilo.",
            id: "profile-highlight-video",
            isFeatured: false,
            isLiked: false,
            isSaved: false,
            likeCount: 0,
            tag: { icon: "play-circle-outline", label: "Highlights" },
            thumbnailUrl: withDefaultProfileAvatar(completeProfile.profile.avatar_url),
            type: "video",
            videoUrl: highlightVideoUrl,
          },
        ]
      : [];
  }, [
    completeProfile.playerProfile?.media_items,
    completeProfile.playerProfile?.highlight_video_url,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <MediaTabContent
      authorName={completeProfile.profile.full_name}
      initialItems={mediaItems}
      mode={isOwner ? "owner" : "visitor"}
      onAddContentPress={isOwner ? onManageMedia : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
