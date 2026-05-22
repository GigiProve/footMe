import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../components/ui/media-picker-field";
import { VideoPlayerModal } from "../../components/ui/video-player-modal";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Avatar, Button, Input } from "../../ui";
import {
  fetchProfileFollowState,
  followProfile,
  unfollowProfile,
} from "./fan-media-service";
import {
  addMediaProfilePostComment,
  createMediaProfilePost,
  fetchMediaProfilePostDetail,
  fetchMediaProfilePostFeed,
  searchMediaProfilePostTargets,
  toggleSavedMediaProfilePost,
  type MediaProfilePost,
  type MediaProfilePostKind,
  type MediaProfilePostTaggedTarget,
} from "./media-profile-post-service";
import {
  addMediaTribunaComment,
  createMediaArticleDebate,
  createMediaCommunityQa,
  createMediaPlayerVote,
  createMediaTribunaPoll,
  fetchMediaTribunaFeed,
  submitMediaTribunaQuestion,
  toggleSavedMediaTribuna,
  voteMediaTribunaOption,
  voteMediaTribunaQuestion,
  type MediaTribunaKind,
  type MediaTribunaOption,
  type MediaTribunaPost,
  type MediaTribunaQuestion,
  type MediaTribunaPlayerOptionInput,
} from "./media-tribuna-service";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  type UploadedMediaItem,
} from "./media-upload-service";
import {
  normalizeFacebookInput,
  normalizeInstagramInput,
} from "./profile-form-utils";
import type { CompleteProfessionalProfile } from "./profile-service";

const DEFAULT_MEDIA_COVER_URI =
  "https://storage.googleapis.com/banani-generated-images/generated-images/b4de0b61-da83-47dc-b416-c759eaabd930.jpg";

type MediaProfileTab = "articles" | "tribuna" | "info";
type ArticleFilter = "all" | "Mercato" | "Interviste" | "Giovanili" | "Opinioni";

type MediaProfileViewProps = {
  completeProfile: CompleteProfessionalProfile;
  mode: "owner" | "visitor";
  onOpenClub?: (clubId: string) => void;
  onOpenProfile?: (profileId: string) => void;
  viewerProfileId?: string | null;
};

type ChannelItem = {
  key: string;
  label: string;
  url: string;
};

type DraftState = {
  authorName: string;
  body: string;
  category: Exclude<ArticleFilter, "all">;
  coverType: "image" | "video" | null;
  coverUrl: string;
  excerpt: string;
  externalUrl: string;
  kind: MediaProfilePostKind;
  subtitle: string;
  taggedTargets: MediaProfilePostTaggedTarget[];
  title: string;
};

type TribunaDraftKind = MediaTribunaKind | null;

const MEDIA_TABS: { label: string; value: MediaProfileTab }[] = [
  { label: "Articoli", value: "articles" },
  { label: "Tribuna", value: "tribuna" },
  { label: "Info", value: "info" },
];

const ARTICLE_FILTERS: { label: string; value: ArticleFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Mercato", value: "Mercato" },
  { label: "Interviste", value: "Interviste" },
  { label: "Giovanili", value: "Giovanili" },
  { label: "Opinioni", value: "Opinioni" },
];

const CATEGORY_VALUES = ARTICLE_FILTERS.filter((filter) => filter.value !== "all").map(
  (filter) => filter.value,
) as Exclude<ArticleFilter, "all">[];

const TRIBUNA_CREATE_OPTIONS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  kind: MediaTribunaKind;
  title: string;
}[] = [
  {
    description: "Crea una domanda con opzioni e risultati",
    icon: "bar-chart-outline",
    kind: "editorial_poll",
    title: "Sondaggio editoriale",
  },
  {
    description: "Collega una discussione a un articolo pubblicato",
    icon: "chatbox-outline",
    kind: "article_debate",
    title: "Dibattito da articolo",
  },
  {
    description: "Crea una votazione post-partita sui protagonisti",
    icon: "star-outline",
    kind: "player_vote",
    title: "Vota il migliore",
  },
  {
    description: "Raccogli domande dalla community",
    icon: "help-circle-outline",
    kind: "community_qa",
    title: "Q&A community",
  },
];

const SEARCH_DEBOUNCE_MS = 250;

