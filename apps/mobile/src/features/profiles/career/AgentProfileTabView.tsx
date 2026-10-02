/**
 * Corpo a tab del Master Profile Procuratore (REV-PROF-13).
 *
 * È la stessa architettura dei Master Profile Calciatore, Allenatore, Staff
 * tecnico e Dirigente: tre tab — Carriera, Media, Dettagli — dietro a un unico
 * stato, così il cambio tab non rifà nessuna richiesta. Le vecchie tab "Info"
 * e "Opportunità" non esistono più: il posizionamento è finito nei Dettagli,
 * gli assistiti nella Carriera.
 *
 * Owner e Visitor passano entrambi di qui e vedono la stessa proiezione
 * pubblica: struttura, dati e ordine delle sezioni sono gli stessi, cambiano
 * soltanto le azioni autorizzate. Il portfolio assistiti viene letto una volta
 * sola, con la RPC pubblica, e condiviso fra Carriera e Informazioni rapide —
 * così il numero mostrato nell'header coincide sempre con l'elenco.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useTaggedMediaItems } from "../../content/use-tagged-content";
import {
  fetchAgentPublicAssistiti,
  type AgentPublicAssistito,
} from "../../relationships/agent-representation-service";
import { getAgentMediaTagMeta } from "../agent-media";
import { withDefaultProfileAvatar } from "../profile-avatar";
import { trackProfileEvent } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { PublicContact } from "../master/PublicContactsList";
import { AgentCareerTab } from "./AgentCareerTab";
import { AgentDetailsTab } from "./AgentDetailsTab";
import { buildAgentProfileCareer, type AgentCareerPath } from "./agent-career-model";
import {
  MediaTabContent,
  type MediaContentItem,
  type MediaLinkedTarget,
} from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

const PROFILE_TYPE = "agent";

/**
 * Tab iniziale, con la rimappatura dei nomi legacy.
 *
 * "Info" e "Opportunità" erano tab reali di questo profilo fino a
 * REV-PROF-13. Nessuna route del repository porta oggi un parametro di tab,
 * quindi non c'è un deep link rotto da riparare; questa funzione esiste perché
 * un link vecchio che dovesse arrivare atterri sul contenuto giusto —
 * posizionamento nei Dettagli, opportunità professionali in Carriera — invece
 * che su una tab inesistente.
 */
export function resolveAgentInitialTab(
  requested: string | null | undefined,
): ProfileTab {
  switch (requested) {
    case "info":
    case "details":
      return "details";
    case "media":
      return "media";
    case "career":
    case "opportunities":
    default:
      return "career";
  }
}

type AgentProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  /** Tab di partenza, anche nei nomi legacy. Default: Carriera. */
  initialTab?: string;
  isOwner?: boolean;
  /** Entry point esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  /** Persiste l'eliminazione di un contenuto. Solo Owner. */
  onDeleteMedia?: (itemId: string) => void;
  /** Apre l'editor di un contenuto già pubblicato. Solo Owner. */
  onEditMedia?: (itemId: string) => void;
  /** Apre il modulo canonico di modifica del profilo. Solo Owner. */
  onEditProfile?: () => void;
  onManageMedia?: () => void;
  /** Entry point esistente alla gestione assistiti. Solo Owner. */
  onManageAssistiti?: () => void;
  /** Apre il portfolio completo degli assistiti. */
  onOpenAllAssistiti?: () => void;
  onOpenAssistito?: (playerProfileId: string) => void;
  /** Apre il profilo o la società collegati a un contenuto. */
  onOpenLinkedTarget?: (target: MediaLinkedTarget) => void;
  /** Persiste il cambio di evidenza di un contenuto. Solo Owner. */
  onToggleMediaFeatured?: (itemId: string) => void;
};

