/**
 * Corpo a tab del Master Profile Staff tecnico (REV-PROF-06).
 *
 * È la stessa architettura dei Master Profile Calciatore e Allenatore, con i
 * dati professionali dello Staff tecnico: tre tab — Carriera, Media, Dettagli
 * — dietro a un unico stato, così il cambio tab non rifà nessuna richiesta e
 * non ricostruisce il modello di carriera. La tab "Profilo" non esiste.
 *
 * Il percorso professionale attivo vive qui e non dentro la tab Carriera:
 * "Percorsi aggiuntivi" nei Dettagli deve poterlo cambiare e portare l'utente
 * sulla Carriera, restando nello stesso profilo.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { withDefaultProfileAvatar } from "../profile-avatar";
import { getStaffMediaTagMeta } from "../staff-media";
import { trackProfileEvent } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import { useTaggedMediaItems } from "../../content/use-tagged-content";
import type { PublicContact } from "../master/PublicContactsList";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";
import { StaffCareerTab } from "./StaffCareerTab";
import { StaffDetailsTab } from "./StaffDetailsTab";
import {
  buildStaffProfileCareer,
  type StaffCareerPath,
} from "./staff-career-model";

const PROFILE_TYPE = "staff";

type StaffProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  /** Punto d'ingresso esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  onManageMedia: () => void;
  /** Apre la pagina società, quando la società ne ha una. */
  onOpenClub?: (clubId: string) => void;
};

export function StaffProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onManageMedia,
  onOpenClub,
}: StaffProfileTabViewProps) {
  // Carriera è la tab iniziale, come negli altri Master Profile.
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");
  const [careerPath, setCareerPath] = useState<StaffCareerPath>("staff");
  const viewerMode = isOwner ? "owner" : "visitor";

  const career = useMemo(
    () =>
      buildStaffProfileCareer({
        coachEntries: completeProfile.staffCoachCareerEntries,
        playerEntries: completeProfile.staffPlayerCareerEntries,
        staffEntries: completeProfile.staffCareerEntries,
      }),
    [
      completeProfile.staffCareerEntries,
      completeProfile.staffCoachCareerEntries,
      completeProfile.staffPlayerCareerEntries,
    ],
  );

  useEffect(() => {
    if (activeTab === "career") {
      trackProfileEvent("career_section_viewed", {
        profileType: PROFILE_TYPE,
        viewerMode,
      });
    }
  }, [activeTab, viewerMode]);

  function handleTabChange(tab: ProfileTab) {
    setActiveTab(tab);
    trackProfileEvent("profile_tab_changed", {
      profileType: PROFILE_TYPE,
      tab,
      viewerMode,
    });
  }

  function handlePathChange(path: StaffCareerPath) {
    setCareerPath(path);
    trackProfileEvent("career_mode_changed", {
      careerMode: path,
      profileType: PROFILE_TYPE,
      viewerMode,
    });
  }

  /** Dai Dettagli alla Carriera, sul percorso scelto e senza lasciare il profilo. */
  function handleOpenCareerPath(path: StaffCareerPath) {
    trackProfileEvent("profile_additional_career_tapped", {
      careerMode: path,
      profileType: PROFILE_TYPE,
      viewerMode,
    });
    setCareerPath(path);
    setActiveTab("career");
  }

  function handleContactPress(contact: PublicContact) {
    trackProfileEvent("public_contact_tapped", {
      contactType: contact.type,
      profileType: PROFILE_TYPE,
      viewerMode,
    });
  }

  function handleOpenClub(clubId: string) {
    trackProfileEvent("profile_club_tapped", {
      profileType: PROFILE_TYPE,
      viewerMode,
    });
    onOpenClub?.(clubId);
  }

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} fill onTabChange={handleTabChange} />

      {activeTab === "career" ? (
        <StaffCareerTab
          career={career}
          isOwner={isOwner}
          onAddExperience={
            isOwner && onAddExperience
              ? () => {
                  trackProfileEvent("profile_career_add_tapped", {
                    profileType: PROFILE_TYPE,
                    viewerMode: "owner",
                  });
                  onAddExperience();
                }
              : undefined
          }
          onPathChange={handlePathChange}
          path={careerPath}
          playerCareerEntries={completeProfile.staffPlayerCareerEntries}
        />
      ) : activeTab === "media" ? (
        <StaffMediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onManageMedia={onManageMedia}
        />
      ) : (
        <StaffDetailsTab
          career={career}
          completeProfile={completeProfile}
          isOwner={isOwner}
          onContactPress={handleContactPress}
          onOpenCareerPath={handleOpenCareerPath}
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
 * Stesso componente Media degli altri Master Profile: filtri, griglia, viewer
 * e salvataggio sono quelli già approvati, cambia solo la copy degli empty
 * state. Nessuna galleria specifica per lo Staff tecnico.
 */
function StaffMediaTab({
  completeProfile,
  isOwner,
  onManageMedia,
}: {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onManageMedia: () => void;
}) {
  const viewerMode = isOwner ? "owner" : "visitor";
  const { onOpenTaggedItem, taggedItems } = useTaggedMediaItems(
    completeProfile.profile.id,
  );

  const mediaItems = useMemo<MediaContentItem[]>(() => {
    const profileMediaItems = completeProfile.staffProfile?.media_items ?? [];

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
  }, [
    completeProfile.staffProfile?.media_items,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <MediaTabContent
      authorName={completeProfile.profile.full_name}
      emptyCtaLabel="Aggiungi contenuto"
      emptyDescription={
        isOwner
          ? "Aggiungi foto e video delle tue esperienze nello staff tecnico."
          : "Questo profilo non ha ancora pubblicato foto o video."
      }
      emptyTitle={isOwner ? "Racconta il tuo lavoro" : "Nessun contenuto disponibile"}
      filtersEnabled
      initialItems={[...mediaItems, ...taggedItems]}
      mode={isOwner ? "owner" : "visitor"}
      // Nessuna CTA di aggiunta al Visitor, né in griglia né a contenuti vuoti.
      onAddContentPress={
        isOwner
          ? () => {
              trackProfileEvent("profile_media_add_tapped", {
                profileType: PROFILE_TYPE,
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
          profileType: PROFILE_TYPE,
          viewerMode,
        })
      }
      onItemOpened={(item) =>
        trackProfileEvent("profile_media_opened", {
          mediaType: item.type,
          profileType: PROFILE_TYPE,
          viewerMode,
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