export function MediaProfileView({
  completeProfile,
  mode,
  onOpenClub,
  onOpenProfile,
  viewerProfileId,
}: MediaProfileViewProps) {
  const [activeTab, setActiveTab] = useState<MediaProfileTab>("articles");
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ArticleFilter>("all");
  const [posts, setPosts] = useState<MediaProfilePost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<MediaProfilePost | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [tribunaPosts, setTribunaPosts] = useState<MediaTribunaPost[]>([]);
  const [isLoadingTribuna, setIsLoadingTribuna] = useState(false);
  const [isTribunaCreateMenuOpen, setIsTribunaCreateMenuOpen] = useState(false);
  const [tribunaComposerKind, setTribunaComposerKind] =
    useState<TribunaDraftKind>(null);
  const [tribunaCommentDrafts, setTribunaCommentDrafts] = useState<
    Record<string, string>
  >({});
  const [tribunaQuestionDrafts, setTribunaQuestionDrafts] = useState<
    Record<string, string>
  >({});

  const profile = completeProfile.profile;
  const mediaProfile = completeProfile.mediaProfile ?? null;
  const mediaProfileId = mediaProfile?.profile_id ?? profile.id;
  const displayName = mediaProfile?.entity_name?.trim() || profile.full_name;
  const logoUrl = mediaProfile?.logo_url?.trim() || profile.avatar_url || null;
  const websiteUrl = normalizeWebsiteInput(completeProfile.userContacts.website);
  const channels = useMemo(
    () => buildChannelItems(completeProfile.userContacts),
    [completeProfile.userContacts],
  );
  const channelLabels = channels.map((channel) => channel.label).join(" • ");
  const coverageItems = useMemo(
    () =>
      normalizeUniqueValues([
        ...(mediaProfile?.focus_areas ?? []),
        ...(mediaProfile?.content_types ?? []),
      ]),
    [mediaProfile?.content_types, mediaProfile?.focus_areas],
  );
  const coverageLabel =
    coverageItems.length > 0
      ? coverageItems.join(" • ")
      : "Copertura da completare";
  const areaLabel = buildAreaLabel(completeProfile);
  const profileTypeLabel = buildMediaProfileTypeLabel(mediaProfile?.affiliation_type);
  const verificationStatus = mediaProfile
    ? (mediaProfile as { verification_status?: string; is_verified?: boolean })
        .verification_status
    : null;
  const isVerified =
    verificationStatus === "verified" ||
    Boolean(
      mediaProfile &&
        (mediaProfile as { verification_status?: string; is_verified?: boolean })
          .is_verified,
    );
  const filteredPosts = useMemo(() => {
    if (activeFilter === "all") {
      return posts;
    }

    return posts.filter(
      (post) => post.category.trim().toLowerCase() === activeFilter.toLowerCase(),
    );
  }, [activeFilter, posts]);

  const loadPosts = useCallback(async () => {
    try {
      setIsLoadingPosts(true);
      const result = await fetchMediaProfilePostFeed(mediaProfileId, viewerProfileId);
      setPosts(result);
    } catch {
      setPosts([]);
      Alert.alert("Errore", "Impossibile caricare gli articoli.");
    } finally {
      setIsLoadingPosts(false);
    }
  }, [mediaProfileId, viewerProfileId]);

  const loadTribunaPosts = useCallback(async () => {
    try {
      setIsLoadingTribuna(true);
      const result = await fetchMediaTribunaFeed(mediaProfileId, viewerProfileId);
      setTribunaPosts(result);
    } catch {
      setTribunaPosts([]);
      Alert.alert("Errore", "Impossibile caricare la Tribuna.");
    } finally {
      setIsLoadingTribuna(false);
    }
  }, [mediaProfileId, viewerProfileId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void loadTribunaPosts();
  }, [loadTribunaPosts]);

  useEffect(() => {
    if (mode !== "visitor" || !viewerProfileId) {
      setIsFollowed(false);
      return;
    }

    let isMounted = true;

    fetchProfileFollowState(viewerProfileId, profile.id)
      .then((result) => {
        if (isMounted) {
          setIsFollowed(result);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsFollowed(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mode, profile.id, viewerProfileId]);

  const handleToggleFollow = useCallback(async () => {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per seguire questo profilo media.");
      return;
    }

    const nextFollowState = !isFollowed;
    setIsFollowing(true);
    setIsFollowed(nextFollowState);

    try {
      if (nextFollowState) {
        await followProfile(viewerProfileId, profile.id);
      } else {
        await unfollowProfile(viewerProfileId, profile.id);
      }
    } catch {
      setIsFollowed(isFollowed);
      Alert.alert("Errore", "Impossibile aggiornare il follow.");
    } finally {
      setIsFollowing(false);
    }
  }, [isFollowed, profile.id, viewerProfileId]);

  const handleVisitWebsite = useCallback(() => {
    if (!websiteUrl) {
      return;
    }

    void Linking.openURL(websiteUrl);
  }, [websiteUrl]);

  async function handleOpenPost(post: MediaProfilePost) {
    setSelectedPost(post);
    setIsLoadingDetail(true);

    try {
      const detail = await fetchMediaProfilePostDetail(post.id, viewerProfileId);
      if (detail) {
        setSelectedPost(detail);
      }
    } catch {
      Alert.alert("Errore", "Impossibile aprire questo contenuto.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function handleClosePost() {
    setSelectedPost(null);
    setIsLoadingDetail(false);
  }

  function handlePatchPost(postId: string, patch: Partial<MediaProfilePost>) {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
    setSelectedPost((current) =>
      current?.id === postId ? { ...current, ...patch } : current,
    );
  }

  function handlePatchTribunaPost(
    postId: string,
    patch: Partial<MediaTribunaPost>,
  ) {
    setTribunaPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
  }

  async function handleToggleSave(post: MediaProfilePost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per salvare questo contenuto.");
      return;
    }

    const nextSaved = !post.is_saved;
    handlePatchPost(post.id, { is_saved: nextSaved });

    try {
      await toggleSavedMediaProfilePost(viewerProfileId, post.id, nextSaved);
    } catch {
      handlePatchPost(post.id, { is_saved: post.is_saved });
      Alert.alert("Errore", "Impossibile aggiornare il salvataggio.");
    }
  }

  async function handleCreated(post: MediaProfilePost) {
    setPosts((current) => [post, ...current]);
    setActiveFilter("all");
    setIsComposerOpen(false);
  }

  async function handleCreatedTribuna(post: MediaTribunaPost) {
    setTribunaPosts((current) => [post, ...current]);
    setTribunaComposerKind(null);
  }

  async function handleOpenLinkedArticle(articleId: string) {
    setIsLoadingDetail(true);

    try {
      const detail = await fetchMediaProfilePostDetail(articleId, viewerProfileId);
      if (detail) {
        setSelectedPost(detail);
      } else {
        Alert.alert("Articolo non disponibile", "Questo articolo non e' piu' disponibile.");
      }
    } catch {
      Alert.alert("Errore", "Impossibile aprire l'articolo collegato.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function handleVoteTribunaOption(
    post: MediaTribunaPost,
    optionId: string,
  ) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare nella Tribuna.");
      return;
    }

    const nextState = buildVotedTribunaState(post, optionId);
    handlePatchTribunaPost(post.id, nextState);

    try {
      await voteMediaTribunaOption({
        optionId,
        postId: post.id,
        profileId: viewerProfileId,
      });
    } catch {
      handlePatchTribunaPost(post.id, {
        options: post.options,
        total_vote_count: post.total_vote_count,
      });
      Alert.alert("Errore", "Impossibile registrare il voto.");
    }
  }

  async function handleToggleTribunaSave(post: MediaTribunaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per salvare questo contenuto.");
      return;
    }

    const nextSaved = !post.is_saved;
    handlePatchTribunaPost(post.id, { is_saved: nextSaved });

    try {
      await toggleSavedMediaTribuna(viewerProfileId, post.id, nextSaved);
    } catch {
      handlePatchTribunaPost(post.id, { is_saved: post.is_saved });
      Alert.alert("Errore", "Impossibile aggiornare il salvataggio.");
    }
  }

  async function handleAddTribunaComment(post: MediaTribunaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per commentare.");
      return;
    }

    const body = tribunaCommentDrafts[post.id]?.trim() ?? "";
    if (!body) {
      Alert.alert("Commento vuoto", "Scrivi un commento prima di pubblicare.");
      return;
    }

    try {
      const comment = await addMediaTribunaComment({
        body,
        postId: post.id,
        profileId: viewerProfileId,
      });
      handlePatchTribunaPost(post.id, {
        comment_count: post.comment_count + 1,
        comments: [...post.comments, comment],
      });
      setTribunaCommentDrafts((current) => ({ ...current, [post.id]: "" }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Commento non pubblicato.";
      Alert.alert("Errore", message);
    }
  }

  async function handleSubmitTribunaQuestion(post: MediaTribunaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per inviare una domanda.");
      return;
    }

    const body = tribunaQuestionDrafts[post.id]?.trim() ?? "";
    if (!body) {
      Alert.alert("Domanda vuota", "Scrivi una domanda prima di pubblicare.");
      return;
    }

    try {
      const question = await submitMediaTribunaQuestion({
        body,
        postId: post.id,
        profileId: viewerProfileId,
      });
      const questions = sortTribunaQuestions([...post.questions, question]);
      handlePatchTribunaPost(post.id, {
        question_count: post.question_count + 1,
        questions,
      });
      setTribunaQuestionDrafts((current) => ({ ...current, [post.id]: "" }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Domanda non pubblicata.";
      Alert.alert("Errore", message);
    }
  }

  async function handleToggleTribunaQuestionVote(
    post: MediaTribunaPost,
    question: MediaTribunaQuestion,
  ) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare una domanda.");
      return;
    }

    const nextVoted = !question.is_voted;
    const nextQuestions = sortTribunaQuestions(
      post.questions.map((entry) =>
        entry.id === question.id
          ? {
              ...entry,
              is_voted: nextVoted,
              vote_count: entry.vote_count + (nextVoted ? 1 : -1),
            }
          : entry,
      ),
    );
    handlePatchTribunaPost(post.id, { questions: nextQuestions });

    try {
      await voteMediaTribunaQuestion(question.id, viewerProfileId, nextVoted);
    } catch {
      handlePatchTribunaPost(post.id, { questions: post.questions });
      Alert.alert("Errore", "Impossibile aggiornare il voto.");
    }
  }

  function handleOpenTarget(target: MediaProfilePostTaggedTarget) {
    if (target.target_type === "club") {
      onOpenClub?.(target.target_id);
      return;
    }

    onOpenProfile?.(target.target_id);
  }

  return (
    <View style={styles.root} testID="media-profile-view">
      <View style={styles.headerSurface}>
        <View style={styles.heroSection}>
          <Image
            accessibilityLabel="Copertina profilo media"
            source={{ uri: DEFAULT_MEDIA_COVER_URI }}
            style={styles.heroImage}
          />
          <View pointerEvents="none" style={styles.heroOverlay} />
        </View>

        <View style={styles.headerBody}>
          <View style={styles.logoWrapper}>
            {logoUrl ? (
              <Image
                accessibilityLabel="Logo profilo media"
                source={{ uri: logoUrl }}
                style={styles.logoImage}
              />
            ) : (
              <View style={[styles.logoImage, styles.logoPlaceholder]}>
                <Ionicons
                  color={colors.accent}
                  name="newspaper-outline"
                  size={34}
                />
              </View>
            )}
          </View>

          <View style={styles.identityBlock}>
            <View style={styles.nameRow}>
              <AppText style={styles.profileName} variant="headingLg">
                {displayName}
              </AppText>
              {isVerified ? (
                <Ionicons color="#007AFF" name="checkmark-circle" size={20} />
              ) : null}
            </View>
            <AppText color="secondary" style={styles.profileType} variant="bodySm">
              {profileTypeLabel}
            </AppText>
          </View>

          <View style={styles.infoBlock}>
            <AppText style={styles.coverageText} variant="bodySm">
              {coverageLabel}
            </AppText>
            <MediaMetaLine icon="location-outline" text={areaLabel} />
            <MediaMetaLine
              accent
              icon="link-outline"
              text={channelLabels || "Canali da completare"}
            />
          </View>

          <View
            style={[
              styles.actionsRow,
              mode === "owner" ? styles.ownerActionsRow : null,
            ]}
          >
            {mode === "visitor" ? (
              <Button
                label={isFollowed ? "Seguito" : "Segui"}
                loading={isFollowing}
                onPress={() => {
                  void handleToggleFollow();
                }}
                size="md"
                style={styles.followButton}
                testID="media-follow-button"
                variant="primary"
              />
            ) : null}
            <Button
              disabled={!websiteUrl}
              label="Visita sito"
              onPress={handleVisitWebsite}
              size="md"
              style={mode === "visitor" ? styles.websiteButton : styles.ownerWebsiteButton}
              testID="media-website-button"
              variant="secondary"
            />
          </View>
        </View>

        <View style={styles.tabsContainer} testID="media-profile-tabs">
          {MEDIA_TABS.map((tab) => (
            <MediaTabButton
              active={activeTab === tab.value}
              key={tab.value}
              label={tab.label}
              onPress={() => setActiveTab(tab.value)}
              testID={`media-tab-${tab.value}`}
            />
          ))}
        </View>
      </View>

      {activeTab === "articles" ? (
        <ArticlesTab
          activeFilter={activeFilter}
          displayName={displayName}
          isLoading={isLoadingPosts}
          mode={mode}
          onAddPress={() => setIsComposerOpen(true)}
          onFilterChange={setActiveFilter}
          onOpenPost={(post) => {
            void handleOpenPost(post);
          }}
          onOpenTarget={handleOpenTarget}
          posts={filteredPosts}
        />
      ) : activeTab === "tribuna" ? (
        <TribunaTab
          commentDrafts={tribunaCommentDrafts}
          isLoading={isLoadingTribuna}
          mode={mode}
          onChangeCommentDraft={(postId, value) =>
            setTribunaCommentDrafts((current) => ({ ...current, [postId]: value }))
          }
          onChangeQuestionDraft={(postId, value) =>
            setTribunaQuestionDrafts((current) => ({ ...current, [postId]: value }))
          }
          onComment={(post) => {
            void handleAddTribunaComment(post);
          }}
          onCreatePress={() => setIsTribunaCreateMenuOpen(true)}
          onOpenArticle={(articleId) => {
            void handleOpenLinkedArticle(articleId);
          }}
          onOpenPlayer={onOpenProfile}
          onQuestionVote={(post, question) => {
            void handleToggleTribunaQuestionVote(post, question);
          }}
          onSave={(post) => {
            void handleToggleTribunaSave(post);
          }}
          onSubmitQuestion={(post) => {
            void handleSubmitTribunaQuestion(post);
          }}
          onVote={(post, optionId) => {
            void handleVoteTribunaOption(post, optionId);
          }}
          posts={tribunaPosts}
          questionDrafts={tribunaQuestionDrafts}
        />
      ) : (
        <MediaInfoPanel
          areaLabel={areaLabel}
          channelLabels={channelLabels}
          coverageLabel={coverageLabel}
          mediaProfile={mediaProfile}
          profileTypeLabel={profileTypeLabel}
        />
      )}

      <MediaPostDetailModal
        displayName={displayName}
        isLoading={isLoadingDetail}
        onAddComment={async (body) => {
          if (!selectedPost || !viewerProfileId) {
            Alert.alert("Accesso richiesto", "Accedi per commentare.");
            return;
          }

          const comment = await addMediaProfilePostComment({
            body,
            postId: selectedPost.id,
            profileId: viewerProfileId,
          });
          const nextComments = [...selectedPost.comments, comment];
          handlePatchPost(selectedPost.id, {
            comment_count: selectedPost.comment_count + 1,
            comments: nextComments,
          });
        }}
        onClose={handleClosePost}
        onOpenTarget={handleOpenTarget}
        onShare={(post) => {
          void sharePost(post);
        }}
        onToggleSave={(post) => {
          void handleToggleSave(post);
        }}
        post={selectedPost}
      />

      <MediaPostComposerModal
        defaultAuthorName={profile.full_name}
        mediaProfileId={mediaProfileId}
        onClose={() => setIsComposerOpen(false)}
        onCreated={(post) => {
          void handleCreated(post);
        }}
        userId={viewerProfileId ?? null}
        visible={isComposerOpen}
      />
      <MediaTribunaCreateMenuModal
        onClose={() => setIsTribunaCreateMenuOpen(false)}
        onSelect={(kind) => {
          setIsTribunaCreateMenuOpen(false);
          setTribunaComposerKind(kind);
        }}
        visible={isTribunaCreateMenuOpen}
      />
      <MediaTribunaComposerModal
        articles={posts.filter((post) => post.kind === "article")}
        kind={tribunaComposerKind}
        mediaProfileId={mediaProfileId}
        onClose={() => setTribunaComposerKind(null)}
        onCreated={(post) => {
          void handleCreatedTribuna(post);
        }}
        userId={viewerProfileId ?? null}
        visible={tribunaComposerKind !== null}
      />
    </View>
  );
}

function ArticlesTab({
  activeFilter,
  displayName,
  isLoading,
  mode,
  onAddPress,
  onFilterChange,
  onOpenPost,
  onOpenTarget,
  posts,
}: {
  activeFilter: ArticleFilter;
  displayName: string;
  isLoading: boolean;
  mode: "owner" | "visitor";
  onAddPress: () => void;
  onFilterChange: (filter: ArticleFilter) => void;
  onOpenPost: (post: MediaProfilePost) => void;
  onOpenTarget: (target: MediaProfilePostTaggedTarget) => void;
  posts: MediaProfilePost[];
}) {
  return (
    <View style={styles.articlesRoot} testID="media-articles-tab">
      <View style={styles.articlesHeader}>
        <View style={styles.articlesHeaderText}>
          <AppText variant="titleSm">Articoli</AppText>
          <AppText color="secondary" numberOfLines={1} variant="bodySm">
            Letture rapide da {displayName}
          </AppText>
        </View>
        {mode === "owner" ? (
          <Button
            accessibilityLabel="Crea nuovo articolo media"
            label="+ Nuovo"
            onPress={onAddPress}
            size="sm"
            testID="media-article-new-button"
            variant="primary"
          />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.filterContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        {ARTICLE_FILTERS.map((filter) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === filter.value }}
            key={filter.value}
            onPress={() => onFilterChange(filter.value)}
            style={[
              styles.filterChip,
              activeFilter === filter.value ? styles.filterChipActive : null,
            ]}
            testID={`media-article-filter-${filter.value}`}
          >
            <AppText
              style={[
                styles.filterChipText,
                activeFilter === filter.value ? styles.filterChipTextActive : null,
              ]}
              variant="caption"
            >
              {filter.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingState}>
          <AppText color="secondary" variant="bodySm">
            Caricamento articoli...
          </AppText>
        </View>
      ) : posts.length > 0 ? (
        <View style={styles.feedList}>
          {posts.map((post) => (
            <ArticleListRow
              key={post.id}
              onOpen={onOpenPost}
              onOpenTarget={onOpenTarget}
              post={post}
            />
          ))}
        </View>
      ) : (
        <MediaEmptyState
          icon="newspaper-outline"
          text={
            mode === "owner"
              ? "Pubblica articoli e news per rendere il profilo una testata viva dentro FootMe."
              : "Questo profilo media non ha ancora pubblicato articoli."
          }
          title="Nessun articolo"
        />
      )}
    </View>
  );
}

function TribunaTab({
  commentDrafts,
  isLoading,
  mode,
  onChangeCommentDraft,
  onChangeQuestionDraft,
  onComment,
  onCreatePress,
  onOpenArticle,
  onOpenPlayer,
  onQuestionVote,
  onSave,
  onSubmitQuestion,
  onVote,
  posts,
  questionDrafts,
}: {
  commentDrafts: Record<string, string>;
  isLoading: boolean;
  mode: "owner" | "visitor";
  onChangeCommentDraft: (postId: string, value: string) => void;
  onChangeQuestionDraft: (postId: string, value: string) => void;
  onComment: (post: MediaTribunaPost) => void;
  onCreatePress: () => void;
  onOpenArticle: (articleId: string) => void;
  onOpenPlayer?: (profileId: string) => void;
  onQuestionVote: (post: MediaTribunaPost, question: MediaTribunaQuestion) => void;
  onSave: (post: MediaTribunaPost) => void;
  onSubmitQuestion: (post: MediaTribunaPost) => void;
  onVote: (post: MediaTribunaPost, optionId: string) => void;
  posts: MediaTribunaPost[];
  questionDrafts: Record<string, string>;
}) {
  return (
    <View style={styles.tribunaRoot} testID="media-tribuna-tab">
      <View style={styles.tribunaIntroBlock}>
        <View style={styles.tribunaIntroText}>
          <AppText variant="titleSm">Tribuna</AppText>
          <AppText color="secondary" style={styles.tribunaIntroCopy} variant="bodySm">
            Dibattiti, sondaggi e domande per coinvolgere la community.
          </AppText>
        </View>
        {mode === "owner" ? (
          <Button
            accessibilityLabel="Crea contenuto Tribuna"
            label="+ Crea"
            onPress={onCreatePress}
            size="sm"
            testID="media-tribuna-create-button"
            variant="primary"
          />
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <AppText color="secondary" variant="bodySm">
            Caricamento Tribuna...
          </AppText>
        </View>
      ) : posts.length > 0 ? (
        <View style={styles.tribunaFeed} testID="media-tribuna-feed">
          {posts.map((post) => (
            <MediaTribunaCard
              commentDraft={commentDrafts[post.id] ?? ""}
              key={post.id}
              onChangeCommentDraft={(value) => onChangeCommentDraft(post.id, value)}
              onChangeQuestionDraft={(value) => onChangeQuestionDraft(post.id, value)}
              onComment={() => onComment(post)}
              onOpenArticle={onOpenArticle}
              onOpenPlayer={onOpenPlayer}
              onQuestionVote={(question) => onQuestionVote(post, question)}
              onSave={() => onSave(post)}
              onSubmitQuestion={() => onSubmitQuestion(post)}
              onVote={(optionId) => onVote(post, optionId)}
              post={post}
              questionDraft={questionDrafts[post.id] ?? ""}
            />
          ))}
        </View>
      ) : (
        <MediaEmptyState
          icon="chatbubbles-outline"
          text={
            mode === "owner"
              ? "Apri un sondaggio, un dibattito o un Q&A per coinvolgere la community."
              : "Questo profilo media non ha ancora aperto discussioni."
          }
          title="Tribuna vuota"
        />
      )}
    </View>
  );
}

function MediaTribunaCard({
  commentDraft,
  onChangeCommentDraft,
  onChangeQuestionDraft,
  onComment,
  onOpenArticle,
  onOpenPlayer,
  onQuestionVote,
  onSave,
  onSubmitQuestion,
  onVote,
  post,
  questionDraft,
}: {
  commentDraft: string;
  onChangeCommentDraft: (value: string) => void;
  onChangeQuestionDraft: (value: string) => void;
  onComment: () => void;
  onOpenArticle: (articleId: string) => void;
  onOpenPlayer?: (profileId: string) => void;
  onQuestionVote: (question: MediaTribunaQuestion) => void;
  onSave: () => void;
  onSubmitQuestion: () => void;
  onVote: (optionId: string) => void;
  post: MediaTribunaPost;
  questionDraft: string;
}) {
  return (
    <View style={styles.tribunaItem} testID={`media-tribuna-card-${post.kind}`}>
      <View style={styles.tribunaItemHeader}>
        <View style={styles.tribunaTypeLabel}>
          <Ionicons color="#0A56B8" name={getTribunaIcon(post.kind)} size={14} />
          <AppText style={styles.tribunaTypeText} variant="caption">
            {getTribunaLabel(post.kind)}
          </AppText>
        </View>
        <AppText color="secondary" variant="caption">
          {formatPostDate(post.published_at ?? post.created_at)}
        </AppText>
      </View>

      <AppText style={styles.tribunaQuestion} variant="titleSm">
        {post.title}
      </AppText>

      {post.body ? (
        <AppText color="secondary" style={styles.tribunaBody} variant="bodySm">
          {post.body}
        </AppText>
      ) : null}

      {post.linked_article ? (
        <Pressable
          accessibilityLabel={`Apri articolo ${post.linked_article.title}`}
          accessibilityRole="button"
          onPress={() => onOpenArticle(post.linked_article!.id)}
          style={({ pressed }) => [
            styles.linkedArticleCard,
            pressed ? styles.pressedRow : null,
          ]}
          testID={`media-tribuna-linked-article-${post.linked_article.id}`}
        >
          {post.linked_article.cover_url ? (
            <Image
              accessibilityLabel={`Copertina ${post.linked_article.title}`}
              source={{ uri: post.linked_article.cover_url }}
              style={styles.linkedArticleImage}
            />
          ) : (
            <View style={[styles.linkedArticleImage, styles.linkedArticlePlaceholder]}>
              <Ionicons color={colors.accent} name="newspaper-outline" size={18} />
            </View>
          )}
          <View style={styles.linkedArticleText}>
            <AppText color="accent" style={styles.linkedArticleTag} variant="caption">
              {post.linked_article.category}
            </AppText>
            <AppText numberOfLines={2} style={styles.linkedArticleTitle} variant="bodySm">
              {post.linked_article.title}
            </AppText>
            <AppText color="accent" variant="caption">
              Leggi articolo
            </AppText>
          </View>
        </Pressable>
      ) : null}

      {post.options.length > 0 ? (
        <View style={styles.tribunaPollOptions}>
          {post.options.map((option) => (
            <TribunaOptionRow
              key={option.id}
              onOpenPlayer={onOpenPlayer}
              onVote={() => onVote(option.id)}
              option={option}
              showPlayer={post.kind === "player_vote"}
              totalVoteCount={post.total_vote_count}
            />
          ))}
          <AppText color="secondary" variant="caption">
            {formatCount(post.total_vote_count)} voti • {formatCount(post.comment_count)} commenti
          </AppText>
        </View>
      ) : null}

      {post.kind === "community_qa" ? (
        <View style={styles.qaBlock}>
          <AppText color="secondary" variant="caption">
            {formatCount(post.question_count)} domande • {formatCount(post.comment_count)} commenti
          </AppText>
          {post.questions.slice(0, 3).map((question) => (
            <View key={question.id} style={styles.qaItem}>
              <Pressable
                accessibilityLabel={`Vota domanda ${question.body}`}
                accessibilityRole="button"
                accessibilityState={{ selected: question.is_voted }}
                onPress={() => onQuestionVote(question)}
                style={[
                  styles.qaVoteButton,
                  question.is_voted ? styles.qaVoteButtonActive : null,
                ]}
                testID={`media-tribuna-question-vote-${question.id}`}
              >
                <Ionicons
                  color={question.is_voted ? colors.inkInvert : colors.accent}
                  name="chevron-up"
                  size={18}
                />
                <AppText
                  color={question.is_voted ? "inverse" : "accent"}
                  variant="caption"
                >
                  {formatCount(question.vote_count)}
                </AppText>
              </Pressable>
              <View style={styles.qaTextBlock}>
                <AppText style={styles.qaText} variant="bodySm">
                  {question.body}
                </AppText>
                <AppText color="secondary" variant="caption">
                  {question.author_name}
                </AppText>
              </View>
            </View>
          ))}
          <View style={styles.inlineComposer}>
            <Input
              onChangeText={onChangeQuestionDraft}
              placeholder="Scrivi una domanda per la community"
              style={styles.inlineInput}
              value={questionDraft}
            />
            <Button
              label="Invia"
              onPress={onSubmitQuestion}
              size="sm"
              variant="secondary"
            />
          </View>
        </View>
      ) : post.options.length === 0 ? (
        <AppText color="secondary" style={styles.tribunaStatsOnly} variant="caption">
          {formatCount(post.comment_count)} commenti
        </AppText>
      ) : null}

      <View style={styles.tribunaActionsRow}>
        <TribunaMiniActionButton
          icon={post.kind === "article_debate" ? "chatbox-outline" : "checkmark-circle-outline"}
          label={post.kind === "article_debate" ? "Partecipa" : "Vota"}
          onPress={() => undefined}
        />
        <TribunaMiniActionButton
          icon="chatbubble-outline"
          label="Commenta"
          onPress={() => undefined}
        />
        <TribunaMiniActionButton
          icon={post.is_saved ? "bookmark" : "bookmark-outline"}
          label="Salva"
          onPress={onSave}
          testID={`media-tribuna-save-${post.id}`}
        />
      </View>

      {post.comments.length > 0 ? (
        <View style={styles.tribunaCommentsPreview}>
          {post.comments.slice(0, 2).map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <Avatar
                name={comment.author_name}
                size="sm"
                uri={comment.author_avatar_url}
              />
              <View style={styles.commentText}>
                <AppText numberOfLines={1} style={styles.commentAuthor} variant="caption">
                  {comment.author_name}
                </AppText>
                <AppText color="secondary" variant="bodySm">
                  {comment.body}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.inlineComposer}>
        <Input
          onChangeText={onChangeCommentDraft}
          placeholder="Scrivi un commento"
          style={styles.inlineInput}
          value={commentDraft}
        />
        <Button label="Invia" onPress={onComment} size="sm" variant="secondary" />
      </View>
    </View>
  );
}

function TribunaOptionRow({
  onOpenPlayer,
  onVote,
  option,
  showPlayer,
  totalVoteCount,
}: {
  onOpenPlayer?: (profileId: string) => void;
  onVote: () => void;
  option: MediaTribunaOption;
  showPlayer: boolean;
  totalVoteCount: number;
}) {
  const playerLabel = option.player_display_name ?? option.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: option.is_voted }}
      onPress={onVote}
      style={({ pressed }) => [
        styles.tribunaPollOption,
        option.is_voted ? styles.tribunaPollOptionSelected : null,
        pressed ? styles.pressedRow : null,
      ]}
      testID={`media-tribuna-option-${option.id}`}
    >
      <View
        pointerEvents="none"
        style={[styles.tribunaPollFill, { width: `${option.percentage}%` }]}
      />
      <View style={styles.tribunaPollContent}>
        {showPlayer ? (
          <Pressable
            accessibilityLabel={`Apri profilo ${playerLabel}`}
            accessibilityRole="button"
            disabled={!option.player_profile_id}
            onPress={(event) => {
              event.stopPropagation();
              if (option.player_profile_id) {
                onOpenPlayer?.(option.player_profile_id);
              }
            }}
            style={styles.playerOptionButton}
          >
            <Avatar
              name={playerLabel}
              size="sm"
              uri={option.player_avatar_url}
            />
            <AppText color="accent" numberOfLines={1} style={styles.playerOptionName} variant="bodySm">
              {playerLabel}
            </AppText>
          </Pressable>
        ) : (
          <AppText numberOfLines={1} style={styles.pollOptionLabel} variant="bodySm">
            {option.label}
          </AppText>
        )}
        <AppText color="secondary" style={styles.pollOptionPercent} variant="caption">
          {totalVoteCount > 0 ? `${option.percentage}%` : "Vota"}
        </AppText>
      </View>
    </Pressable>
  );
}

function TribunaMiniActionButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tribunaMiniAction,
        pressed ? styles.pressedRow : null,
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={17} />
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function ArticleListRow({
  onOpen,
  onOpenTarget,
  post,
}: {
  onOpen: (post: MediaProfilePost) => void;
  onOpenTarget: (target: MediaProfilePostTaggedTarget) => void;
  post: MediaProfilePost;
}) {
  const meta = buildFeedMeta(post);
  const previewUrl = post.cover_url || DEFAULT_MEDIA_COVER_URI;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(post)}
      style={({ pressed }) => [styles.articleRow, pressed ? styles.pressedRow : null]}
      testID={`media-article-row-${post.id}`}
    >
      <View style={styles.thumbnailFrame}>
        <Image
          accessibilityLabel={`Copertina ${post.title}`}
          source={{ uri: previewUrl }}
          style={styles.thumbnailImage}
        />
        {post.cover_type === "video" ? (
          <View style={styles.thumbVideoOverlay}>
            <Ionicons color={colors.inkInvert} name="play" size={13} />
          </View>
        ) : null}
      </View>

      <View style={styles.articleTextColumn}>
        <View style={styles.typeRow}>
          <ArticleTypeBadge kind={post.kind} />
          <AppText color="secondary" numberOfLines={1} style={styles.categoryText} variant="caption">
            {post.category}
          </AppText>
        </View>
        <AppText numberOfLines={2} style={styles.articleTitle} variant="bodySm">
          {post.title}
        </AppText>
        {post.excerpt || post.subtitle ? (
          <AppText color="secondary" numberOfLines={2} style={styles.articleExcerpt} variant="bodySm">
            {post.excerpt ?? post.subtitle}
          </AppText>
        ) : null}
        <AppText color="secondary" numberOfLines={1} style={styles.articleMeta} variant="caption">
          {meta}
        </AppText>
        {post.tagged_targets.length > 0 ? (
          <TaggedTargetsInline
            compact
            onOpenTarget={onOpenTarget}
            targets={post.tagged_targets}
          />
        ) : null}
        <AppText color="accent" style={styles.readCta} variant="caption">
          Leggi
        </AppText>
      </View>
    </Pressable>
  );
}

