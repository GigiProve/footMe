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

import { colors, spacing } from "../../theme/tokens";
import { Button, TabBar, type TabBarItem } from "../../ui";
import { FanProfileHeader } from "./profile-screen-components";
import { trackProfileEvent } from "./profile-analytics";
import type { CompleteProfessionalProfile } from "./profile-service";
import { MediaTabContent } from "./career/MediaTabContent";
import type { MediaContentItem } from "./career/MediaTabContent";
import { ProfileSectionError } from "./master/ProfileSectionBlock";
import {
  FAN_TRIBUNA_PAGE_SIZE,
  fetchFanTribunaFeed,
  type FanTribunaKind,
  type FanTribunaPost,
} from "./fan-tribuna-service";
import {
  FanCreateTribunaModal,
  FanFavoriteTeamModal,
} from "./fan/fan-composers";
import { FanCreateSheet, type FanCreateAction } from "./fan/FanCreateSheet";
import { FanInfoTab } from "./fan/FanInfoTab";
import { FanTribunaTab } from "./fan/FanTribunaTab";
import {
  buildFanCapabilities,
  buildFanCategoryChips,
  buildFanInterestChips,
  dedupeFanContentById,
  sortFanTribunaPosts,
} from "./fan/fan-master-profile";
import {
  FAN_MEDIA_INITIAL_CURSOR,
  fetchFanMediaPage,
  type FanMediaCursor,
} from "./fan/fan-media-tab-service";
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

/** Riferimento a un contenuto nel suo dettaglio canonico. */
export type FanContentRef = {
  contentType: string;
  postId: string;
};

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
  const [mediaItems, setMediaItems] = useState<MediaContentItem[]>([]);
  const [mediaCursor, setMediaCursor] = useState<FanMediaCursor>(
    FAN_MEDIA_INITIAL_CURSOR,
  );
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);
  const [hasMoreMedia, setHasMoreMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    setMediaError(null);

    try {
      const page = await fetchFanMediaPage(
        profile.id,
        viewerProfileId,
        FAN_MEDIA_INITIAL_CURSOR,
      );
      setMediaItems(page.items);
      setMediaCursor(page.cursor);
      setHasMoreMedia(page.hasMore);
    } catch {
      setMediaError("Non è stato possibile caricare i contenuti. Riprova.");
      trackProfileEvent("profile_tab_load_failed", {
        profileType: "fan",
        tab: "media",
        viewerMode: mode,
      });
    } finally {
      setIsLoadingMedia(false);
    }
  }, [mode, profile.id, viewerProfileId]);

  const loadMoreMedia = useCallback(async () => {
    if (isLoadingMoreMedia || !hasMoreMedia) {
      return;
    }

    setIsLoadingMoreMedia(true);

    try {
      const page = await fetchFanMediaPage(
        profile.id,
        viewerProfileId,
        mediaCursor,
      );
      setMediaItems((current) =>
        dedupeFanContentById([...current, ...page.items]),
      );
      setMediaCursor(page.cursor);
      setHasMoreMedia(page.hasMore);
    } catch {
      setMediaError("Non è stato possibile caricare i contenuti. Riprova.");
    } finally {
      setIsLoadingMoreMedia(false);
    }
  }, [
    hasMoreMedia,
    isLoadingMoreMedia,
    mediaCursor,
    profile.id,
    viewerProfileId,
  ]);

  useEffect(() => {
    void loadPublicProfile();
  }, [loadPublicProfile]);

  useEffect(() => {
    void loadTribuna();
  }, [loadTribuna]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  // ─── Creazione ───────────────────────────────────────────────────────────
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<FanTribunaKind | null>(null);
  const [isFavoriteTeamModalOpen, setIsFavoriteTeamModalOpen] = useState(false);
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
      void loadMedia();
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
          errorMessage={mediaError}
          hasMore={hasMoreMedia}
          isLoading={isLoadingMedia}
          isLoadingMore={isLoadingMoreMedia}
          isOwner={isOwner}
          items={mediaItems}
          onAddContentPress={
            capabilities.canCreateContent
              ? () => setComposerKind("photo")
              : undefined
          }
          onLoadMore={() => {
            void loadMoreMedia();
          }}
          onOpenContent={handleOpenContent}
          onRetry={() => {
            void loadMedia();
          }}
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
            capabilities.canEditProfile
              ? () => setIsFavoriteTeamModalOpen(true)
              : undefined
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
      {capabilities.canEditProfile ? (
        <FanFavoriteTeamModal
          favoriteClubId={favoriteClub?.id ?? null}
          favoriteTeamName={
            favoriteClub?.name ?? publicProfile?.legacyFavoriteTeamName ?? ""
          }
          onClose={() => setIsFavoriteTeamModalOpen(false)}
          onSaved={() => {
            setIsFavoriteTeamModalOpen(false);
            void loadPublicProfile();
          }}
          profileId={profile.id}
          visible={isFavoriteTeamModalOpen}
        />
      ) : null}
    </View>
  );
}