export function AgentProfileTabView({
  completeProfile,
  initialTab,
  isOwner = false,
  onAddExperience,
  onDeleteMedia,
  onEditMedia,
  onEditProfile,
  onManageAssistiti,
  onManageMedia,
  onOpenAllAssistiti,
  onOpenAssistito,
  onOpenLinkedTarget,
  onToggleMediaFeatured,
}: AgentProfileTabViewProps) {
  // Carriera è la tab iniziale, come negli altri Master Profile.
  const [activeTab, setActiveTab] = useState<ProfileTab>(() =>
    resolveAgentInitialTab(initialTab),
  );
  const [careerPath, setCareerPath] = useState<AgentCareerPath>("agent");
  const viewerMode = isOwner ? "owner" : "visitor";

  const career = useMemo(
    () =>
      buildAgentProfileCareer({
        agentCareerEntries: completeProfile.agentCareerEntries,
        agentProfile: completeProfile.agentProfile,
      }),
    [completeProfile.agentCareerEntries, completeProfile.agentProfile],
  );

  const { assistiti, hasFailed, isLoading, reload } = usePublicAssistiti(
    completeProfile.profile.id,
    viewerMode,
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

  function handlePathChange(path: AgentCareerPath) {
    setCareerPath(path);
    trackProfileEvent("career_mode_changed", {
      careerMode: path,
      profileType: PROFILE_TYPE,
      viewerMode,
    });
  }

  /** Dai Dettagli alla Carriera, sul percorso scelto e senza lasciare il profilo. */
  function handleOpenCareerPath(path: AgentCareerPath) {
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

  function handleOpenAssistito(playerProfileId: string) {
    trackProfileEvent("agent_assistito_tapped", {
      profileType: PROFILE_TYPE,
      viewerMode,
    });
    onOpenAssistito?.(playerProfileId);
  }

  function handleOpenAllAssistiti() {
    trackProfileEvent("agent_assistiti_see_all_tapped", {
      profileType: PROFILE_TYPE,
      viewerMode,
    });
    onOpenAllAssistiti?.();
  }

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} fill onTabChange={handleTabChange} />

      {activeTab === "career" ? (
        <AgentCareerTab
          assistiti={assistiti}
          assistitiFailed={hasFailed}
          career={career}
          isAssistitiLoading={isLoading}
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
          onManageAssistiti={isOwner ? onManageAssistiti : undefined}
          onOpenAllAssistiti={onOpenAllAssistiti ? handleOpenAllAssistiti : undefined}
          onOpenAssistito={onOpenAssistito ? handleOpenAssistito : undefined}
          onPathChange={handlePathChange}
          onRetryAssistiti={reload}
          path={careerPath}
        />
      ) : activeTab === "media" ? (
        <AgentMediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onDeleteMedia={onDeleteMedia}
          onEditMedia={onEditMedia}
          onManageMedia={onManageMedia}
          onOpenLinkedTarget={onOpenLinkedTarget}
          onToggleMediaFeatured={onToggleMediaFeatured}
        />
      ) : (
        <AgentDetailsTab
          career={career}
          completeProfile={completeProfile}
          isOwner={isOwner}
          onContactPress={handleContactPress}
          onEditProfile={isOwner ? onEditProfile : undefined}
          onOpenCareerPath={handleOpenCareerPath}
        />
      )}
    </View>
  );
}

/**
 * Portfolio pubblico del procuratore.
 *
 * Una sola lettura per profilo aperto, condivisa da Carriera e Informazioni
 * rapide: due fetch separate finirebbero per mostrare un conteggio diverso
 * dall'elenco. Un errore non blocca il profilo — la Carriera mostra l'errore
 * locale con "Riprova" e le altre tab restano navigabili.
 */
function usePublicAssistiti(
  agentProfileId: string,
  viewerMode: "owner" | "visitor",
) {
  const [assistiti, setAssistiti] = useState<AgentPublicAssistito[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setHasFailed(false);

    fetchAgentPublicAssistiti(agentProfileId)
      .then((rows) => {
        if (isActive) {
          setAssistiti(rows);
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setAssistiti([]);
        setHasFailed(true);
        trackProfileEvent("profile_tab_load_failed", {
          profileType: PROFILE_TYPE,
          tab: "career",
          viewerMode,
        });
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [agentProfileId, reloadToken, viewerMode]);

  return { assistiti, hasFailed, isLoading, reload };
}

// ---------------------------------------------------------------------------
// Tab Media
// ---------------------------------------------------------------------------

/**
 * Stesso componente Media degli altri Master Profile: filtri, griglia, viewer
 * e salvataggio sono quelli già approvati, cambia solo la copy degli empty
 * state. Nessuna galleria specifica del Procuratore — `AgentMediaTabContent`
 * era proprio quella UI parallela che REV-PROF-13 chiede di non avere.
 *
 * REV-PROF-12 vale di conseguenza: la griglia condivisa non ha bookmark sulle
 * thumbnail, e il "Salva" resta nel dettaglio contenuto.
 */
function AgentMediaTab({
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
    const profileMediaItems = completeProfile.agentProfile?.media_items ?? [];

    return profileMediaItems.map((item) => {
      const tagMeta = getAgentMediaTagMeta(item.tag);

      return {
        commentCount: 0,
        comments: [],
        description: item.description ?? "",
        id: item.id,
        /* I contenuti del Procuratore non hanno ancora un'evidenza persistita. */
        isFeatured: false,
        isLiked: false,
        isSaved: false,
        likeCount: 0,
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
    completeProfile.agentProfile?.media_items,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <MediaTabContent
      authorName={completeProfile.profile.full_name}
      emptyCtaLabel="Pubblica contenuto"
      emptyDescription={
        isOwner
          ? "Pubblica foto e video per costruire un portfolio professionale credibile e aggiornato."
          : "Questo Procuratore non ha ancora contenuti nel portfolio Media."
      }
      emptyTitle="Nessun contenuto pubblicato"
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
