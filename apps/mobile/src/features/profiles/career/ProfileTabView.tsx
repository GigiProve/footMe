/**
 * Corpo a tab del Master Profile Calciatore (REV-PROF-01 §5, §10, §37).
 *
 * Owner e Visitor condividono questa stessa architettura: cambiano solo le
 * azioni disponibili, non la struttura. Le tre tab restano montate dietro allo
 * stesso stato, quindi il passaggio da una all'altra non rifà nessuna
 * richiesta e non ricostruisce il modello di carriera.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { toPlayerExperienceForm } from "../player-sports";
import { withDefaultProfileAvatar } from "../profile-avatar";
import { trackProfileEvent } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import { useTaggedMediaItems } from "../../content/use-tagged-content";
import type { PublicContact } from "../master/PublicContactsList";
import { CareerTabContent } from "./CareerTabContent";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { buildPlayerCareerView } from "./player-career-model";
import { PlayerDetailsTab } from "./PlayerDetailsTab";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";
import { getPlayerMediaTagMeta } from "../player-media";

type ProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onManageMedia: () => void;
};

export function ProfileTabView({
  completeProfile,
  isOwner,
  onManageMedia,
}: ProfileTabViewProps) {
  // Carriera è la tab iniziale (§5).
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  const careerView = useMemo(
    () =>
      buildPlayerCareerView(
        (completeProfile.playerCareerEntries ?? []).map((entry) =>
          toPlayerExperienceForm(entry),
        ),
      ),
    [completeProfile.playerCareerEntries],
  );

  useEffect(() => {
    if (activeTab === "career") {
      trackProfileEvent("career_section_viewed", {
        profileType: "player",
        viewerMode: isOwner ? "owner" : "visitor",
      });
    }
  }, [activeTab, isOwner]);

  function handleTabChange(tab: ProfileTab) {
    setActiveTab(tab);
    trackProfileEvent("profile_tab_changed", {
      profileType: "player",
      tab,
      viewerMode: isOwner ? "owner" : "visitor",
    });
  }

  function handleContactPress(contact: PublicContact) {
    trackProfileEvent("public_contact_tapped", {
      contactType: contact.type,
      profileType: "player",
      viewerMode: isOwner ? "owner" : "visitor",
    });
  }

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "career" ? (
        <CareerTabContent
          isOwner={isOwner}
          onMetricChange={(metric) =>
            trackProfileEvent("career_metric_changed", {
              careerMetric: metric,
              profileType: "player",
              viewerMode: isOwner ? "owner" : "visitor",
            })
          }
          view={careerView}
        />
      ) : activeTab === "media" ? (
        <MediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onManageMedia={onManageMedia}
        />
      ) : (
        <PlayerDetailsTab
          careerView={careerView}
          completeProfile={completeProfile}
          onContactPress={handleContactPress}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab Media
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
  const { onOpenTaggedItem, taggedItems } = useTaggedMediaItems(
    completeProfile.profile.id,
  );

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
      emptyCtaLabel="Aggiungi contenuto"
      emptyDescription={
        isOwner
          ? "Condividi foto e video del tuo percorso sportivo."
          : "Questo profilo non ha ancora pubblicato contenuti."
      }
      emptyTitle="Nessun contenuto ancora"
      filtersEnabled
      initialItems={[...mediaItems, ...taggedItems]}
      mode={isOwner ? "owner" : "visitor"}
      onAddContentPress={
        isOwner
          ? () => {
              trackProfileEvent("profile_media_add_tapped", {
                profileType: "player",
                viewerMode: "owner",
              });
              onManageMedia();
            }
          : undefined
      }
      onFilterChange={(filter) =>
        trackProfileEvent("media_filter_changed", {
          mediaFilter: filter,
          profileType: "player",
          viewerMode: isOwner ? "owner" : "visitor",
        })
      }
      onItemOpened={(item) =>
        trackProfileEvent("profile_media_opened", {
          mediaType: item.type,
          profileType: "player",
          viewerMode: isOwner ? "owner" : "visitor",
        })
      }
      onOpenTaggedItem={onOpenTaggedItem}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
