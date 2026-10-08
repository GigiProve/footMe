/**
 * Master Profile Tifoso (REV-PROF-19).
 *
 * Una sola superficie per Owner e Visitor: stessa route, stessi componenti,
 * stessi dati pubblici. Le differenze sono tre e solo tre — quali azioni
 * compaiono, quali dati privati restano fuori dal payload, quali permessi ha
 * chi guarda — e arrivano tutte da `capabilities`, non dal fatto che il
 * profilo sia stato aperto dalla voce Profilo della bottom navigation.
 *
 * Struttura: header condiviso dei Master Profile, tre tab — Tribuna, Media,
 * Info — e nient'altro. "Salvati" e "Seguiti" non vivono più in coda al
 * profilo: sono aree personali con una schermata propria, raggiungibili dal
 * menu azioni, e i loro dati non sono stati toccati.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { TabBar, type TabBarItem } from "../../ui";
import { FanProfileHeader } from "./profile-screen-components";
import { trackProfileEvent } from "./profile-analytics";
import type { CompleteProfessionalProfile } from "./profile-service";
import {
  FAN_TRIBUNA_PAGE_SIZE,
  fetchFanTribunaFeed,
  type FanTribunaKind,
  type FanTribunaPost,
} from "./fan-tribuna-service";
import { FanCreateTribunaModal } from "./fan/fan-composers";
import { FanCreateSheet, type FanCreateAction } from "./fan/FanCreateSheet";
import { FanInfoTab } from "./fan/FanInfoTab";
import { FanMediaTab } from "./fan/FanMediaTab";
import { FanTribunaTab } from "./fan/FanTribunaTab";
import {
  buildFanCapabilities,
  buildFanCategoryChips,
  buildFanInterestChips,
  dedupeFanContentById,
  sortFanTribunaPosts,
} from "./fan/fan-master-profile";
import type { FanContentRef } from "./fan/fan-media-tab-service";
import { useFanMediaFeed } from "./fan/use-fan-media-feed";
import {
  fetchPublicFanProfile,
  type PublicFanProfile,
} from "./fan/fan-public-profile-service";

export type FanProfileTab = "tribuna" | "media" | "info";

/** Tre tab, in quest'ordine. Bacheca non esiste più. */
const FAN_TABS: readonly TabBarItem<FanProfileTab>[] = [
  { label: "Tribuna", value: "tribuna" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];

/** Tipi che la Tribuna interroga. Foto e video hanno la loro tab. */
const TRIBUNA_QUERY_KINDS: readonly FanTribunaKind[] = [
  "opinion",
  "poll",
  "formation",
  "proposal",
];

/**
 * Riferimento a un contenuto nel suo dettaglio canonico. Vive accanto alla
 * sorgente della tab Media, che REV-PROF-20 condivide con l'hub Modifica
 * profilo; qui resta esportato perché è il tipo della prop `onOpenContent`.
 */
export type { FanContentRef };

type FanProfileViewProps = {
  completeProfile: CompleteProfessionalProfile;
  /** Deep link a una tab specifica. Senza, si apre la Tribuna. */
  initialTab?: FanProfileTab;
  isFollowed?: boolean;
  isMessaging?: boolean;
  mode: "owner" | "visitor";
  /** "Messaggio": la stessa conversazione del dominio Messaggi. */
  onContactPress?: () => void;
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  /**
   * Gestione della squadra del cuore, solo Owner. Porta al modulo
   * "Squadra del cuore" di REV-PROF-20: è l'unico punto in cui la relazione
   * si modifica, e questa vista non ne apre un secondo.
   */
  onManageFavoriteClub?: () => void;
  onMorePress?: () => void;
  /** Apre il dettaglio condiviso del contenuto. */
  onOpenContent?: (ref: FanContentRef) => void;
  onOpenFavoriteClub?: (clubId: string) => void;
  onSharePress?: () => void;
  /**
   * Il "+" della Home apre il bottom sheet "Crea" già esistente: è un punto
   * di accesso, non un composer proprio.
   */
  shouldOpenComposer?: boolean;
  viewerProfileId?: string | null;
};

export function FanProfileView({
  completeProfile,
  initialTab = "tribuna",
  isFollowed = false,
  isMessaging = false,
  mode,
  onContactPress,
  onEditProfilePress,
  onFollowPress,
  onManageFavoriteClub,
  onMorePress,
  onOpenContent,
  onOpenFavoriteClub,
  onSharePress,
  shouldOpenComposer = false,
  viewerProfileId,
}: FanProfileViewProps) {
  const profile = completeProfile.profile;
  const isOwner = mode === "owner";
  const [activeTab, setActiveTab] = useState<FanProfileTab>(initialTab);

  const capabilities = useMemo(
    () =>
      buildFanCapabilities({
        isOwner,
        isViewerAuthenticated: Boolean(viewerProfileId),
      }),
    [isOwner, viewerProfileId],
  );

  // ─── Info pubbliche ──────────────────────────────────────────────────────
  const [publicProfile, setPublicProfile] = useState<PublicFanProfile | null>(
    null,
  );
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const loadPublicProfile = useCallback(async () => {
    setIsLoadingInfo(true);
    setInfoError(null);

    try {
      setPublicProfile(await fetchPublicFanProfile(profile.id));
    } catch {
      // Una cache valida non viene sovrascritta con un array vuoto: l'errore
      // è locale e il resto della pagina resta quello che era.
      setInfoError("Non è stato possibile caricare le informazioni. Riprova.");
    } finally {
      setIsLoadingInfo(false);
    }
  }, [profile.id]);

  // ─── Tribuna ─────────────────────────────────────────────────────────────
  const [tribunaPosts, setTribunaPosts] = useState<FanTribunaPost[]>([]);
  const [isLoadingTribuna, setIsLoadingTribuna] = useState(true);
  const [isLoadingMoreTribuna, setIsLoadingMoreTribuna] = useState(false);
  const [hasMoreTribuna, setHasMoreTribuna] = useState(false);
  const [tribunaError, setTribunaError] = useState<string | null>(null);

  const loadTribuna = useCallback(async () => {
    setIsLoadingTribuna(true);
    setTribunaError(null);

    try {
      const page = await fetchFanTribunaFeed(profile.id, viewerProfileId, {
        kinds: TRIBUNA_QUERY_KINDS,
        limit: FAN_TRIBUNA_PAGE_SIZE,
        offset: 0,
      });
      setTribunaPosts(sortFanTribunaPosts(dedupeFanContentById(page)));
      setHasMoreTribuna(page.length === FAN_TRIBUNA_PAGE_SIZE);
    } catch {
      setTribunaError("Non è stato possibile caricare la Tribuna. Riprova.");
      trackProfileEvent("profile_tab_load_failed", {
        profileType: "fan",
        tab: "tribuna",
        viewerMode: mode,
      });
    } finally {
      setIsLoadingTribuna(false);
    }
  }, [mode, profile.id, viewerProfileId]);

  const loadMoreTribuna = useCallback(async () => {
    if (isLoadingMoreTribuna || !hasMoreTribuna) {
      return;
    }

    setIsLoadingMoreTribuna(true);

    try {
      const page = await fetchFanTribunaFeed(profile.id, viewerProfileId, {
        kinds: TRIBUNA_QUERY_KINDS,
        limit: FAN_TRIBUNA_PAGE_SIZE,
        offset: tribunaPosts.length,
      });
      // Dedup per id: una pubblicazione durante lo scroll può far
      // ricomparire la coda della pagina precedente.
      setTribunaPosts((current) =>
        sortFanTribunaPosts(dedupeFanContentById([...current, ...page])),
      );
      setHasMoreTribuna(page.length === FAN_TRIBUNA_PAGE_SIZE);
    } catch {
      setTribunaError("Non è stato possibile caricare la Tribuna. Riprova.");
    } finally {
      setIsLoadingMoreTribuna(false);
    }
  }, [
    hasMoreTribuna,
    isLoadingMoreTribuna,
    profile.id,
    tribunaPosts.length,
    viewerProfileId,
  ]);

  // ─── Media ───────────────────────────────────────────────────────────────
  const onMediaLoadFailed = useCallback(() => {
    trackProfileEvent("profile_tab_load_failed", {
      profileType: "fan",
      tab: "media",
      viewerMode: mode,
    });
  }, [mode]);

  const media = useFanMediaFeed({
    onLoadFailed: onMediaLoadFailed,
    profileId: profile.id,
    viewerProfileId,
  });

  useEffect(() => {
    void loadPublicProfile();
  }, [loadPublicProfile]);

  useEffect(() => {
    void loadTribuna();
  }, [loadTribuna]);

  // ─── Creazione ───────────────────────────────────────────────────────────
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<FanTribunaKind | null>(null);
  const hasHandledComposeIntent = useRef(false);

  useEffect(() => {
    if (
      !shouldOpenComposer ||
      !capabilities.canCreateContent ||
      hasHandledComposeIntent.current
    ) {
      return;
    }

    hasHandledComposeIntent.current = true;
    setIsCreateSheetOpen(true);
  }, [capabilities.canCreateContent, shouldOpenComposer]);

  function handleOpenCreateSheet() {
    trackProfileEvent("fan_create_sheet_opened", {
      profileType: "fan",
      viewerMode: mode,
    });
    setIsCreateSheetOpen(true);
  }

  function handleCloseCreateSheet() {
    trackProfileEvent("fan_create_sheet_closed", {
      profileType: "fan",
      viewerMode: mode,
    });
    setIsCreateSheetOpen(false);
  }

  function handleSelectCreateAction(action: FanCreateAction) {
    trackProfileEvent("fan_create_option_selected", {
      contentType: action,
      profileType: "fan",
      viewerMode: mode,
    });
    // Le quattro azioni aprono i composer già esistenti: REV-PROF-19 non ne
    // scrive nessuno nuovo, cambia solo da dove si entra.
    setComposerKind(action);
  }

  /**
   * Dopo una pubblicazione il contenuto entra nella tab che gli compete — mai
   * in tutt'e due — e la lista viene ricaricata dal backend, così la
   * posizione segue l'ordinamento reale invece di un'ipotesi del client.
   */
  function handleCreated(post: FanTribunaPost) {
    setComposerKind(null);

    if (post.kind === "photo") {
      setActiveTab("media");
      media.reload();
      return;
    }

    setActiveTab("tribuna");
    void loadTribuna();
  }

  function handleTabChange(tab: FanProfileTab) {
    setActiveTab(tab);
    trackProfileEvent("profile_tab_changed", {
      profileType: "fan",
      tab,
      viewerMode: mode,
    });
  }

  function handleOpenContent(ref: FanContentRef) {
    trackProfileEvent("fan_content_opened", {
      profileType: "fan",
      viewerMode: mode,
    });
    onOpenContent?.(ref);
  }

  function handleOpenFavoriteClub(clubId: string) {
    trackProfileEvent("fan_favorite_club_tapped", {
      profileType: "fan",
      viewerMode: mode,
    });
    onOpenFavoriteClub?.(clubId);
  }

  const favoriteClub = publicProfile?.favoriteClub ?? null;
  const footballInterests = useMemo(
    () => buildFanInterestChips(publicProfile?.footballTypes),
    [publicProfile?.footballTypes],
  );
  const followedCategories = useMemo(
    () => buildFanCategoryChips(publicProfile?.followedCategories),
    [publicProfile?.followedCategories],
  );

  return (
    <View style={styles.root} testID="fan-profile-view">
      <FanProfileHeader
        avatarUrl={profile.avatar_url}
        coverImageUrl={profile.cover_url}
        fullName={profile.full_name}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        mode={mode}
        onEditProfilePress={
          capabilities.canEditProfile ? onEditProfilePress : undefined
        }
        onFollowPress={capabilities.canFollow ? onFollowPress : undefined}
        onMessagePress={capabilities.canMessage ? onContactPress : undefined}
        onMorePress={onMorePress}
        onSecondaryRolePress={
          favoriteClub && onOpenFavoriteClub
            ? () => handleOpenFavoriteClub(favoriteClub.id)
            : undefined
        }
        onSharePress={capabilities.canShare ? onSharePress : undefined}
        /*
          La squadra del cuore compare solo se esiste una relazione valida e
          pubblicabile: al Visitor non si mostra mai "Da completare".
        */
        secondaryRole={favoriteClub?.name}
      />

      <TabBar
        active={activeTab}
        fill
        items={FAN_TABS}
        onChange={handleTabChange}
        testID="fan-profile-tabs"
      />

      {activeTab === "tribuna" ? (
        <FanTribunaTab
          canCreateContent={capabilities.canCreateContent}
          errorMessage={tribunaError}
          hasMore={hasMoreTribuna}
          isLoading={isLoadingTribuna}
          isLoadingMore={isLoadingMoreTribuna}
          isOwner={isOwner}
          onCreatePress={handleOpenCreateSheet}
          onLoadMore={() => {
            void loadMoreTribuna();
          }}
          onOpenPost={(post) =>
            handleOpenContent({ contentType: "fan_tribuna", postId: post.id })
          }
          onRetry={() => {
            void loadTribuna();
          }}
          posts={tribunaPosts}
        />
      ) : activeTab === "media" ? (
        <FanMediaTab
          errorMessage={media.errorMessage}
          hasMore={media.hasMore}
          isLoading={media.isLoading}
          isLoadingMore={media.isLoadingMore}
          isOwner={isOwner}
          items={media.items}
          onAddContentPress={
            capabilities.canCreateContent
              ? () => setComposerKind("photo")
              : undefined
          }
          onLoadMore={media.loadMore}
          onOpenContent={handleOpenContent}
          onRetry={media.reload}
          profileName={profile.full_name}
          viewerMode={mode}
        />
      ) : (
        <FanInfoTab
          errorMessage={infoError}
          favoriteClub={favoriteClub}
          followedCategories={followedCategories}
          footballInterests={footballInterests}
          isLoading={isLoadingInfo}
          isOwner={isOwner}
          onEditProfilePress={
            capabilities.canEditProfile ? onEditProfilePress : undefined
          }
          onManageFavoriteClub={
            capabilities.canEditProfile ? onManageFavoriteClub : undefined
          }
          onOpenFavoriteClub={
            onOpenFavoriteClub ? handleOpenFavoriteClub : undefined
          }
          onRetry={() => {
            void loadPublicProfile();
          }}
        />
      )}

      <FanCreateSheet
        onClose={handleCloseCreateSheet}
        onSelect={handleSelectCreateAction}
        visible={isCreateSheetOpen}
      />
      <FanCreateTribunaModal
        kind={composerKind}
        onClose={() => setComposerKind(null)}
        onCreated={handleCreated}
        profileId={profile.id}
        publisherName={profile.full_name}
        userId={viewerProfileId ?? profile.id}
        visible={composerKind !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