function MediaPostDetailModal({
  displayName,
  isLoading,
  onAddComment,
  onClose,
  onOpenTarget,
  onShare,
  onToggleSave,
  post,
}: {
  displayName: string;
  isLoading: boolean;
  onAddComment: (body: string) => Promise<void>;
  onClose: () => void;
  onOpenTarget: (target: MediaProfilePostTaggedTarget) => void;
  onShare: (post: MediaProfilePost) => void;
  onToggleSave: (post: MediaProfilePost) => void;
  post: MediaProfilePost | null;
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const postId = post?.id ?? null;

  useEffect(() => {
    if (postId) {
      setCommentDraft("");
      setIsCommenting(false);
      setIsVideoOpen(false);
    }
  }, [postId]);

  if (!post) {
    return null;
  }

  const showHero = post.kind === "article" || Boolean(post.cover_url);
  const heroUrl = post.cover_url || DEFAULT_MEDIA_COVER_URI;

  async function handleComment() {
    if (!commentDraft.trim()) {
      Alert.alert("Commento vuoto", "Scrivi un commento prima di pubblicare.");
      return;
    }

    setIsCommenting(true);

    try {
      await onAddComment(commentDraft);
      setCommentDraft("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Commento non pubblicato.";
      Alert.alert("Errore", message);
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible>
      <SafeAreaView style={styles.detailRoot}>
        <View style={styles.detailTopBar}>
          <Pressable
            accessibilityLabel="Chiudi articolo"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.detailIconButton}
          >
            <Ionicons color={colors.textPrimary} name="chevron-back" size={23} />
          </Pressable>
          <AppText numberOfLines={1} style={styles.detailTopTitle} variant="titleSm">
            {post.kind === "article" ? "Articolo" : "News"}
          </AppText>
          <Pressable
            accessibilityLabel="Condividi articolo"
            accessibilityRole="button"
            onPress={() => onShare(post)}
            style={styles.detailIconButton}
          >
            <Ionicons color={colors.textPrimary} name="share-outline" size={21} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.detailScrollContent}>
          {showHero ? (
            post.cover_type === "video" && post.cover_url ? (
              <Pressable
                accessibilityLabel="Riproduci video di copertina"
                accessibilityRole="button"
                onPress={() => setIsVideoOpen(true)}
                style={styles.detailHero}
              >
                <Image source={{ uri: heroUrl }} style={styles.detailHeroImage} />
                <View style={styles.detailVideoOverlay}>
                  <Ionicons color={colors.textPrimary} name="play" size={20} />
                </View>
              </Pressable>
            ) : (
              <Image
                accessibilityLabel={`Copertina ${post.title}`}
                source={{ uri: heroUrl }}
                style={styles.detailHero}
              />
            )
          ) : null}

          <View style={styles.detailBody}>
            {isLoading ? (
              <AppText color="secondary" style={styles.detailLoading} variant="bodySm">
                Aggiornamento articolo...
              </AppText>
            ) : null}
            <View style={styles.detailTypeBlock}>
              <ArticleTypeBadge kind={post.kind} />
              <AppText color="secondary" style={styles.detailCategory} variant="overline">
                {post.category}
              </AppText>
            </View>
            <AppText style={styles.detailTitle} variant="headingLg">
              {post.title}
            </AppText>
            {post.subtitle || post.excerpt ? (
              <AppText color="secondary" style={styles.detailSubtitle} variant="bodyLg">
                {post.subtitle ?? post.excerpt}
              </AppText>
            ) : null}
            <AppText color="secondary" style={styles.authorLine} variant="bodySm">
              {buildDetailAuthorLine(post, displayName)}
            </AppText>

            {post.body ? <ArticleBodyText body={post.body} /> : null}

            {post.tagged_targets.length > 0 ? (
              <View style={styles.detailSection}>
                <AppText style={styles.detailSectionTitle} variant="titleSm">
                  Profili taggati
                </AppText>
                <TaggedTargetsInline
                  onOpenTarget={onOpenTarget}
                  targets={post.tagged_targets}
                />
              </View>
            ) : null}

            <View style={styles.detailActions}>
              <ActionButton
                icon="chatbubble-outline"
                label="Commenta"
                onPress={() => undefined}
              />
              <ActionButton
                icon={post.is_saved ? "bookmark" : "bookmark-outline"}
                label="Salva"
                onPress={() => onToggleSave(post)}
              />
              <ActionButton
                icon="share-outline"
                label="Condividi"
                onPress={() => onShare(post)}
              />
            </View>

            {post.external_url ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL(post.external_url!);
                }}
                style={styles.externalLinkCard}
                testID="media-article-external-link"
              >
                <View>
                  <AppText color="accent" style={styles.externalLinkTitle} variant="bodySm">
                    Leggi anche sul sito
                  </AppText>
                  <AppText color="secondary" numberOfLines={1} variant="caption">
                    Link esterno opzionale
                  </AppText>
                </View>
                <Ionicons color={colors.accent} name="open-outline" size={19} />
              </Pressable>
            ) : null}

            <View style={styles.commentBox}>
              <Input
                label="Commenta"
                multiline
                onChangeText={setCommentDraft}
                placeholder="Scrivi un commento..."
                style={styles.commentInput}
                value={commentDraft}
              />
              <Button
                disabled={isCommenting}
                label={isCommenting ? "Invio..." : "Pubblica commento"}
                onPress={() => {
                  void handleComment();
                }}
                size="sm"
                variant="secondary"
              />
            </View>

            {post.comments.length > 0 ? (
              <View style={styles.commentsPreview}>
                {post.comments.slice(0, 3).map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <Avatar
                      name={comment.author_name}
                      size="sm"
                      uri={comment.author_avatar_url}
                    />
                    <View style={styles.commentText}>
                      <AppText numberOfLines={1} style={styles.commentAuthor} variant="caption">
                        {comment.author_name}
                      </AppText>
                      <AppText variant="bodySm">{comment.body}</AppText>
                    </View>
                  </View>
                ))}
                {post.comment_count > 3 ? (
                  <AppText color="secondary" variant="caption">
                    Vedi tutti i {post.comment_count} commenti
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {post.cover_type === "video" && post.cover_url ? (
          <VideoPlayerModal
            onClose={() => setIsVideoOpen(false)}
            title={post.title}
            url={post.cover_url}
            visible={isVideoOpen}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function MediaPostComposerModal({
  defaultAuthorName,
  mediaProfileId,
  onClose,
  onCreated,
  userId,
  visible,
}: {
  defaultAuthorName: string;
  mediaProfileId: string;
  onClose: () => void;
  onCreated: (post: MediaProfilePost) => void;
  userId: string | null;
  visible: boolean;
}) {
  const [draft, setDraft] = useState<DraftState>(() =>
    createEmptyDraft(defaultAuthorName),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [targetQuery, setTargetQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MediaProfilePostTaggedTarget[]>([]);

  useEffect(() => {
    if (visible) {
      setDraft(createEmptyDraft(defaultAuthorName));
      setTargetQuery("");
      setSuggestions([]);
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [defaultAuthorName, visible]);

  useEffect(() => {
    let isMounted = true;
    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (targetQuery.trim().length < 2) {
          if (isMounted) {
            setSuggestions([]);
          }
          return;
        }

        try {
          const results = await searchMediaProfilePostTargets(targetQuery.trim());
          if (isMounted) {
            setSuggestions(results);
          }
        } catch {
          if (isMounted) {
            setSuggestions([]);
          }
        }
      }

      void loadSuggestions();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [targetQuery]);

  if (!visible) {
    return null;
  }

  const selectedTargetKeys = new Set(
    draft.taggedTargets.map((target) => getTargetKey(target)),
  );

  function patchDraft<Key extends keyof DraftState>(key: Key, value: DraftState[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handlePickCover() {
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per caricare una copertina.");
      return;
    }

    setIsUploading(true);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "media-profile-posts",
        mediaTypes: ["images", "videos"],
        userId,
      });

      const upload = uploads[0];
      if (!upload) {
        return;
      }

      patchDraft("coverUrl", upload.url);
      patchDraft("coverType", upload.type === "video" ? "video" : "image");
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento copertina non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleAddTarget(target: MediaProfilePostTaggedTarget) {
    if (selectedTargetKeys.has(getTargetKey(target))) {
      return;
    }

    patchDraft("taggedTargets", [...draft.taggedTargets, target]);
    setTargetQuery("");
    setSuggestions([]);
  }

  async function handleSave() {
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per pubblicare articoli.");
      return;
    }

    setIsSaving(true);

    try {
      const post = await createMediaProfilePost({
        authorName: draft.authorName,
        body: draft.body,
        category: draft.category,
        coverType: draft.coverType,
        coverUrl: draft.coverUrl,
        createdByProfileId: userId,
        excerpt: draft.excerpt,
        externalUrl: draft.externalUrl,
        kind: draft.kind,
        mediaProfileId,
        subtitle: draft.subtitle,
        taggedTargets: draft.taggedTargets,
        title: draft.title,
      });

      onCreated(post);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pubblicazione non riuscita.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.formRoot}>
        <View style={styles.formHeader}>
          <Pressable
            accessibilityLabel="Chiudi creazione articolo"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.detailIconButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={22} />
          </Pressable>
          <AppText variant="titleSm">Crea contenuto</AppText>
          <View style={styles.detailIconButton} />
        </View>

        <KeyboardAwareForm contentContainerStyle={styles.formContent}>
          <View style={styles.kindSwitch}>
            {(["article", "news"] as const).map((kind) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: draft.kind === kind }}
                key={kind}
                onPress={() => patchDraft("kind", kind)}
                style={[
                  styles.kindButton,
                  draft.kind === kind ? styles.kindButtonActive : null,
                ]}
                testID={`media-composer-kind-${kind}`}
              >
                <Ionicons
                  color={draft.kind === kind ? colors.inkInvert : colors.textSecondary}
                  name={kind === "article" ? "document-text-outline" : "flash-outline"}
                  size={16}
                />
                <AppText
                  color={draft.kind === kind ? "inverse" : "secondary"}
                  style={styles.kindButtonText}
                  variant="bodySm"
                >
                  {kind === "article" ? "Articolo" : "News"}
                </AppText>
              </Pressable>
            ))}
          </View>

          <Input
            label="Titolo"
            onChangeText={(value) => patchDraft("title", value)}
            placeholder="Inserisci il titolo..."
            value={draft.title}
          />

          <MediaPickerField
            buttonLabel={draft.coverUrl ? "Sostituisci copertina" : "Carica copertina"}
            helperText={
              draft.kind === "article"
                ? "Immagine o video di apertura dell'articolo."
                : "Opzionale per una news breve."
            }
            isUploading={isUploading}
            label="Immagine o video di copertina"
            mediaType={draft.coverType ?? "image"}
            onPick={handlePickCover}
            previewUrl={draft.coverUrl || null}
          />

          <View style={styles.categoryPicker}>
            <AppText color="secondary" style={styles.formLabel} variant="caption">
              Categoria
            </AppText>
            <View style={styles.categoryOptions}>
              {CATEGORY_VALUES.map((category) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.category === category }}
                  key={category}
                  onPress={() => patchDraft("category", category)}
                  style={[
                    styles.categoryOption,
                    draft.category === category ? styles.categoryOptionActive : null,
                  ]}
                >
                  <AppText
                    color={draft.category === category ? "inverse" : "secondary"}
                    variant="caption"
                  >
                    {category}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          <Input
            label={draft.kind === "article" ? "Sottotitolo" : "Anteprima"}
            multiline
            onChangeText={(value) =>
              draft.kind === "article"
                ? patchDraft("subtitle", value)
                : patchDraft("excerpt", value)
            }
            placeholder="Scrivi una breve introduzione..."
            value={draft.kind === "article" ? draft.subtitle : draft.excerpt}
          />

          <Input
            label={draft.kind === "article" ? "Testo articolo" : "Testo news"}
            multiline
            onChangeText={(value) => patchDraft("body", value)}
            placeholder="Scrivi il contenuto..."
            style={styles.bodyInput}
            value={draft.body}
          />

          <Input
            label="Autore"
            onChangeText={(value) => patchDraft("authorName", value)}
            placeholder="Nome autore..."
            value={draft.authorName}
          />

          <View style={styles.tagPicker}>
            <Input
              label="Profili taggati"
              onChangeText={setTargetQuery}
              placeholder="Cerca societa, giocatori o allenatori..."
              value={targetQuery}
            />
            {draft.taggedTargets.length > 0 ? (
              <TaggedTargetsInline
                onOpenTarget={(target) =>
                  patchDraft(
                    "taggedTargets",
                    draft.taggedTargets.filter(
                      (entry) => getTargetKey(entry) !== getTargetKey(target),
                    ),
                  )
                }
                removable
                targets={draft.taggedTargets}
              />
            ) : null}
            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((target) => (
                  <Pressable
                    accessibilityRole="button"
                    disabled={selectedTargetKeys.has(getTargetKey(target))}
                    key={getTargetKey(target)}
                    onPress={() => handleAddTarget(target)}
                    style={styles.suggestionRow}
                  >
                    <Avatar name={target.display_name} size="sm" uri={target.avatar_url} />
                    <View style={styles.suggestionText}>
                      <AppText numberOfLines={1} variant="bodySm">
                        {target.display_name}
                      </AppText>
                      <AppText color="secondary" numberOfLines={1} variant="caption">
                        {target.subtitle ?? formatTargetRole(target.role)}
                      </AppText>
                    </View>
                    {selectedTargetKeys.has(getTargetKey(target)) ? (
                      <Ionicons color={colors.success} name="checkmark" size={18} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <Input
            autoCapitalize="none"
            label="Link esterno (opzionale)"
            onChangeText={(value) => patchDraft("externalUrl", value)}
            placeholder="https://..."
            value={draft.externalUrl}
          />
        </KeyboardAwareForm>

        <View style={styles.formFooter}>
          <Button
            disabled={isUploading || isSaving}
            label={isSaving ? "Pubblicazione..." : "Pubblica"}
            onPress={() => {
              void handleSave();
            }}
            testID="media-composer-publish-button"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function MediaTribunaCreateMenuModal({
  onClose,
  onSelect,
  visible,
}: {
  onClose: () => void;
  onSelect: (kind: MediaTribunaKind) => void;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.sheetOverlay}>
        <Pressable
          accessibilityLabel="Chiudi menu Tribuna"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.sheetBackdrop}
        />
        <View style={styles.sheetPanel}>
          <AppText align="center" style={styles.sheetTitle} variant="titleSm">
            Crea contenuto Tribuna
          </AppText>
          {TRIBUNA_CREATE_OPTIONS.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.kind}
              onPress={() => onSelect(option.kind)}
              style={({ pressed }) => [
                styles.sheetOption,
                pressed ? styles.pressedRow : null,
              ]}
              testID={`media-tribuna-create-option-${option.kind}`}
            >
              <View style={styles.sheetIcon}>
                <Ionicons color={colors.accent} name={option.icon} size={21} />
              </View>
              <View style={styles.sheetOptionText}>
                <AppText variant="bodySm">{option.title}</AppText>
                <AppText color="secondary" variant="caption">
                  {option.description}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function MediaTribunaComposerModal({
  articles,
  kind,
  mediaProfileId,
  onClose,
  onCreated,
  userId,
  visible,
}: {
  articles: MediaProfilePost[];
  kind: TribunaDraftKind;
  mediaProfileId: string;
  onClose: () => void;
  onCreated: (post: MediaTribunaPost) => void;
  userId: string | null;
  visible: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerSuggestions, setPlayerSuggestions] = useState<
    MediaTribunaPlayerOptionInput[]
  >([]);
  const [selectedPlayers, setSelectedPlayers] = useState<
    MediaTribunaPlayerOptionInput[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setBody("");
      setOptions(["", ""]);
      setSelectedArticleId(articles[0]?.id ?? null);
      setPlayerQuery("");
      setPlayerSuggestions([]);
      setSelectedPlayers([]);
      setIsSaving(false);
    }
  }, [articles, visible]);

  useEffect(() => {
    if (!visible || kind !== "player_vote") {
      return;
    }

    let isMounted = true;
    const timeout = setTimeout(() => {
      async function loadPlayers() {
        if (playerQuery.trim().length < 2) {
          if (isMounted) {
            setPlayerSuggestions([]);
          }
          return;
        }

        try {
          const results = await searchMediaProfilePostTargets(playerQuery.trim());
          if (isMounted) {
            setPlayerSuggestions(
              results
                .filter(
                  (target) =>
                    target.target_type === "profile" && target.role === "player",
                )
                .map((target) => ({
                  avatarUrl: target.avatar_url,
                  displayName: target.display_name,
                  playerProfileId: target.target_id,
                })),
            );
          }
        } catch {
          if (isMounted) {
            setPlayerSuggestions([]);
          }
        }
      }

      void loadPlayers();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [kind, playerQuery, visible]);

  if (!visible || !kind) {
    return null;
  }

  const canPublish =
    kind === "editorial_poll"
      ? title.trim().length > 0 && options.filter((option) => option.trim()).length >= 2
      : kind === "article_debate"
        ? title.trim().length > 0 && Boolean(selectedArticleId)
        : kind === "player_vote"
          ? title.trim().length > 0 && selectedPlayers.length >= 2
          : title.trim().length > 0;

  function addPlayer(player: MediaTribunaPlayerOptionInput) {
    if (
      selectedPlayers.some(
        (entry) => entry.playerProfileId === player.playerProfileId,
      )
    ) {
      return;
    }

    setSelectedPlayers((current) => [...current, player]);
    setPlayerQuery("");
    setPlayerSuggestions([]);
  }

  async function handleSave() {
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per pubblicare in Tribuna.");
      return;
    }

    setIsSaving(true);

    try {
      const createdPost =
        kind === "editorial_poll"
          ? await createMediaTribunaPoll({
              createdByProfileId: userId,
              mediaProfileId,
              options,
              question: title,
            })
          : kind === "article_debate"
            ? await createMediaArticleDebate({
                articleId: selectedArticleId ?? "",
                body,
                createdByProfileId: userId,
                mediaProfileId,
                question: title,
              })
            : kind === "player_vote"
              ? await createMediaPlayerVote({
                  body,
                  createdByProfileId: userId,
                  mediaProfileId,
                  options: selectedPlayers,
                  title,
                })
              : await createMediaCommunityQa({
                  body,
                  createdByProfileId: userId,
                  mediaProfileId,
                  title,
                });

      onCreated(createdPost);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pubblicazione non riuscita.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.formRoot}>
        <View style={styles.formHeader}>
          <Pressable
            accessibilityLabel="Chiudi creazione Tribuna"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.detailIconButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={22} />
          </Pressable>
          <AppText numberOfLines={1} style={styles.createModalTitle} variant="titleSm">
            {getTribunaCreateTitle(kind)}
          </AppText>
          <View style={styles.detailIconButton} />
        </View>

        <KeyboardAwareForm contentContainerStyle={styles.formContent}>
          {kind === "article_debate" ? (
            <View style={styles.articleSelectBlock}>
              <AppText color="secondary" style={styles.formLabel} variant="caption">
                Seleziona articolo
              </AppText>
              {articles.length > 0 ? (
                articles.map((article) => {
                  const isSelected = selectedArticleId === article.id;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={article.id}
                      onPress={() => setSelectedArticleId(article.id)}
                      style={[
                        styles.articleSelectRow,
                        isSelected ? styles.articleSelectRowActive : null,
                      ]}
                      testID={`media-tribuna-article-select-${article.id}`}
                    >
                      <AppText numberOfLines={2} style={styles.articleSelectTitle} variant="bodySm">
                        {article.title}
                      </AppText>
                      {isSelected ? (
                        <Ionicons color={colors.accent} name="checkmark" size={18} />
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <AppText color="secondary" variant="bodySm">
                  Pubblica un articolo prima di aprire un dibattito collegato.
                </AppText>
              )}
            </View>
          ) : null}

          <Input
            label={kind === "community_qa" || kind === "player_vote" ? "Titolo" : "Domanda"}
            onChangeText={setTitle}
            placeholder={getTribunaTitlePlaceholder(kind)}
            value={title}
          />

          {kind === "editorial_poll" ? (
            <>
              {options.map((option, index) => (
                <Input
                  key={`tribuna-option-${index}`}
                  label={`Opzione ${index + 1}`}
                  onChangeText={(value) =>
                    setOptions((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? value : entry,
                      ),
                    )
                  }
                  placeholder={
                    index === 0
                      ? "Difesa"
                      : index === 1
                        ? "Centrocampo"
                        : "Altra opzione"
                  }
                  value={option}
                />
              ))}
              {options.length < 6 ? (
                <Button
                  label="Aggiungi opzione"
                  onPress={() => setOptions((current) => [...current, ""])}
                  variant="outline"
                />
              ) : null}
            </>
          ) : null}

          {kind === "player_vote" ? (
            <View style={styles.playerPickerBlock}>
              <Input
                label="Giocatori votabili"
                onChangeText={setPlayerQuery}
                placeholder="Cerca giocatore..."
                value={playerQuery}
              />
              {selectedPlayers.length > 0 ? (
                <View style={styles.selectedPlayers}>
                  {selectedPlayers.map((player) => (
                    <Pressable
                      accessibilityLabel={`Rimuovi ${player.displayName}`}
                      accessibilityRole="button"
                      key={player.playerProfileId}
                      onPress={() =>
                        setSelectedPlayers((current) =>
                          current.filter(
                            (entry) =>
                              entry.playerProfileId !== player.playerProfileId,
                          ),
                        )
                      }
                      style={styles.selectedPlayerChip}
                    >
                      <Avatar
                        name={player.displayName}
                        size="sm"
                        uri={player.avatarUrl ?? null}
                      />
                      <AppText numberOfLines={1} style={styles.selectedPlayerText} variant="caption">
                        {player.displayName}
                      </AppText>
                      <Ionicons color={colors.accent} name="close" size={14} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {playerSuggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  {playerSuggestions.map((player) => (
                    <Pressable
                      accessibilityRole="button"
                      key={player.playerProfileId}
                      onPress={() => addPlayer(player)}
                      style={styles.suggestionRow}
                    >
                      <Avatar
                        name={player.displayName}
                        size="sm"
                        uri={player.avatarUrl ?? null}
                      />
                      <View style={styles.suggestionText}>
                        <AppText numberOfLines={1} variant="bodySm">
                          {player.displayName}
                        </AppText>
                        <AppText color="secondary" variant="caption">
                          Calciatore
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {kind !== "editorial_poll" ? (
            <Input
              label={kind === "community_qa" ? "Descrizione breve" : "Contesto breve"}
              multiline
              onChangeText={setBody}
              placeholder={getTribunaBodyPlaceholder(kind)}
              value={body}
            />
          ) : null}
        </KeyboardAwareForm>

        <View style={styles.formFooter}>
          <Button
            disabled={!canPublish || isSaving}
            label={isSaving ? "Pubblicazione..." : "Pubblica"}
            loading={isSaving}
            onPress={() => {
              void handleSave();
            }}
            testID="media-tribuna-publish-button"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function MediaMetaLine({
  accent = false,
  icon,
  text,
}: {
  accent?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.metaLine}>
      <Ionicons
        color={accent ? colors.accent : colors.textSecondary}
        name={icon}
        size={14}
      />
      <AppText
        color={accent ? "accent" : "secondary"}
        numberOfLines={1}
        style={styles.metaText}
        variant="caption"
      >
        {text}
      </AppText>
    </View>
  );
}

function MediaTabButton({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.tab}
      testID={testID}
    >
      <AppText
        style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextInactive]}
        variant="titleSm"
      >
        {label}
      </AppText>
      <View style={[styles.tabIndicator, active ? styles.tabIndicatorActive : null]} />
    </Pressable>
  );
}

function MediaEmptyState({
  icon,
  text,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  title: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons color={colors.textMuted} name={icon} size={28} />
      <AppText style={styles.emptyTitle} variant="titleSm">
        {title}
      </AppText>
      <AppText align="center" color="secondary" style={styles.emptyText} variant="bodySm">
        {text}
      </AppText>
    </View>
  );
}

function MediaInfoPanel({
  areaLabel,
  channelLabels,
  coverageLabel,
  mediaProfile,
  profileTypeLabel,
}: {
  areaLabel: string;
  channelLabels: string;
  coverageLabel: string;
  mediaProfile: CompleteProfessionalProfile["mediaProfile"];
  profileTypeLabel: string;
}) {
  const description = mediaProfile?.short_description?.trim();
  const affiliation = normalizeUniqueValues([
    mediaProfile?.affiliation_type,
    mediaProfile?.affiliation_name,
  ]).join(" • ");

  return (
    <View style={styles.infoPanel}>
      <InfoRow label="Tipologia" value={profileTypeLabel} />
      <InfoRow label="Copertura" value={coverageLabel} />
      <InfoRow label="Area" value={areaLabel} />
      <InfoRow label="Canali" value={channelLabels || "Da completare"} />
      {affiliation ? <InfoRow label="Affiliazione" value={affiliation} /> : null}
      {description ? <InfoRow label="Descrizione" value={description} /> : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText color="secondary" variant="overline">
        {label}
      </AppText>
      <AppText variant="bodySm">{value}</AppText>
    </View>
  );
}

function ArticleTypeBadge({ kind }: { kind: MediaProfilePostKind }) {
  return (
    <View style={styles.typeBadge}>
      <Ionicons
        color="#0A56B8"
        name={kind === "article" ? "document-text-outline" : "flash-outline"}
        size={12}
      />
      <AppText style={styles.typeBadgeText} variant="caption">
        {kind === "article" ? "Articolo" : "News"}
      </AppText>
    </View>
  );
}

function getTribunaLabel(kind: MediaTribunaKind) {
  if (kind === "article_debate") {
    return "Dibattito da articolo";
  }

  if (kind === "player_vote") {
    return "Vota il migliore";
  }

  if (kind === "community_qa") {
    return "Q&A community";
  }

  return "Sondaggio editoriale";
}

function getTribunaIcon(kind: MediaTribunaKind): keyof typeof Ionicons.glyphMap {
  if (kind === "article_debate") {
    return "chatbox-outline";
  }

  if (kind === "player_vote") {
    return "star-outline";
  }

  if (kind === "community_qa") {
    return "help-circle-outline";
  }

  return "bar-chart-outline";
}

function TaggedTargetsInline({
  compact = false,
  onOpenTarget,
  removable = false,
  targets,
}: {
  compact?: boolean;
  onOpenTarget: (target: MediaProfilePostTaggedTarget) => void;
  removable?: boolean;
  targets: MediaProfilePostTaggedTarget[];
}) {
  const visibleTargets = compact ? targets.slice(0, 2) : targets;

  return (
    <View style={[styles.taggedTargets, compact ? styles.taggedTargetsCompact : null]}>
      {visibleTargets.map((target) => (
        <Pressable
          accessibilityLabel={`${removable ? "Rimuovi" : "Apri"} ${target.display_name}`}
          accessibilityRole="button"
          key={getTargetKey(target)}
          onPress={(event) => {
            event.stopPropagation();
            onOpenTarget(target);
          }}
          style={[styles.targetChip, compact ? styles.targetChipCompact : null]}
        >
          {!compact ? (
            <Avatar name={target.display_name} size="sm" uri={target.avatar_url} />
          ) : null}
          <AppText numberOfLines={1} style={styles.targetChipText} variant="caption">
            {target.display_name}
          </AppText>
          {removable ? (
            <Ionicons color={colors.accent} name="close" size={14} />
          ) : null}
        </Pressable>
      ))}
      {compact && targets.length > visibleTargets.length ? (
        <View style={styles.targetChipCompact}>
          <AppText color="secondary" variant="caption">
            +{targets.length - visibleTargets.length}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed ? styles.pressedRow : null]}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={18} />
      <AppText style={styles.actionLabel} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function ArticleBodyText({ body }: { body: string }) {
  const paragraphs = body
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <View style={styles.articleBody}>
      {paragraphs.map((paragraph, index) => {
        const isQuote = paragraph.startsWith(">");
        const text = isQuote ? paragraph.replace(/^>\s*/, "") : paragraph;

        return (
          <AppText
            key={`${index}-${text.slice(0, 12)}`}
            style={isQuote ? styles.articleQuote : styles.articleParagraph}
            variant={isQuote ? "titleSm" : "bodyLg"}
          >
            {text}
          </AppText>
        );
      })}
    </View>
  );
}

async function sharePost(post: MediaProfilePost) {
  await Share.share({
    message: post.external_url
      ? `${post.title}\n${post.external_url}`
      : post.subtitle || post.excerpt || post.title,
    title: post.title,
  });
}

function buildVotedTribunaState(post: MediaTribunaPost, optionId: string) {
  const previousVotedOption = post.options.find((option) => option.is_voted);
  const hasPreviousVote = Boolean(previousVotedOption);
  const totalVoteCount = post.total_vote_count + (hasPreviousVote ? 0 : 1);
  const options = post.options.map((option) => {
    const wasVoted = option.is_voted;
    const isVoted = option.id === optionId;
    const voteCount =
      option.vote_count + (isVoted && !wasVoted ? 1 : 0) - (!isVoted && wasVoted ? 1 : 0);

    return {
      ...option,
      is_voted: isVoted,
      percentage:
        totalVoteCount > 0 ? Math.round((Math.max(0, voteCount) / totalVoteCount) * 100) : 0,
      vote_count: Math.max(0, voteCount),
    };
  });

  return { options, total_vote_count: totalVoteCount };
}

function sortTribunaQuestions(questions: MediaTribunaQuestion[]) {
  return [...questions].sort((left, right) => {
    if (left.vote_count !== right.vote_count) {
      return right.vote_count - left.vote_count;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

function getTribunaCreateTitle(kind: MediaTribunaKind) {
  if (kind === "article_debate") {
    return "Crea dibattito da articolo";
  }

  if (kind === "player_vote") {
    return "Crea vota il migliore";
  }

  if (kind === "community_qa") {
    return "Crea Q&A community";
  }

  return "Crea sondaggio editoriale";
}

function getTribunaTitlePlaceholder(kind: MediaTribunaKind) {
  if (kind === "article_debate") {
    return "Che tipo di profilo servirebbe davvero?";
  }

  if (kind === "player_vote") {
    return "Migliore in campo - Como U19 vs Lecco U19";
  }

  if (kind === "community_qa") {
    return "Fai una domanda al DS del Como";
  }

  return "Quale reparto deve rinforzare il Como?";
}

function getTribunaBodyPlaceholder(kind: MediaTribunaKind) {
  if (kind === "article_debate") {
    return "Raccogliamo il parere della community dopo l'articolo.";
  }

  if (kind === "player_vote") {
    return "Aggiungi un contesto breve sulla gara.";
  }

  return "Le domande piu votate saranno usate nella prossima intervista.";
}

function createEmptyDraft(authorName: string): DraftState {
  return {
    authorName,
    body: "",
    category: "Mercato",
    coverType: null,
    coverUrl: "",
    excerpt: "",
    externalUrl: "",
    kind: "article",
    subtitle: "",
    taggedTargets: [],
    title: "",
  };
}

function buildFeedMeta(post: MediaProfilePost) {
  return [
    `di ${post.author_name}`,
    formatPostDate(post.published_at ?? post.created_at),
    post.kind === "article" ? `${post.reading_time_minutes} min` : null,
    formatCommentCount(post.comment_count),
  ]
    .filter(Boolean)
    .join(" • ");
}

function buildDetailAuthorLine(post: MediaProfilePost, displayName: string) {
  return [
    `di ${post.author_name} - ${displayName}`,
    formatPostDate(post.published_at ?? post.created_at),
    post.kind === "article" ? `${post.reading_time_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function formatCommentCount(count: number) {
  return count === 1 ? "1 commento" : `${count} commenti`;
}

function formatCount(count: number) {
  if (count >= 1000) {
    const rounded = Math.round((count / 1000) * 10) / 10;
    return `${String(rounded).replace(".", ",")}k`;
  }

  return String(count);
}

function formatPostDate(value: string | null) {
  if (!value) {
    return "Oggi";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Oggi";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) {
    return "Ora";
  }

  if (diffHours < 24) {
    return `${diffHours} ore fa`;
  }

  if (diffHours < 48) {
    return "Ieri";
  }

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });
}

function getTargetKey(target: MediaProfilePostTaggedTarget) {
  return `${target.target_type}:${target.target_id}`;
}

function formatTargetRole(role: string | null) {
  if (role === "club") {
    return "Societa";
  }

  if (role === "player") {
    return "Calciatore";
  }

  if (role === "coach") {
    return "Allenatore";
  }

  if (role === "staff") {
    return "Staff";
  }

  return "Profilo";
}

function buildMediaProfileTypeLabel(affiliationType: string | null | undefined) {
  const normalized = affiliationType?.trim().toLowerCase() ?? "";

  if (normalized.includes("testata") || normalized.includes("sito")) {
    return "Testata giornalistica / Media sportivo";
  }

  if (normalized.includes("pagina") || normalized.includes("progetto")) {
    return "Creator sportivo / Pagina tifosi";
  }

  if (normalized.includes("societa") || normalized.includes("società")) {
    return "Canale ufficiale / Comunicazione sportiva";
  }

  if (normalized === "nessuna") {
    return "Creator sportivo / Pagina tifosi";
  }

  return "Media sportivo / Fonte editoriale";
}

function buildAreaLabel(completeProfile: CompleteProfessionalProfile) {
  const profile = completeProfile.profile;
  const country =
    profile.current_location_country ||
    profile.residence_country ||
    profile.nationality ||
    "";
  const formattedCountry = formatCountryLabel(country);

  if (formattedCountry) {
    return formattedCountry;
  }

  return (
    [profile.city, profile.region].filter(Boolean).join(" • ") ||
    "Area da completare"
  );
}

function buildChannelItems(
  contacts: CompleteProfessionalProfile["userContacts"],
): ChannelItem[] {
  const website = normalizeWebsiteInput(contacts.website);
  const instagram = normalizeInstagramInput(contacts.instagram);
  const youtube = normalizeExternalUrl(contacts.youtube ?? "");
  const tiktok = normalizeExternalUrl(contacts.tiktok ?? "");
  const facebook = normalizeFacebookInput(contacts.facebook);

  return [
    contacts.showWebsite && website
      ? { key: "website", label: "Sito web", url: website }
      : null,
    contacts.showInstagram && instagram
      ? { key: "instagram", label: "Instagram", url: instagram }
      : null,
    contacts.showYouTube && youtube
      ? { key: "youtube", label: "YouTube", url: youtube }
      : null,
    contacts.showTikTok && tiktok
      ? { key: "tiktok", label: "TikTok", url: tiktok }
      : null,
    contacts.showFacebook && facebook
      ? { key: "facebook", label: "Facebook", url: facebook }
      : null,
  ].filter(Boolean) as ChannelItem[];
}

function normalizeUniqueValues(values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();

    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalizedValues.push(normalized);
  });

  return normalizedValues;
}

function normalizeWebsiteInput(value: string | null | undefined) {
  const normalized = normalizeExternalUrl(value ?? "");
  return normalized && !normalized.includes("instagram.com") ? normalized : "";
}

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^www\./i.test(trimmed) || trimmed.includes(".")) {
    return `https://${trimmed}`;
  }

  return "";
}

function formatCountryLabel(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (normalized.toUpperCase() === "IT") {
    return "Italia";
  }

  return normalized;
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 44,
  },
  actionLabel: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[24],
  },
  articleBody: {
    gap: spacing[14],
    marginTop: spacing[8],
  },
  articleExcerpt: {
    lineHeight: 19,
  },
  articleMeta: {
    lineHeight: 17,
  },
  articleParagraph: {
    color: colors.textPrimary,
    lineHeight: 25,
  },
  articleQuote: {
    borderLeftColor: "#0A56B8",
    borderLeftWidth: 3,
    color: "#061223",
    lineHeight: 23,
    marginVertical: spacing[8],
    paddingLeft: spacing[14],
  },
  articleRow: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  articleTextColumn: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  articleTitle: {
    color: "#061223",
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 20,
  },
  articlesHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  articlesHeaderText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  articlesRoot: {
    backgroundColor: colors.surface,
  },
  authorLine: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    lineHeight: 20,
    marginBottom: spacing[18],
    paddingBottom: spacing[18],
  },
  bodyInput: {
    minHeight: 150,
  },
  categoryOption: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    minHeight: 36,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  categoryOptionActive: {
    backgroundColor: "#061223",
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  categoryPicker: {
    gap: spacing[8],
  },
  categoryText: {
    flex: 1,
    textTransform: "uppercase",
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  commentBox: {
    gap: spacing[10],
    marginTop: spacing[18],
  },
  commentInput: {
    minHeight: 80,
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  commentText: {
    flex: 1,
    gap: spacing[4],
  },
  commentsPreview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    gap: spacing[12],
    marginTop: spacing[16],
    padding: spacing[12],
  },
  coverageText: {
    lineHeight: 20,
  },
  detailActions: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[22],
    paddingTop: spacing[12],
  },
  detailBody: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
  },
  detailCategory: {
    letterSpacing: 0,
  },
  detailHero: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceMuted,
    width: "100%",
  },
  detailHeroImage: {
    height: "100%",
    width: "100%",
  },
  detailIconButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  detailLoading: {
    marginBottom: spacing[8],
  },
  detailRoot: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  detailScrollContent: {
    paddingBottom: spacing[40],
  },
  detailSection: {
    gap: spacing[10],
    marginTop: spacing[22],
  },
  detailSectionTitle: {
    color: colors.textPrimary,
  },
  detailSubtitle: {
    lineHeight: 23,
    marginBottom: spacing[16],
  },
  detailTitle: {
    color: "#061223",
    fontWeight: typography.fontWeight.bold,
    lineHeight: 30,
    marginBottom: spacing[10],
  },
  detailTopBar: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 54,
    justifyContent: "space-between",
    paddingHorizontal: spacing[8],
  },
  detailTopTitle: {
    flex: 1,
    textAlign: "center",
  },
  detailTypeBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    marginBottom: spacing[12],
  },
  detailVideoOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    left: "50%",
    marginLeft: -24,
    marginTop: -24,
    position: "absolute",
    top: "50%",
    width: 48,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[36],
  },
  emptyText: {
    maxWidth: 280,
  },
  emptyTitle: {
    marginTop: spacing[4],
  },
  externalLinkCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[22],
    padding: spacing[14],
  },
  externalLinkTitle: {
    fontWeight: typography.fontWeight.semibold,
  },
  feedList: {
    backgroundColor: colors.surface,
  },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    minHeight: 34,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
  },
  filterChipActive: {
    backgroundColor: "#061223",
  },
  filterChipText: {
    color: "#061223",
    fontWeight: typography.fontWeight.semibold,
  },
  filterChipTextActive: {
    color: colors.inkInvert,
  },
  filterContent: {
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  filterScroll: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  followButton: {
    flex: 1.2,
  },
  formContent: {
    gap: spacing[18],
    padding: spacing[16],
    paddingBottom: spacing[32],
  },
  formFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[16],
  },
  formHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: spacing[8],
  },
  formLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
  formRoot: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  headerBody: {
    paddingHorizontal: spacing[16],
  },
  headerSurface: {
    backgroundColor: colors.surface,
  },
  heroImage: {
    height: "100%",
    width: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 20, 28, 0.38)",
  },
  heroSection: {
    backgroundColor: "#1E1720",
    height: 140,
    overflow: "hidden",
    width: "100%",
  },
  identityBlock: {
    gap: spacing[4],
    marginBottom: spacing[18],
  },
  infoBlock: {
    gap: spacing[8],
    marginBottom: spacing[20],
  },
  infoPanel: {
    backgroundColor: colors.surface,
    gap: spacing[14],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[20],
  },
  infoRow: {
    gap: spacing[4],
  },
  kindButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flex: 1,
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "center",
    minHeight: 42,
  },
  kindButtonActive: {
    backgroundColor: "#061223",
  },
  kindButtonText: {
    fontWeight: typography.fontWeight.semibold,
  },
  kindSwitch: {
    flexDirection: "row",
    gap: spacing[8],
  },
  loadingState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[28],
  },
  logoImage: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    borderRadius: 20,
    borderWidth: 4,
    height: 80,
    width: 80,
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    marginBottom: spacing[12],
    marginTop: -40,
  },
  metaLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  metaText: {
    flex: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
  },
  ownerActionsRow: {
    justifyContent: "flex-start",
  },
  ownerWebsiteButton: {
    minWidth: 148,
  },
  pressedRow: {
    opacity: 0.78,
  },
  profileName: {
    color: "#061223",
    flexShrink: 1,
    fontWeight: typography.fontWeight.bold,
  },
  profileType: {
    fontWeight: typography.fontWeight.medium,
  },
  readCta: {
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing[4],
  },
  root: {
    backgroundColor: colors.background,
  },
  suggestionRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 52,
    paddingVertical: spacing[10],
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[12],
  },
  tab: {
    alignItems: "center",
    flex: 1,
    height: 52,
    justifyContent: "center",
    position: "relative",
  },
  tabIndicator: {
    backgroundColor: "transparent",
    borderTopLeftRadius: radius[4],
    borderTopRightRadius: radius[4],
    bottom: 0,
    height: 3,
    left: spacing[16],
    position: "absolute",
    right: spacing[16],
  },
  tabIndicatorActive: {
    backgroundColor: "#0A56B8",
  },
  tabText: {
    fontWeight: typography.fontWeight.medium,
  },
  tabTextActive: {
    color: "#061223",
    fontWeight: typography.fontWeight.semibold,
    opacity: 1,
  },
  tabTextInactive: {
    color: "#061223",
    opacity: 0.6,
  },
  tabsContainer: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  tagPicker: {
    gap: spacing[10],
  },
  taggedTargets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  taggedTargetsCompact: {
    gap: spacing[6],
  },
  targetChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 36,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  targetChipCompact: {
    minHeight: 26,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  targetChipText: {
    color: colors.textPrimary,
    maxWidth: 150,
  },
  thumbVideoOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    left: "50%",
    marginLeft: -16,
    marginTop: -16,
    position: "absolute",
    top: "50%",
    width: 32,
  },
  thumbnailFrame: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 86,
    overflow: "hidden",
    width: 86,
  },
  thumbnailImage: {
    height: "100%",
    width: "100%",
  },
  articleSelectBlock: {
    gap: spacing[8],
  },
  articleSelectRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[10],
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  articleSelectRowActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  articleSelectTitle: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
  },
  createModalTitle: {
    flex: 1,
    textAlign: "center",
  },
  inlineComposer: {
    gap: spacing[8],
    marginTop: spacing[12],
  },
  inlineInput: {
    minHeight: 44,
    paddingVertical: spacing[10],
  },
  linkedArticleCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[14],
    padding: spacing[10],
  },
  linkedArticleImage: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    height: 64,
    width: 64,
  },
  linkedArticlePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  linkedArticleTag: {
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  linkedArticleText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  linkedArticleTitle: {
    color: "#061223",
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 19,
  },
  playerOptionButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 36,
    minWidth: 0,
  },
  playerOptionName: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
  },
  playerPickerBlock: {
    gap: spacing[10],
  },
  pollOptionLabel: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
    minWidth: 0,
  },
  pollOptionPercent: {
    fontWeight: typography.fontWeight.bold,
  },
  qaBlock: {
    gap: spacing[10],
    marginTop: spacing[4],
  },
  qaItem: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[10],
  },
  qaText: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 20,
  },
  qaTextBlock: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  qaVoteButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[6],
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    minWidth: 44,
    paddingVertical: spacing[4],
  },
  qaVoteButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selectedPlayerChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 40,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  selectedPlayerText: {
    color: colors.accentStrong,
    maxWidth: 140,
  },
  selectedPlayers: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sheetOption: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[14],
    minHeight: 74,
    paddingVertical: spacing[12],
  },
  sheetOptionText: {
    flex: 1,
    gap: spacing[4],
  },
  sheetOverlay: {
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
  },
  sheetTitle: {
    marginBottom: spacing[8],
  },
  tribunaActionsRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[18],
    marginTop: spacing[14],
    paddingTop: spacing[12],
  },
  tribunaBody: {
    lineHeight: 20,
    marginBottom: spacing[12],
  },
  tribunaCommentsPreview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    gap: spacing[10],
    marginTop: spacing[12],
    padding: spacing[10],
  },
  tribunaFeed: {
    backgroundColor: colors.surfaceMuted,
    gap: spacing[10],
    paddingVertical: spacing[10],
  },
  tribunaIntroBlock: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  tribunaIntroCopy: {
    lineHeight: 19,
  },
  tribunaIntroText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  tribunaItem: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[16],
  },
  tribunaItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[8],
  },
  tribunaMiniAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 44,
  },
  tribunaPollContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minWidth: 0,
    width: "100%",
  },
  tribunaPollFill: {
    backgroundColor: "rgba(10, 86, 184, 0.14)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  tribunaPollOption: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    minHeight: 44,
    overflow: "hidden",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  tribunaPollOptionSelected: {
    backgroundColor: colors.accentSoft,
  },
  tribunaPollOptions: {
    gap: spacing[8],
    marginTop: spacing[4],
  },
  tribunaQuestion: {
    color: "#061223",
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 22,
    marginBottom: spacing[10],
  },
  tribunaRoot: {
    backgroundColor: colors.surface,
  },
  tribunaStatsOnly: {
    marginTop: spacing[4],
  },
  tribunaTypeLabel: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  tribunaTypeText: {
    color: "#0A56B8",
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  typeBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(10, 86, 184, 0.1)",
    borderRadius: radius[4],
    flexDirection: "row",
    gap: spacing[4],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  typeBadgeText: {
    color: "#0A56B8",
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  typeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  websiteButton: {
    flex: 1,
  },
});
