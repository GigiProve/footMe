/**
 * Corpo a tab del Master Profile Allenatore (REV-PROF-03).
 *
 * È la stessa architettura del Master Profile Calciatore, con i dati
 * professionali dell'Allenatore: tre tab — Carriera, Media, Dettagli — dietro
 * a un unico stato, così il cambio tab non rifà nessuna richiesta e non
 * ricostruisce il modello di carriera. La tab "Profilo" non esiste più: i suoi
 * contenuti vivono in Dettagli, una volta sola.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getCoachMediaTagMeta } from "../coach-media";
import { withDefaultProfileAvatar } from "../profile-avatar";
import { trackProfileEvent } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import { useTaggedMediaItems } from "../../content/use-tagged-content";
import type { PublicContact } from "../master/PublicContactsList";
import { buildCoachCareerView } from "./coach-career-model";
import { CoachCareerTab, type CoachCareerMode } from "./CoachCareerTab";
import { CoachDetailsTab } from "./CoachDetailsTab";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

type CoachProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  /** Punto d'ingresso esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  onManageMedia: () => void;
  /** Apre la pagina società, quando la società ne ha una. */
  onOpenClub?: (clubId: string) => void;
};

export function CoachProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onManageMedia,
  onOpenClub,
}: CoachProfileTabViewProps) {
  // Carriera è la tab iniziale, come nel Master Profile Calciatore.
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");
  const viewerMode = isOwner ? "owner" : "visitor";

  const careerView = useMemo(
    () => buildCoachCareerView(completeProfile.coachCareerEntries ?? []),
    [completeProfile.coachCareerEntries],
  );

  useEffect(() => {
    if (activeTab === "career") {
      trackProfileEvent("career_section_viewed", {
        profileType: "coach",
        viewerMode,
      });
    }
  }, [activeTab, viewerMode]);

  function handleTabChange(tab: ProfileTab) {
    setActiveTab(tab);
    trackProfileEvent("profile_tab_changed", {
      profileType: "coach",
      tab,
      viewerMode,
    });
  }

  function handleCareerModeChange(careerMode: CoachCareerMode) {
    trackProfileEvent("career_mode_changed", {
      careerMode,
      profileType: "coach",
      viewerMode,
    });
  }

  function handleContactPress(contact: PublicContact) {
    trackProfileEvent("public_contact_tapped", {
      contactType: contact.type,
      profileType: "coach",
      viewerMode,
    });
  }

  function handleOpenClub(clubId: string) {
    trackProfileEvent("profile_club_tapped", {
      profileType: "coach",
      viewerMode,
    });
    onOpenClub?.(clubId);
  }

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} fill onTabChange={handleTabChange} />

      {activeTab === "career" ? (
        <CoachCareerTab
          careerView={careerView}
          isOwner={isOwner}
          onAddExperience={
            isOwner && onAddExperience
              ? () => {
                  trackProfileEvent("career_empty_cta_tapped", {
                    profileType: "coach",
                    viewerMode: "owner",
                  });
                  onAddExperience();
                }
              : undefined
          }
          onModeChange={handleCareerModeChange}
          playerCareerEntries={completeProfile.coachPlayerCareerEntries ?? []}
        />
      ) : activeTab === "media" ? (
        <CoachMediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onManageMedia={onManageMedia}
        />
      ) : (
        <CoachDetailsTab
          careerView={careerView}
          completeProfile={completeProfile}
          isOwner={isOwner}
          onContactPress={handleContactPress}
          onOpenClub={onOpenClub ? handleOpenClub : undefined}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab Media
// ---------------------------------------------------------------------------

/**
 * Stesso componente Media del Master Profile Calciatore: filtri, griglia,
 * viewer e salvataggio sono quelli già approvati, cambia solo la copy degli
 * empty state. Nessuna griglia specifica per l'Allenatore.
 */
function CoachMediaTab({
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
    const profileMediaItems = completeProfile.coachProfile?.media_items ?? [];

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
          ...(tagMeta ? { tag: { icon: tagMeta.icon, label: tagMeta.label } } : {}),
          thumbnailUrl:
            item.thumbnail_url ??
            withDefaultProfileAvatar(completeProfile.profile.avatar_url),
          type: item.type,
          videoUrl: item.type === "video" ? item.url : undefined,
        } satisfies MediaContentItem;
      });
    }

    /*
      Il video tecnico non ha più un campo pubblico dedicato nei Dettagli: se
      esiste entra qui, come un contenuto fra gli altri, invece di essere
      mostrato due volte in due forme diverse.
    */
    const technicalVideoUrl = completeProfile.coachProfile?.technical_video_url;

    return technicalVideoUrl
      ? [
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
            thumbnailUrl: withDefaultProfileAvatar(
              completeProfile.profile.avatar_url,
            ),
            type: "video",
            videoUrl: technicalVideoUrl,
          } satisfies MediaContentItem,
        ]
      : [];
  }, [
    completeProfile.coachProfile?.media_items,
    completeProfile.coachProfile?.technical_video_url,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <MediaTabContent
      authorName={completeProfile.profile.full_name}
      emptyCtaLabel="Aggiungi contenuto"
      emptyDescription={
        isOwner
          ? "Aggiungi foto e video per mostrare il tuo lavoro sul campo."
          : "Questo allenatore non ha ancora pubblicato contenuti."
      }
      emptyTitle="Nessun contenuto"
      filtersEnabled
      initialItems={[...mediaItems, ...taggedItems]}
      mode={isOwner ? "owner" : "visitor"}
      onAddContentPress={
        isOwner
          ? () => {
              trackProfileEvent("profile_media_add_tapped", {
                profileType: "coach",
                viewerMode: "owner",
              });
              onManageMedia();
            }
          : undefined
      }
      onEditContentPress={isOwner ? onManageMedia : undefined}
      onFilterChange={(filter) =>
        trackProfileEvent("media_filter_changed", {
          mediaFilter: filter,
          profileType: "coach",
          viewerMode: isOwner ? "owner" : "visitor",
        })
      }
      onItemOpened={(item) =>
        trackProfileEvent("profile_media_opened", {
          mediaType: item.type,
          profileType: "coach",
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
