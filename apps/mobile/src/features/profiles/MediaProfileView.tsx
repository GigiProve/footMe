/**
 * Master Profile Media/Creator (REV-PROF-21).
 *
 * Una sola superficie per Owner e Visitor: stessa route, stessi componenti,
 * stesso serializer pubblico, stesse query. Le differenze sono tre e solo tre
 * — quali azioni compaiono, che cosa si può creare, quali dati privati
 * restano fuori dal payload — e arrivano tutte da `capabilities`, che il
 * backend calcola e il client non deduce.
 *
 * Il profilo rappresenta la realtà editoriale, non la persona che la
 * amministra: nome, residenza e avatar del proprietario non sono un fallback
 * pubblico e non compaiono da nessuna parte in questa vista.
 *
 * Quattro tab — Articoli, Tribuna, Media, Info — e nient'altro: niente
 * ingranaggio flottante, niente hamburger sopra la cover, nessun blocco
 * "Salvati" o "Seguiti" in coda allo scroll. Quelle sono aree personali con
 * una schermata propria, raggiungibili dal menu azioni, e i loro dati non
 * sono stati toccati.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../theme/tokens";
import { AppText, TabBar, type TabBarItem } from "../../ui";
import { MediaProfileHeader } from "./profile-screen-components";
import { trackProfileEvent } from "./profile-analytics";
import type { CompleteProfessionalProfile } from "./profile-service";
import { ProfileSectionError } from "./master/ProfileSectionBlock";
import { ProfileSkeleton } from "./master/ProfileSkeleton";
import { MediaPostComposer } from "./media-posts/MediaPostComposer";
import {
  MEDIA_PROFILE_POST_PAGE_SIZE,
  fetchMediaProfileArticleCategories,
  fetchMediaProfilePostFeed,
  type MediaProfilePost,
  type MediaProfilePostTaggedTarget,
} from "./media-profile-post-service";
import {
  MEDIA_TRIBUNA_PAGE_SIZE,
  fetchMediaTribunaFeed,
  voteMediaTribunaOption,
  type MediaTribunaKind,
  type MediaTribunaPost,
} from "./media-tribuna-service";
import type { MediaContentItem } from "./career/MediaTabContent";
import { MediaArticlesTab, MEDIA_ARTICLE_FILTER_ALL } from "./media/MediaArticlesTab";
import { MediaContentComposer } from "./media/MediaContentComposer";
import { MediaInfoTab } from "./media/MediaInfoTab";
import { MediaMediaTab } from "./media/MediaMediaTab";
import { MediaTribunaTab } from "./media/MediaTribunaTab";
import {
  MediaTribunaComposerModal,
  MediaTribunaCreateSheet,
} from "./media/media-tribuna-composers";
import {
  buildMediaArticleViewModel,
  type MediaArticleViewModel,
} from "./media/media-article-view-model";
import { buildMediaChannelRows } from "./media/media-channel-view";
import { buildMediaEditorialHandoff } from "./media/media-editorial-handoff";
import {
  MEDIA_PROFILE_INITIAL_TAB,
  MEDIA_PROFILE_NO_CAPABILITIES,
  buildMediaCoverageTopics,
  buildMediaEntityInitials,
  buildMediaInfoChips,
  dedupeMediaContentById,
  formatMediaCoverageAreas,
  formatMediaEntityName,
  formatMediaEntityQualifier,
  formatMediaEntityType,
  normalizeExternalUrl,
  resolveMediaCoverageAreas,
  type MediaProfileTab,
} from "./media/media-master-profile";
import {
  fetchPublicMediaProfile,
  type MediaPublicProfile,
} from "./media/media-public-profile-service";
import {
  buildVotedMediaTribunaState,
  sortMediaTribunaPosts,
} from "./media/media-tribuna-model";
import {
  MEDIA_TAB_PAGE_SIZE,
  fetchMediaProfileMediaPage,
  type MediaContentRef,
} from "./media/media-media-tab-service";

export type { MediaProfileTab };
export type { MediaContentRef };

/** Quattro tab, in quest'ordine. L'ordine non cambia fra Owner e Visitor. */
const MEDIA_TABS: readonly TabBarItem<MediaProfileTab>[] = [
  { label: "Articoli", value: "articles" },
  { label: "Tribuna", value: "tribuna" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];

type MediaProfileViewProps = {
  completeProfile: CompleteProfessionalProfile;
  /** Deep link a una tab specifica. Senza, si aprono gli Articoli. */
  initialTab?: MediaProfileTab;
  isFollowed?: boolean;
  isMessaging?: boolean;
  mode: "owner" | "visitor";
  /** "Messaggio": la stessa conversazione del dominio Messaggi. */
  onContactPress?: () => void;
  /** Apre REV-PROF-22, o l'editor corrente durante la transizione. */
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  onMorePress?: () => void;
  onOpenClub?: (clubId: string) => void;
  /** Apre il dettaglio contenuto condiviso. */
  onOpenContent?: (ref: MediaContentRef) => void;
  onOpenProfile?: (profileId: string) => void;
  onSharePress?: () => void;
  /**
   * Il "+" della Home apre una volta il composer editoriale: è un punto di
   * accesso, non un composer proprio.
   */
  shouldOpenComposer?: boolean;
  /**
   * REV-PROF-22: cambia quando la schermata che contiene il profilo torna in
   * primo piano — per esempio al ritorno da un modulo di Modifica profilo. Il
   * payload pubblico viene riletto, così header, tab Info e CTA "Visita sito"
   * mostrano subito quello che è appena stato salvato, senza un refresh
   * manuale e senza riavviare l'app.
   */
  refreshToken?: number;
  viewerProfileId?: string | null;
};

export function MediaProfileView({
  completeProfile,
  initialTab = MEDIA_PROFILE_INITIAL_TAB,
  isFollowed = false,
  isMessaging = false,
  mode,
  onContactPress,
  onEditProfilePress,
  onFollowPress,
  onMorePress,
  onOpenClub,
  onOpenContent,
  onOpenProfile,
  onSharePress,
  refreshToken = 0,
  shouldOpenComposer = false,
  viewerProfileId,
}: MediaProfileViewProps) {
  const mediaProfileId = completeProfile.profile.id;
  const [activeTab, setActiveTab] = useState<MediaProfileTab>(initialTab);
  /*
    Si carica l'identità, le capabilities e la tab selezionata; le altre
    arrivano quando vengono aperte. Una tab già visitata resta caricata, così
    tornare indietro non rifà la richiesta.
  */
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<MediaProfileTab>>(
    () => new Set<MediaProfileTab>([initialTab]),
  );

  // ─── Identità pubblica e capabilities ───────────────────────────────────
  const [publicProfile, setPublicProfile] = useState<MediaPublicProfile | null>(
    null,
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  const loadPublicProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    setProfileError(null);

    try {
      const result = await fetchPublicMediaProfile(mediaProfileId);

      // Nessun payload: il profilo non esiste, non è un Media/Creator, o c'è
      // un blocco. È un caso diverso da un errore di rete e si dice così.
      setIsMissing(result === null);
      setPublicProfile(result);
    } catch {
      setProfileError("Controlla la connessione e riprova.");
      trackProfileEvent("profile_load_failed", {
        profileType: "media",
        viewerMode: mode,
      });
    } finally {
      setIsLoadingProfile(false);
    }
    /*
      `refreshToken` entra nelle dipendenze di proposito, anche se il corpo
      non lo legge: è il segnale con cui la schermata contenitore chiede di
      rileggere il payload pubblico dopo un salvataggio (REV-PROF-22).
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaProfileId, mode, refreshToken]);

  useEffect(() => {
    void loadPublicProfile();
  }, [loadPublicProfile]);

  /*
    Finché il backend non ha risposto nessuna azione è disponibile: una CTA
    che compare e poi scompare è peggio di una CTA che arriva un istante più
    tardi.
  */
  const capabilities =
    publicProfile?.capabilities ?? MEDIA_PROFILE_NO_CAPABILITIES;
  const isOwner = publicProfile ? publicProfile.mode === "owner" : mode === "owner";
  const entity = publicProfile?.entity ?? null;
  const entityName = formatMediaEntityName(entity?.entityName);

  // ─── Articoli ────────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<MediaProfilePost[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState(MEDIA_ARTICLE_FILTER_ALL);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingMoreArticles, setIsLoadingMoreArticles] = useState(false);
  const [hasMoreArticles, setHasMoreArticles] = useState(false);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  /*
    Una richiesta più vecchia non deve sovrascrivere il risultato di un filtro
    scelto dopo: ogni caricamento porta il suo numero e solo l'ultimo scrive.
  */
  const articlesRequestRef = useRef(0);

  const loadArticles = useCallback(
    async (category: string) => {
      const requestId = articlesRequestRef.current + 1;
      articlesRequestRef.current = requestId;

      setIsLoadingArticles(true);
      setArticlesError(null);

      try {
        const page = await fetchMediaProfilePostFeed(
          mediaProfileId,
          viewerProfileId,
          {
            category: category === MEDIA_ARTICLE_FILTER_ALL ? null : category,
            limit: MEDIA_PROFILE_POST_PAGE_SIZE,
            offset: 0,
          },
        );

        if (articlesRequestRef.current !== requestId) {
          return;
        }

        setArticles(dedupeMediaContentById(page));
        setHasMoreArticles(page.length === MEDIA_PROFILE_POST_PAGE_SIZE);
      } catch {
        if (articlesRequestRef.current !== requestId) {
          return;
        }

        setArticlesError(
          "Non è stato possibile caricare gli articoli. Riprova.",
        );
        trackProfileEvent("profile_tab_load_failed", {
          profileType: "media",
          tab: "articles",
          viewerMode: mode,
        });
      } finally {
        if (articlesRequestRef.current === requestId) {
          setIsLoadingArticles(false);
        }
      }
    },
    [mediaProfileId, mode, viewerProfileId],
  );

  const loadCategories = useCallback(async () => {
    try {
      const rows = await fetchMediaProfileArticleCategories(mediaProfileId);
      setCategories(rows.map((row) => row.category));
    } catch {
      // I chip sono un affinamento della lista, non la lista: se la loro
      // sorgente non risponde, gli articoli si vedono comunque.
      setCategories([]);
    }
  }, [mediaProfileId]);

  const loadMoreArticles = useCallback(async () => {
    if (isLoadingMoreArticles || !hasMoreArticles) {
      return;
    }

    setIsLoadingMoreArticles(true);

    try {
      const page = await fetchMediaProfilePostFeed(
        mediaProfileId,
        viewerProfileId,
        {
          category:
            activeCategory === MEDIA_ARTICLE_FILTER_ALL ? null : activeCategory,
          limit: MEDIA_PROFILE_POST_PAGE_SIZE,
          offset: articles.length,
        },
      );

      // Dedup per id: una pubblicazione durante lo scroll può far ricomparire
      // la coda della pagina precedente.
      setArticles((current) => dedupeMediaContentById([...current, ...page]));
      setHasMoreArticles(page.length === MEDIA_PROFILE_POST_PAGE_SIZE);
      trackProfileEvent("media_articles_paginated", {
        profileType: "media",
        viewerMode: mode,
      });
    } catch {
      setArticlesError("Non è stato possibile caricare gli articoli. Riprova.");
    } finally {
      setIsLoadingMoreArticles(false);
    }
  }, [
    activeCategory,
    articles.length,
    hasMoreArticles,
    isLoadingMoreArticles,
    mediaProfileId,
    mode,
    viewerProfileId,
  ]);

  useEffect(() => {
    if (!visitedTabs.has("articles")) {
      return;
    }

    void loadArticles(activeCategory);
  }, [activeCategory, loadArticles, visitedTabs]);

  useEffect(() => {
    if (!visitedTabs.has("articles")) {
      return;
    }

    void loadCategories();
  }, [loadCategories, visitedTabs]);

  const articleViewModels = useMemo<MediaArticleViewModel[]>(
    () =>
      articles.map((article) =>
        buildMediaArticleViewModel(article, entityName),
      ),
    [articles, entityName],
  );

  // ─── Tribuna ─────────────────────────────────────────────────────────────
  const [tribunaPosts, setTribunaPosts] = useState<MediaTribunaPost[]>([]);
  const [isLoadingTribuna, setIsLoadingTribuna] = useState(true);
  const [isLoadingMoreTribuna, setIsLoadingMoreTribuna] = useState(false);
  const [hasMoreTribuna, setHasMoreTribuna] = useState(false);
  const [tribunaError, setTribunaError] = useState<string | null>(null);

  const loadTribuna = useCallback(async () => {
    setIsLoadingTribuna(true);
    setTribunaError(null);

    try {
      const page = await fetchMediaTribunaFeed(mediaProfileId, viewerProfileId, {
        limit: MEDIA_TRIBUNA_PAGE_SIZE,
        offset: 0,
      });
      setTribunaPosts(sortMediaTribunaPosts(dedupeMediaContentById(page)));
      setHasMoreTribuna(page.length === MEDIA_TRIBUNA_PAGE_SIZE);
    } catch {
      setTribunaError("Non è stato possibile caricare la Tribuna. Riprova.");
      trackProfileEvent("profile_tab_load_failed", {
        profileType: "media",
        tab: "tribuna",
        viewerMode: mode,
      });
    } finally {
      setIsLoadingTribuna(false);
    }
  }, [mediaProfileId, mode, viewerProfileId]);

  const loadMoreTribuna = useCallback(async () => {
    if (isLoadingMoreTribuna || !hasMoreTribuna) {
      return;
    }

    setIsLoadingMoreTribuna(true);

    try {
      const page = await fetchMediaTribunaFeed(mediaProfileId, viewerProfileId, {
        limit: MEDIA_TRIBUNA_PAGE_SIZE,
        offset: tribunaPosts.length,
      });
      setTribunaPosts((current) =>
        sortMediaTribunaPosts(dedupeMediaContentById([...current, ...page])),
      );
      setHasMoreTribuna(page.length === MEDIA_TRIBUNA_PAGE_SIZE);
    } catch {
      setTribunaError("Non è stato possibile caricare la Tribuna. Riprova.");
    } finally {
      setIsLoadingMoreTribuna(false);
    }
  }, [
    hasMoreTribuna,
    isLoadingMoreTribuna,
    mediaProfileId,
    tribunaPosts.length,
    viewerProfileId,
  ]);

  useEffect(() => {
    if (!visitedTabs.has("tribuna")) {
      return;
    }

    void loadTribuna();
  }, [loadTribuna, visitedTabs]);

  // ─── Media ───────────────────────────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState<MediaContentItem[]>([]);
  const [mediaOffset, setMediaOffset] = useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);
  const [hasMoreMedia, setHasMoreMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    setMediaError(null);

    try {
      const page = await fetchMediaProfileMediaPage(
        mediaProfileId,
        viewerProfileId,
        0,
        MEDIA_TAB_PAGE_SIZE,
      );
      setMediaItems(page.items);
      setMediaOffset(page.nextOffset);
      setHasMoreMedia(page.hasMore);
    } catch {
      setMediaError("Non è stato possibile caricare i contenuti. Riprova.");
      trackProfileEvent("profile_tab_load_failed", {
        profileType: "media",
        tab: "media",
        viewerMode: mode,
      });
    } finally {
      setIsLoadingMedia(false);
    }
  }, [mediaProfileId, mode, viewerProfileId]);

  const loadMoreMedia = useCallback(async () => {
    if (isLoadingMoreMedia || !hasMoreMedia) {
      return;
    }

    setIsLoadingMoreMedia(true);

    try {
      const page = await fetchMediaProfileMediaPage(
        mediaProfileId,
        viewerProfileId,
        mediaOffset,
        MEDIA_TAB_PAGE_SIZE,
      );
      setMediaItems((current) =>
        dedupeMediaContentById([...current, ...page.items]),
      );
      setMediaOffset(page.nextOffset);
      setHasMoreMedia(page.hasMore);
    } catch {
      setMediaError("Non è stato possibile caricare i contenuti. Riprova.");
    } finally {
      setIsLoadingMoreMedia(false);
    }
  }, [
    hasMoreMedia,
    isLoadingMoreMedia,
    mediaOffset,
    mediaProfileId,
    viewerProfileId,
  ]);

  useEffect(() => {
    if (!visitedTabs.has("media")) {
      return;
    }

    void loadMedia();
  }, [loadMedia, visitedTabs]);

  /**
   * Cambio di tab, da qualunque origine — la tab bar, un deep link, il
   * ritorno da una pubblicazione. Passa da qui anche la registrazione della
   * tab come visitata, così il caricamento on demand non viene aggirato.
   */
  const goToTab = useCallback((tab: MediaProfileTab) => {
    setActiveTab(tab);
    setVisitedTabs((current) =>
      current.has(tab) ? current : new Set([...current, tab]),
    );
  }, []);

  // ─── Creazione ───────────────────────────────────────────────────────────
  const [isTribunaSheetOpen, setIsTribunaSheetOpen] = useState(false);
  const [tribunaComposerKind, setTribunaComposerKind] =
    useState<MediaTribunaKind | null>(null);
  const [isEditorialComposerOpen, setIsEditorialComposerOpen] = useState(false);
  const [isMediaComposerOpen, setIsMediaComposerOpen] = useState(false);
  const hasHandledComposeIntent = useRef(false);

  useEffect(() => {
    if (
      !shouldOpenComposer ||
      !capabilities.canPublishArticle ||
      hasHandledComposeIntent.current
    ) {
      return;
    }

    hasHandledComposeIntent.current = true;
    goToTab("articles");
    setIsEditorialComposerOpen(true);
  }, [capabilities.canPublishArticle, goToTab, shouldOpenComposer]);

  /**
   * "Nuovo articolo" consegna il contesto a HOM-06.2 — origine, realtà
   * editoriale, destinazione di ritorno — e non scegli la modalità di
   * creazione: quella la risolve il flusso editoriale.
   */
  function handleNewArticlePress() {
    if (!capabilities.canPublishArticle) {
      /*
        L'identità editoriale non è più autorizzata: non si apre un composer
        destinato a fallire e non la si sostituisce in silenzio con un'altra.
      */
      Alert.alert(
        "Pubblicazione non disponibile",
        "Non hai i permessi per pubblicare con questa identità editoriale.",
      );
      return;
    }

    const handoff = buildMediaEditorialHandoff(mediaProfileId);

    trackProfileEvent("media_new_article_tapped", {
      profileType: "media",
      source: handoff.origin,
      viewerMode: isOwner ? "owner" : "visitor",
    });
    setIsEditorialComposerOpen(true);
  }

  /**
   * Dopo una pubblicazione riuscita si resta sulla tab Articoli, il filtro
   * torna a "Tutti" perché il nuovo articolo potrebbe non appartenere alla
   * categoria selezionata, e la lista viene ricaricata dal backend: la
   * posizione segue l'ordinamento reale invece di un'ipotesi del client.
   */
  function handleArticleCreated() {
    setIsEditorialComposerOpen(false);
    goToTab("articles");
    setActiveCategory(MEDIA_ARTICLE_FILTER_ALL);
    void loadCategories();
    void loadArticles(MEDIA_ARTICLE_FILTER_ALL);
  }

  function handleTribunaCreated(post: MediaTribunaPost) {
    setTribunaComposerKind(null);
    goToTab("tribuna");
    void loadTribuna();
    trackProfileEvent("media_tribuna_created", {
      profileType: "media",
      tribunaKind: post.kind,
      viewerMode: "owner",
    });
  }

  function handleMediaCreated() {
    setIsMediaComposerOpen(false);
    goToTab("media");
    void loadMedia();
  }

  // ─── Interazioni ─────────────────────────────────────────────────────────
  function handleTabChange(tab: MediaProfileTab) {
    goToTab(tab);
    trackProfileEvent("profile_tab_changed", {
      profileType: "media",
      tab,
      viewerMode: isOwner ? "owner" : "visitor",
    });
  }

  function handleOpenArticle(articleId: string) {
    trackProfileEvent("media_article_opened", {
      profileType: "media",
      viewerMode: isOwner ? "owner" : "visitor",
    });
    onOpenContent?.({ contentType: "media_profile", postId: articleId });
  }

  function handleOpenTribunaPost(post: MediaTribunaPost) {
    trackProfileEvent("media_tribuna_opened", {
      profileType: "media",
      tribunaKind: post.kind,
      viewerMode: isOwner ? "owner" : "visitor",
    });
    onOpenContent?.({ contentType: "media_tribuna", postId: post.id });
  }

  function handleOpenTarget(target: MediaProfilePostTaggedTarget) {
    if (target.target_type === "club") {
      onOpenClub?.(target.target_id);
      return;
    }

    onOpenProfile?.(target.target_id);
  }

  async function handleVoteTribuna(post: MediaTribunaPost, optionId: string) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare nella Tribuna.");
      return;
    }

    const nextState = buildVotedMediaTribunaState(post, optionId);
    patchTribunaPost(post.id, nextState);
    trackProfileEvent("media_tribuna_voted", {
      profileType: "media",
      tribunaKind: post.kind,
      viewerMode: isOwner ? "owner" : "visitor",
    });

    try {
      await voteMediaTribunaOption({
        optionId,
        postId: post.id,
        profileId: viewerProfileId,
      });
    } catch {
      // Rollback allo stato precedente: un voto non registrato non deve
      // restare a schermo come se lo fosse.
      patchTribunaPost(post.id, {
        options: post.options,
        total_vote_count: post.total_vote_count,
      });
      Alert.alert("Errore", "Impossibile registrare il voto.");
    }
  }

  function patchTribunaPost(postId: string, patch: Partial<MediaTribunaPost>) {
    setTribunaPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
  }

  function handleVisitWebsite() {
    const url = normalizeExternalUrl(entity?.websiteUrl);

    if (!url) {
      return;
    }

    trackProfileEvent("media_website_tapped", {
      profileType: "media",
      viewerMode: isOwner ? "owner" : "visitor",
    });
    void Linking.openURL(url);
  }

  // ─── Info ────────────────────────────────────────────────────────────────
  const entityTypeLabel = useMemo(
    () => (entity ? formatMediaEntityType(entity) : null),
    [entity],
  );
  const entityQualifier = useMemo(
    () => (entity ? formatMediaEntityQualifier(entity, entityTypeLabel) : null),
    [entity, entityTypeLabel],
  );
  const coverageChips = useMemo(
    () =>
      entity
        ? [
            ...buildMediaInfoChips(entity.focusAreas),
            ...buildMediaCoverageTopics(entity),
          ]
        : [],
    [entity],
  );
  const contentTypeChips = useMemo(
    () => buildMediaInfoChips(entity?.contentTypes),
    [entity?.contentTypes],
  );
  const areasLabel = useMemo(
    /*
      REV-PROF-22: la riga segue la modalità dichiarata — "Tutta Italia", le
      regioni oppure le zone — e non la sola lista storica dei territori.
    */
    () =>
      formatMediaCoverageAreas(
        resolveMediaCoverageAreas({
          coverageScope: entity?.coverageScope,
          coveredProvinces: entity?.coveredProvinces,
          coveredTerritories: entity?.coveredTerritories,
        }),
      ),
    [entity?.coverageScope, entity?.coveredProvinces, entity?.coveredTerritories],
  );
  const channelRows = useMemo(
    () => buildMediaChannelRows(entity?.channels ?? []),
    [entity?.channels],
  );
  const websiteUrl = normalizeExternalUrl(entity?.websiteUrl);

  // ─── Stati globali ───────────────────────────────────────────────────────
  if (isLoadingProfile) {
    return <ProfileSkeleton testID="media-profile-skeleton" />;
  }

  if (isMissing) {
    return (
      <View style={styles.state} testID="media-profile-unavailable">
        <AppText variant="titleSm">Profilo non disponibile</AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          Il profilo potrebbe essere stato rimosso o non essere più visibile.
        </AppText>
      </View>
    );
  }

  if (profileError || !entity) {
    return (
      <View style={styles.state} testID="media-profile-error">
        <AppText variant="titleSm">
          Non è stato possibile caricare il profilo
        </AppText>
        <ProfileSectionError
          message={profileError ?? "Controlla la connessione e riprova."}
          onRetry={() => {
            void loadPublicProfile();
          }}
          testID="media-profile-retry"
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="media-profile-view">
      <MediaProfileHeader
        avatarUrl={entity.logoUrl}
        coverImageUrl={entity.coverUrl}
        description={entity.shortDescription}
        footerAction={
          /*
            "Visita sito" compare solo con un URL pubblico e valido: al
            Visitor non si mostra un pulsante disabilitato.
          */
          capabilities.canViewWebsite && websiteUrl ? (
            <Pressable
              accessibilityHint="Apre il sito in una scheda esterna"
              accessibilityLabel="Visita sito, link esterno"
              accessibilityRole="link"
              hitSlop={8}
              onPress={handleVisitWebsite}
              style={({ pressed }) => [
                styles.websiteAction,
                pressed ? styles.pressed : null,
              ]}
              testID="media-website-link"
            >
              <AppText color="accent" variant="actionLabel">
                Visita sito
              </AppText>
              <Ionicons color={colors.accent} name="open-outline" size={14} />
            </Pressable>
          ) : null
        }
        fullName={entityName ?? "Profilo media"}
        /*
          Lo stato follow ha una sola sorgente: la schermata, che lo carica e
          lo aggiorna. Il valore della RPC servirebbe solo a mostrare
          "Seguito" dopo che l'utente ha già premuto "Non seguire più".
        */
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isVerified={entity.isVerified}
        logoInitials={buildMediaEntityInitials(entityName)}
        mode={isOwner ? "owner" : "visitor"}
        onEditProfilePress={
          capabilities.canEditProfile ? onEditProfilePress : undefined
        }
        onFollowPress={capabilities.canFollow ? onFollowPress : undefined}
        onMessagePress={capabilities.canMessage ? onContactPress : undefined}
        onMorePress={onMorePress}
        onSharePress={capabilities.canShare ? onSharePress : undefined}
        primaryRole={entityTypeLabel ?? ""}
        secondaryRole={entityQualifier ?? undefined}
      />

      <TabBar
        active={activeTab}
        fill
        items={MEDIA_TABS}
        onChange={handleTabChange}
        testID="media-profile-tabs"
      />

      {activeTab === "articles" ? (
        <MediaArticlesTab
          activeCategory={activeCategory}
          articles={articleViewModels}
          canPublishArticle={capabilities.canPublishArticle}
          categories={categories}
          entityName={entityName}
          errorMessage={articlesError}
          hasMore={hasMoreArticles}
          isLoading={isLoadingArticles}
          isLoadingMore={isLoadingMoreArticles}
          isOwner={isOwner}
          onCategoryChange={(category) => {
            setActiveCategory(category);
            trackProfileEvent("profile_filter_changed", {
              profileType: "media",
              tab: "articles",
              viewerMode: isOwner ? "owner" : "visitor",
            });
          }}
          onLoadMore={() => {
            void loadMoreArticles();
          }}
          onNewArticlePress={handleNewArticlePress}
          onOpenArticle={handleOpenArticle}
          onOpenTarget={handleOpenTarget}
          onRetry={() => {
            void loadArticles(activeCategory);
          }}
        />
      ) : activeTab === "tribuna" ? (
        <MediaTribunaTab
          canCreateContent={capabilities.canCreateTribunaContent}
          canVote={Boolean(viewerProfileId)}
          errorMessage={tribunaError}
          hasMore={hasMoreTribuna}
          isLoading={isLoadingTribuna}
          isLoadingMore={isLoadingMoreTribuna}
          isOwner={isOwner}
          onCreatePress={() => setIsTribunaSheetOpen(true)}
          onLoadMore={() => {
            void loadMoreTribuna();
          }}
          onOpenLinkedArticle={handleOpenArticle}
          onOpenPost={handleOpenTribunaPost}
          onRetry={() => {
            void loadTribuna();
          }}
          onVote={(post, optionId) => {
            void handleVoteTribuna(post, optionId);
          }}
          posts={tribunaPosts}
        />
      ) : activeTab === "media" ? (
        <MediaMediaTab
          entityName={entityName}
          errorMessage={mediaError}
          hasMore={hasMoreMedia}
          isLoading={isLoadingMedia}
          isLoadingMore={isLoadingMoreMedia}
          isOwner={isOwner}
          items={mediaItems}
          onAddContentPress={
            capabilities.canAddMedia
              ? () => setIsMediaComposerOpen(true)
              : undefined
          }
          onLoadMore={() => {
            void loadMoreMedia();
          }}
          onOpenContent={(ref) => onOpenContent?.(ref)}
          onRetry={loadMedia}
          viewerMode={isOwner ? "owner" : "visitor"}
        />
      ) : (
        <MediaInfoTab
          areasLabel={areasLabel}
          channels={channelRows}
          contentTypes={contentTypeChips}
          coverage={coverageChips}
          description={entity.shortDescription}
          entityTypeLabel={entityTypeLabel}
          isLoading={false}
          isOwner={isOwner}
          onChannelPress={(channel) =>
            /* Il tipo di canale, mai l'URL e mai lo username. */
            trackProfileEvent("media_channel_tapped", {
              channelType: channel.key,
              profileType: "media",
              viewerMode: isOwner ? "owner" : "visitor",
            })
          }
          onEditProfilePress={
            capabilities.canEditProfile ? onEditProfilePress : undefined
          }
          onRetry={() => {
            void loadPublicProfile();
          }}
        />
      )}

      <MediaTribunaCreateSheet
        onClose={() => setIsTribunaSheetOpen(false)}
        onSelect={(kind) => {
          setIsTribunaSheetOpen(false);
          setTribunaComposerKind(kind);
        }}
        visible={isTribunaSheetOpen}
      />
      <MediaTribunaComposerModal
        articles={articles.filter((article) => article.kind === "article")}
        kind={tribunaComposerKind}
        mediaProfileId={mediaProfileId}
        onClose={() => setTribunaComposerKind(null)}
        onCreated={handleTribunaCreated}
        userId={viewerProfileId ?? null}
        visible={tribunaComposerKind !== null}
      />
      {/*
        Il composer editoriale è quello che esiste già nel prodotto: REV-PROF-21
        gli consegna origine e identità, non lo ridisegna e non anticipa
        HOM-06.2.
      */}
      <MediaPostComposer
        defaultAuthorName={entityName ?? ""}
        mediaProfileId={mediaProfileId}
        onClose={() => setIsEditorialComposerOpen(false)}
        onCreated={handleArticleCreated}
        publisherName={entityName ?? ""}
        userId={viewerProfileId ?? null}
        visible={isEditorialComposerOpen}
      />
      <MediaContentComposer
        entityName={entityName ?? "Redazione"}
        mediaProfileId={mediaProfileId}
        onClose={() => setIsMediaComposerOpen(false)}
        onCreated={handleMediaCreated}
        userId={viewerProfileId ?? null}
        visible={isMediaComposerOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  root: {
    flex: 1,
  },
  state: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[32],
  },
  websiteAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    // 44 pt di area toccabile su una riga di testo.
    minHeight: 44,
    paddingHorizontal: spacing[8],
  },
});
