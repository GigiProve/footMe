/**
 * Corpo a tab del Master Profile Dirigente (REV-PROF-09).
 *
 * È la stessa architettura dei Master Profile Calciatore, Allenatore e Staff
 * tecnico, con i dati professionali del Dirigente: tre tab — Carriera, Media,
 * Dettagli — dietro a un unico stato, così il cambio tab non rifà nessuna
 * richiesta e non ricostruisce il modello di carriera. La vecchia tab "Info"
 * non esiste più e non c'è nessuna tab "Profilo".
 *
 * Owner e Visitor passano entrambi di qui: la struttura, i dati e l'ordine
 * delle sezioni sono gli stessi, cambiano soltanto le azioni autorizzate. Non
 * esistono un corpo Owner e un corpo Visitor separati.
 *
 * Il percorso professionale attivo vive qui e non dentro la tab Carriera:
 * "Percorsi aggiuntivi" nei Dettagli deve poterlo cambiare e portare l'utente
 * sulla Carriera, restando nello stesso profilo.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useTaggedMediaItems } from "../../content/use-tagged-content";
import { getDirectorMediaTagMeta } from "../director-media";
import { withDefaultProfileAvatar } from "../profile-avatar";
import { trackProfileEvent } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { PublicContact } from "../master/PublicContactsList";
import { DirectorCareerTab } from "./DirectorCareerTab";
import { DirectorDetailsTab } from "./DirectorDetailsTab";
import {
  buildDirectorProfileCareer,
  type DirectorCareerPath,
} from "./director-career-model";
import {
  MediaTabContent,
  type MediaContentItem,
  type MediaLinkedTarget,
} from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

const PROFILE_TYPE = "director";

type DirectorProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner?: boolean;
  /** Punto d'ingresso esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  /** Persiste l'eliminazione di un contenuto. Solo Owner. */
  onDeleteMedia?: (itemId: string) => void;
  /** Apre il modulo canonico di modifica del profilo. Solo Owner. */
  onEditProfile?: () => void;
  /** Apre l'editor di un contenuto già pubblicato. Solo Owner. */
  onEditMedia?: (itemId: string) => void;
  onManageMedia?: () => void;
  /** Apre il profilo o la società collegati a un contenuto. */
  onOpenLinkedTarget?: (target: MediaLinkedTarget) => void;
  /** Apre la pagina società, quando la società ne ha una. */
  onOpenClub?: (clubId: string) => void;
  /** Persiste il cambio di evidenza di un contenuto. Solo Owner. */
  onToggleMediaFeatured?: (itemId: string) => void;
};

export function DirectorProfileTabView({
  completeProfile,
  isOwner = false,
  onAddExperience,
  onDeleteMedia,
  onEditProfile,
  onEditMedia,
  onManageMedia,
  onOpenLinkedTarget,
  onOpenClub,
  onToggleMediaFeatured,
}: DirectorProfileTabViewProps) {
  // Carriera è la tab iniziale, come negli altri Master Profile.
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");
  const [careerPath, setCareerPath] = useState<DirectorCareerPath>("director");
  const viewerMode = isOwner ? "owner" : "visitor";

  const career = useMemo(
    () =>
      buildDirectorProfileCareer({
        directorProfile: completeProfile.directorProfile,
      }),
    [completeProfile.directorProfile],
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

  function handlePathChange(path: DirectorCareerPath) {
    setCareerPath(path);
    trackProfileEvent("career_mode_changed", {
      careerMode: path,
      profileType: PROFILE_TYPE,
      viewerMode,
    });
  }

  /** Dai Dettagli alla Carriera, sul percorso scelto e senza lasciare il profilo. */
  function handleOpenCareerPath(path: DirectorCareerPath) {
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
        <DirectorCareerTab
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
        />
      ) : activeTab === "media" ? (
        <DirectorMediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onDeleteMedia={onDeleteMedia}
          onEditMedia={onEditMedia}
          onManageMedia={onManageMedia}
          onOpenLinkedTarget={onOpenLinkedTarget}
          onToggleMediaFeatured={onToggleMediaFeatured}
        />
      ) : (
        <DirectorDetailsTab
          career={career}
          completeProfile={completeProfile}
          isOwner={isOwner}
          onContactPress={handleContactPress}
          onEditProfile={isOwner ? onEditProfile : undefined}
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
 * state. Nessuna galleria specifica del Dirigente.
 *
 * Evidenza ed eliminazione restano persistite — era già così prima della
 * review — perché la griglia condivisa delega al chiamante quando riceve i
 * due handler. Al Visitor non arriva nessuno dei due.
 */
function DirectorMediaTab({
  completeProfile,
  isOwner,
  onDeleteMedia,
  onEditMedia,
  onManageMedia,
  onOpenLinkedTarget,
  onToggleMediaFeatured,
}: {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onDeleteMedia?: (itemId: string) => void;
  onEditMedia?: (itemId: string) => void;
  onManageMedia?: () => void;
  onOpenLinkedTarget?: (target: MediaLinkedTarget) => void;
  onToggleMediaFeatured?: (itemId: string) => void;
}) {
  const viewerMode = isOwner ? "owner" : "visitor";
  const { onOpenTaggedItem, taggedItems } = useTaggedMediaItems(
    completeProfile.profile.id,
  );

  const mediaItems = useMemo<MediaContentItem[]>(() => {
    const profileMediaItems = completeProfile.directorProfile?.media_items ?? [];

    return profileMediaItems.map((item) => {
      const tagMeta = getDirectorMediaTagMeta(item.tag);

      return {
        commentCount: 0,
        comments: [],
        description: item.description ?? "",
        id: item.id,
        isFeatured: item.is_featured,
        isLiked: false,
        isSaved: false,
        likeCount: 0,
        linkedTargets: item.linked_targets,
        ...(tagMeta ? { tag: { icon: tagMeta.icon, label: tagMeta.label } } : {}),
        thumbnailUrl:
          item.thumbnail_url ??
          (item.type === "image"
            ? item.url
            : withDefaultProfileAvatar(completeProfile.profile.avatar_url)),
        type: item.type,
        videoUrl: item.type === "video" ? item.url : undefined,
      } satisfies MediaContentItem;
    });
  }, [
    completeProfile.directorProfile?.media_items,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <MediaTabContent
      authorName={completeProfile.profile.full_name}
      emptyCtaLabel="Pubblica contenuto"
      emptyDescription={
        isOwner
          ? "Pubblica contenuti istituzionali, scouting o club per completare il profilo dirigente."
          : "Questo profilo non ha ancora pubblicato contenuti."
      }
      emptyTitle="Nessun contenuto"
      filtersEnabled
      initialItems={[...mediaItems, ...taggedItems]}
      mode={isOwner ? "owner" : "visitor"}
      // Nessuna CTA di pubblicazione al Visitor, né in griglia né a contenuti vuoti.
      onAddContentPress={
        isOwner && onManageMedia
          ? () => {
              trackProfileEvent("profile_media_add_tapped", {
                profileType: PROFILE_TYPE,
                viewerMode: "owner",
              });
              onManageMedia();
            }
          : undefined
      }
      onDeleteContentPress={isOwner ? onDeleteMedia : undefined}
      onEditContentPress={
        isOwner && onEditMedia
          ? (itemId) => {
              if (itemId) {
                onEditMedia(itemId);
              }
            }
          : undefined
      }
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
      onOpenLinkedTarget={onOpenLinkedTarget}
      onOpenTaggedItem={onOpenTaggedItem}
      onToggleFeaturedPress={isOwner ? onToggleMediaFeatured : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