/**
 * Tab Media: il componente condiviso consolidato da REV-PROF-12, senza
 * nessuna griglia specifica per il Tifoso. Le thumbnail non portano l'icona
 * Salvati — quella vive nel dettaglio contenuto, dove è sempre stata.
 */
function FanMediaTab({
  errorMessage,
  hasMore,
  isLoading,
  isLoadingMore,
  isOwner,
  items,
  onAddContentPress,
  onLoadMore,
  onOpenContent,
  onRetry,
  profileName,
  viewerMode,
}: {
  errorMessage: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOwner: boolean;
  items: MediaContentItem[];
  onAddContentPress?: () => void;
  onLoadMore: () => void;
  onOpenContent: (ref: FanContentRef) => void;
  onRetry: () => void;
  profileName: string;
  viewerMode: "owner" | "visitor";
}) {
  if (isLoading) {
    return <MediaGridSkeleton />;
  }

  if (errorMessage) {
    return (
      <View style={styles.mediaState}>
        <ProfileSectionError
          message={errorMessage}
          onRetry={onRetry}
          testID="fan-media-error"
        />
      </View>
    );
  }

  return (
    <MediaTabContent
      authorName={profileName}
      emptyCtaLabel="Pubblica foto o video"
      emptyDescription={
        isOwner
          ? "Pubblica foto e video del calcio che vivi."
          : "Questo Tifoso non ha ancora pubblicato foto o video."
      }
      emptyTitle="Nessun contenuto Media"
      filtersEnabled
      footer={
        hasMore ? (
          <Button
            accessibilityLabel="Mostra altri contenuti Media"
            disabled={isLoadingMore}
            label={isLoadingMore ? "Caricamento…" : "Mostra altri"}
            onPress={onLoadMore}
            size="sm"
            variant="secondary"
          />
        ) : null
      }
      initialItems={items}
      mode={viewerMode}
      onAddContentPress={onAddContentPress}
      onFilterChange={(filter) =>
        trackProfileEvent("media_filter_changed", {
          mediaFilter: filter,
          profileType: "fan",
          viewerMode,
        })
      }
      onItemOpened={(item) =>
        trackProfileEvent("profile_media_opened", {
          mediaType: item.type,
          profileType: "fan",
          viewerMode,
        })
      }
      onOpenTaggedItem={onOpenContent}
    />
  );
}

const MEDIA_SKELETON_CELLS = [0, 1, 2, 3, 4, 5];

/** Celle della stessa misura delle thumbnail: nessun salto all'arrivo. */
function MediaGridSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento dei contenuti in corso"
      accessibilityRole="progressbar"
      style={styles.mediaSkeletonGrid}
      testID="fan-media-skeleton"
    >
      {MEDIA_SKELETON_CELLS.map((cell) => (
        <View key={cell} style={styles.mediaSkeletonCell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaSkeletonCell: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    // Stessa geometria di `MediaTabContent`: tre colonne, 1px di gronda.
    marginBottom: 2,
    width: "33.3333%",
  },
  mediaSkeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: spacing[12],
  },
  mediaState: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  root: {
    flex: 1,
  },
});
