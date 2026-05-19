import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  type ImageStyle,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ResizeMode, Video } from "expo-av";

import { VideoPlayerModal } from "../../components/ui/video-player-modal";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Avatar, Button, Input } from "../../ui";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  type UploadedMediaItem,
} from "./media-upload-service";
import { withDefaultProfileAvatar } from "./profile-avatar";
import {
  searchTeams,
  searchAgentPlayerCandidates,
  updateFanFavoriteTeam,
  type AgentPlayerCandidate,
  type CompleteProfessionalProfile,
} from "./profile-service";
import { TeamAutocompleteInput } from "./player-sports-section";
import {
  addFanTribunaComment,
  createFanTribunaFormation,
  createFanTribunaPoll,
  createFanTribunaProposal,
  FAN_TRIBUNA_FORMATIONS,
  fetchFanTribunaFeed,
  toggleFanTribunaSupport,
  toggleSavedFanTribuna,
  voteFanTribunaPoll,
  type FanTribunaFormation,
  type FanTribunaKind,
  type FanTribunaComment,
  type FanTribunaLineupPlayer,
  type FanTribunaPost,
  type FanTribunaTaggedPlayer,
} from "./fan-tribuna-service";
import {
  addFanMediaComment,
  createFanMediaPost,
  FAN_MEDIA_TAG_OPTIONS,
  fetchFanMediaFeed,
  fetchProfileFollowState,
  followProfile,
  toggleFanMediaLike,
  toggleSavedFanMedia,
  unfollowProfile,
  type FanMediaPost,
  type FanMediaTag,
  type FanMediaVisualType,
} from "./fan-media-service";

const POST_TEXT_LIMIT = 280;
const TRIBUNA_TEXT_LIMIT = 480;

type FanProfileTab = "bacheca" | "tribuna";
type CreateContentKind = "post" | FanTribunaKind;

type FanProfileViewProps = {
  completeProfile: CompleteProfessionalProfile;
  mode: "owner" | "visitor";
  onOpenFavoriteClub?: (clubId: string) => void;
  onOpenPlayerProfile?: (profileId: string) => void;
  viewerProfileId?: string | null;
};

type DraftPostState = {
  description: string;
  tag: FanMediaTag | null;
  thumbnailUrl: string | null;
  visualType: FanMediaVisualType | null;
  visualUrl: string;
};

const emptyDraft: DraftPostState = {
  description: "",
  tag: null,
  thumbnailUrl: null,
  visualType: null,
  visualUrl: "",
};

type DraftProposalState = {
  body: string;
  referenceCategory: string;
  referenceClubId: string | null;
  referenceTeamName: string;
  taggedPlayers: FanTribunaTaggedPlayer[];
  title: string;
};

type DraftFormationState = {
  body: string;
  formation: FanTribunaFormation;
  lineupPlayers: FanTribunaLineupPlayer[];
  referenceCategory: string;
  referenceClubId: string | null;
  referenceTeamName: string;
  selectedSlotKey: string | null;
  title: string;
};

const emptyProposalDraft: DraftProposalState = {
  body: "",
  referenceCategory: "",
  referenceClubId: null,
  referenceTeamName: "",
  taggedPlayers: [],
  title: "",
};

const emptyFormationDraft: DraftFormationState = {
  body: "",
  formation: "4-3-3",
  lineupPlayers: [],
  referenceCategory: "",
  referenceClubId: null,
  referenceTeamName: "",
  selectedSlotKey: null,
  title: "",
};

export function FanProfileView({
  completeProfile,
  mode,
  onOpenFavoriteClub,
  onOpenPlayerProfile,
  viewerProfileId,
}: FanProfileViewProps) {
  const [activeTab, setActiveTab] = useState<FanProfileTab>("bacheca");
  const [posts, setPosts] = useState<FanMediaPost[]>([]);
  const [tribunaPosts, setTribunaPosts] = useState<FanTribunaPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingTribuna, setIsLoadingTribuna] = useState(true);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tribunaComposerKind, setTribunaComposerKind] =
    useState<FanTribunaKind | null>(null);
  const [isFavoriteTeamModalOpen, setIsFavoriteTeamModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [tribunaCommentDrafts, setTribunaCommentDrafts] = useState<
    Record<string, string>
  >({});
  const [favoriteTeamName, setFavoriteTeamName] = useState(
    completeProfile.fanProfile?.favorite_team_name ?? "",
  );
  const [favoriteClubId, setFavoriteClubId] = useState<string | null>(
    completeProfile.fanProfile?.favorite_club_id ?? null,
  );
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const viewerScrollRef = useRef<ScrollView | null>(null);
  const viewportHeight = Dimensions.get("window").height;

  const profile = completeProfile.profile;
  const fanProfile = completeProfile.fanProfile ?? null;
  const avatarUrl = withDefaultProfileAvatar(profile.avatar_url);
  const orderedPosts = useMemo(
    () =>
      [...posts].sort((left, right) =>
        (right.published_at ?? right.created_at).localeCompare(
          left.published_at ?? left.created_at,
        ),
      ),
    [posts],
  );
  const orderedTribunaPosts = useMemo(
    () =>
      [...tribunaPosts].sort((left, right) =>
        (right.published_at ?? right.created_at).localeCompare(
          left.published_at ?? left.created_at,
        ),
      ),
    [tribunaPosts],
  );
  const selectedPost = selectedPostId
    ? orderedPosts.find((post) => post.id === selectedPostId) ?? null
    : null;
  const currentViewerPost = orderedPosts[activeViewerIndex] ?? selectedPost;

  const loadPosts = useCallback(async () => {
    setIsLoadingPosts(true);

    try {
      const data = await fetchFanMediaFeed(profile.id, viewerProfileId);
      setPosts(data);
    } catch {
      Alert.alert("Errore", "Impossibile caricare la bacheca.");
    } finally {
      setIsLoadingPosts(false);
    }
  }, [profile.id, viewerProfileId]);

  const loadTribunaPosts = useCallback(async () => {
    setIsLoadingTribuna(true);

    try {
      const data = await fetchFanTribunaFeed(profile.id, viewerProfileId);
      setTribunaPosts(data);
    } catch {
      Alert.alert("Errore", "Impossibile caricare la tribuna.");
    } finally {
      setIsLoadingTribuna(false);
    }
  }, [profile.id, viewerProfileId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void loadTribunaPosts();
  }, [loadTribunaPosts]);

  useEffect(() => {
    setFavoriteTeamName(completeProfile.fanProfile?.favorite_team_name ?? "");
    setFavoriteClubId(completeProfile.fanProfile?.favorite_club_id ?? null);
  }, [
    completeProfile.fanProfile?.favorite_club_id,
    completeProfile.fanProfile?.favorite_team_name,
  ]);

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

  useEffect(() => {
    if (selectedPostId !== null && viewerScrollRef.current && viewportHeight > 0) {
      viewerScrollRef.current.scrollTo({
        animated: false,
        y: activeViewerIndex * viewportHeight,
      });
    }
  }, [activeViewerIndex, selectedPostId, viewportHeight]);

  function patchPost(postId: string, patch: Partial<FanMediaPost>) {
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
  }

  function patchTribunaPost(postId: string, patch: Partial<FanTribunaPost>) {
    setTribunaPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
  }

  function handleOpenPost(postId: string) {
    const index = orderedPosts.findIndex((post) => post.id === postId);

    if (index < 0) {
      return;
    }

    setActiveViewerIndex(index);
    setSelectedPostId(postId);
  }

  function handleClosePost() {
    setSelectedPostId(null);
    setActiveViewerIndex(0);
    setIsVideoOpen(false);
  }

  function handleViewerScroll(offsetY: number) {
    if (viewportHeight <= 0 || orderedPosts.length === 0) {
      return;
    }

    const nextIndex = Math.round(offsetY / viewportHeight);
    setActiveViewerIndex(Math.max(0, Math.min(nextIndex, orderedPosts.length - 1)));
  }

  async function handleToggleFollow() {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per seguire questo profilo.");
      return;
    }

    const nextFollowed = !isFollowed;
    setIsFollowed(nextFollowed);
    setIsFollowing(true);

    try {
      if (nextFollowed) {
        await followProfile(viewerProfileId, profile.id);
      } else {
        await unfollowProfile(viewerProfileId, profile.id);
      }
    } catch {
      setIsFollowed(!nextFollowed);
      Alert.alert("Errore", "Non siamo riusciti ad aggiornare il follow.");
    } finally {
      setIsFollowing(false);
    }
  }

  async function handleToggleLike(post: FanMediaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per mettere Mi piace.");
      return;
    }

    const nextLiked = !post.is_liked;
    patchPost(post.id, {
      is_liked: nextLiked,
      like_count: Math.max(0, post.like_count + (nextLiked ? 1 : -1)),
    });

    try {
      await toggleFanMediaLike(viewerProfileId, post.id, nextLiked);
    } catch {
      patchPost(post.id, {
        is_liked: post.is_liked,
        like_count: post.like_count,
      });
      Alert.alert("Errore", "Impossibile aggiornare il Mi piace.");
    }
  }

  async function handleToggleSave(post: FanMediaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per salvare il contenuto.");
      return;
    }

    const nextSaved = !post.is_saved;
    patchPost(post.id, {
      is_saved: nextSaved,
      saved_count: Math.max(0, post.saved_count + (nextSaved ? 1 : -1)),
    });

    try {
      await toggleSavedFanMedia(viewerProfileId, post.id, nextSaved);
    } catch {
      patchPost(post.id, {
        is_saved: post.is_saved,
        saved_count: post.saved_count,
      });
      Alert.alert("Errore", "Impossibile aggiornare i salvati.");
    }
  }

  async function handleAddComment(post: FanMediaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per commentare.");
      return;
    }

    const draft = (commentDrafts[post.id] ?? "").trim();

    if (!draft) {
      return;
    }

    try {
      const comment = await addFanMediaComment({
        body: draft,
        postId: post.id,
        profileId: viewerProfileId,
      });
      patchPost(post.id, {
        comment_count: post.comment_count + 1,
        comments: [...post.comments, comment],
      });
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossibile pubblicare il commento.";
      Alert.alert("Errore", message);
    }
  }

  function handleCreated(post: FanMediaPost) {
    setPosts((currentPosts) => [post, ...currentPosts]);
    setIsCreateModalOpen(false);
  }

  function handleSelectCreateKind(kind: CreateContentKind) {
    setIsCreateMenuOpen(false);

    if (kind === "post") {
      setIsCreateModalOpen(true);
      return;
    }

    setTribunaComposerKind(kind);
  }

  function handleCreatedTribuna(post: FanTribunaPost) {
    setTribunaPosts((currentPosts) => [post, ...currentPosts]);
    setTribunaComposerKind(null);
    setActiveTab("tribuna");
  }

  async function handleVotePoll(post: FanTribunaPost, optionId: string) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare il sondaggio.");
      return;
    }

    const previousOptionId = post.poll_options.find((option) => option.is_voted)?.id;

    if (previousOptionId === optionId) {
      return;
    }

    const nextTotal = post.total_vote_count + (previousOptionId ? 0 : 1);
    const nextOptions = post.poll_options.map((option) => {
      let voteCount = option.vote_count;

      if (option.id === previousOptionId) {
        voteCount = Math.max(0, voteCount - 1);
      }

      if (option.id === optionId) {
        voteCount += 1;
      }

      return {
        ...option,
        is_voted: option.id === optionId,
        percentage: nextTotal > 0 ? Math.round((voteCount / nextTotal) * 100) : 0,
        vote_count: voteCount,
      };
    });

    patchTribunaPost(post.id, {
      poll_options: nextOptions,
      total_vote_count: nextTotal,
    });

    try {
      await voteFanTribunaPoll({
        optionId,
        postId: post.id,
        profileId: viewerProfileId,
      });
    } catch {
      patchTribunaPost(post.id, {
        poll_options: post.poll_options,
        total_vote_count: post.total_vote_count,
      });
      Alert.alert("Errore", "Impossibile registrare il voto.");
    }
  }

  async function handleToggleTribunaSupport(post: FanTribunaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare questo contenuto.");
      return;
    }

    const nextSupported = !post.is_supported;
    patchTribunaPost(post.id, {
      is_supported: nextSupported,
      support_count: Math.max(0, post.support_count + (nextSupported ? 1 : -1)),
    });

    try {
      await toggleFanTribunaSupport(viewerProfileId, post.id, nextSupported);
    } catch {
      patchTribunaPost(post.id, {
        is_supported: post.is_supported,
        support_count: post.support_count,
      });
      Alert.alert("Errore", "Impossibile aggiornare il voto.");
    }
  }

  async function handleToggleTribunaSave(post: FanTribunaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per salvare il contenuto.");
      return;
    }

    const nextSaved = !post.is_saved;
    patchTribunaPost(post.id, {
      is_saved: nextSaved,
      saved_count: Math.max(0, post.saved_count + (nextSaved ? 1 : -1)),
    });

    try {
      await toggleSavedFanTribuna(viewerProfileId, post.id, nextSaved);
    } catch {
      patchTribunaPost(post.id, {
        is_saved: post.is_saved,
        saved_count: post.saved_count,
      });
      Alert.alert("Errore", "Impossibile aggiornare i salvati.");
    }
  }

  async function handleAddTribunaComment(post: FanTribunaPost) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per commentare.");
      return;
    }

    const draft = (tribunaCommentDrafts[post.id] ?? "").trim();

    if (!draft) {
      return;
    }

    try {
      const comment = await addFanTribunaComment({
        body: draft,
        postId: post.id,
        profileId: viewerProfileId,
      });
      patchTribunaPost(post.id, {
        comment_count: post.comment_count + 1,
        comments: [...post.comments, comment],
      });
      setTribunaCommentDrafts((current) => ({ ...current, [post.id]: "" }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossibile pubblicare il commento.";
      Alert.alert("Errore", message);
    }
  }

  return (
    <View style={styles.root} testID="fan-profile-view">
      <View style={styles.header}>
        <Avatar name={profile.full_name} size="xl" uri={avatarUrl} />
        <View style={styles.identity}>
          <AppText align="center" style={styles.name} variant="headingSm">
            {profile.full_name}
          </AppText>
          <AppText align="center" color="accent" style={styles.roleLabel} variant="bodySm">
            Appassionato calcio dilettantistico
          </AppText>
        </View>

        <View style={styles.infoStack}>
          <InfoLine
            label="Tifa:"
            onPress={
              mode === "owner"
                ? () => setIsFavoriteTeamModalOpen(true)
                : favoriteClubId && onOpenFavoriteClub
                  ? () => onOpenFavoriteClub(favoriteClubId)
                  : undefined
            }
            value={favoriteTeamName || "Da completare"}
          />
          {mode === "owner" ? (
            <Pressable
              accessibilityLabel="Modifica squadra tifata"
              accessibilityRole="button"
              onPress={() => setIsFavoriteTeamModalOpen(true)}
              style={({ pressed }) => [
                styles.editFavoriteTeamButton,
                pressed ? styles.pressed : null,
              ]}
              testID="fan-edit-favorite-team-button"
            >
              <Ionicons color={colors.accent} name="create-outline" size={14} />
              <AppText color="accent" style={styles.editFavoriteTeamText} variant="caption">
                Modifica squadra
              </AppText>
            </Pressable>
          ) : null}
          <InterestChips
            emptyLabel="Categorie da completare"
            label="Segue"
            values={fanProfile?.interest_categories}
          />
          <View style={styles.infoLine}>
            <Ionicons color={colors.textSecondary} name="location-outline" size={14} />
            <AppText color="secondary" style={styles.infoText} variant="bodySm">
              {formatAreaLabel(fanProfile?.interest_regions, profile.region)}
            </AppText>
          </View>
        </View>

        {mode === "visitor" ? (
          <Button
            fullWidth
            label={isFollowed ? "Seguito" : "Segui"}
            loading={isFollowing}
            onPress={handleToggleFollow}
            testID="fan-follow-button"
            variant={isFollowed ? "secondary" : "primary"}
          />
        ) : null}
      </View>

      <View style={styles.tabBar} testID="fan-profile-tabs">
        <ProfileTabButton
          active={activeTab === "bacheca"}
          label="Bacheca"
          onPress={() => setActiveTab("bacheca")}
        />
        <ProfileTabButton
          active={activeTab === "tribuna"}
          label="Tribuna"
          onPress={() => setActiveTab("tribuna")}
        />
      </View>

      {mode === "owner" ? (
        <View style={styles.publishActionWrap}>
          <Button
            fullWidth
            label="+ Crea"
            onPress={() => setIsCreateMenuOpen(true)}
            testID="fan-create-button"
            variant="secondary"
          />
        </View>
      ) : null}

      {activeTab === "bacheca" ? (
        isLoadingPosts ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.accent} />
            <AppText color="secondary" variant="bodySm">
              Caricamento bacheca...
            </AppText>
          </View>
        ) : orderedPosts.length > 0 ? (
          <View style={styles.feedList} testID="fan-bacheca-feed">
            {orderedPosts.map((post) => (
              <FanBachecaPostCard
                authorAvatarUrl={avatarUrl}
                authorName={profile.full_name}
                commentDraft={commentDrafts[post.id] ?? ""}
                key={post.id}
                onChangeComment={(value) =>
                  setCommentDrafts((current) => ({
                    ...current,
                    [post.id]: value,
                  }))
                }
                onComment={() => {
                  void handleAddComment(post);
                }}
                onLike={() => {
                  void handleToggleLike(post);
                }}
                onOpen={() => handleOpenPost(post.id)}
                onSave={() => {
                  void handleToggleSave(post);
                }}
                post={post}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons color={colors.textMuted} name="images-outline" size={28} />
            <AppText style={styles.emptyTitle} variant="titleSm">
              Nessun contenuto
            </AppText>
            <AppText align="center" color="secondary" style={styles.emptyText} variant="bodySm">
              {mode === "owner"
                ? "Pubblica foto e video dalla tua esperienza calcistica."
                : "Questo appassionato non ha ancora pubblicato contenuti."}
            </AppText>
          </View>
        )
      ) : isLoadingTribuna ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.accent} />
          <AppText color="secondary" variant="bodySm">
            Caricamento tribuna...
          </AppText>
        </View>
      ) : orderedTribunaPosts.length > 0 ? (
        <View style={styles.feedList} testID="fan-tribuna-feed">
          {orderedTribunaPosts.map((post) => (
            <FanTribunaPostCard
              commentDraft={tribunaCommentDrafts[post.id] ?? ""}
              key={post.id}
              onChangeComment={(value) =>
                setTribunaCommentDrafts((current) => ({
                  ...current,
                  [post.id]: value,
                }))
              }
              onComment={() => {
                void handleAddTribunaComment(post);
              }}
              onOpenPlayer={onOpenPlayerProfile}
              onSave={() => {
                void handleToggleTribunaSave(post);
              }}
              onSupport={() => {
                void handleToggleTribunaSupport(post);
              }}
              onVote={(optionId) => {
                void handleVotePoll(post, optionId);
              }}
              post={post}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons color={colors.textMuted} name="chatbubbles-outline" size={28} />
          <AppText style={styles.emptyTitle} variant="titleSm">
            Tribuna vuota
          </AppText>
          <AppText align="center" color="secondary" style={styles.emptyText} variant="bodySm">
            {mode === "owner"
              ? "Apri un sondaggio, una proposta o una formazione per la community."
              : "Questo appassionato non ha ancora aperto discussioni."}
          </AppText>
        </View>
      )}

      <Modal
        animationType="slide"
        onRequestClose={handleClosePost}
        visible={selectedPost !== null}
      >
        <SafeAreaView style={styles.viewerRoot} testID="fan-post-viewer">
          <View style={styles.viewerTopBar}>
            <Pressable
              accessibilityLabel="Chiudi post"
              accessibilityRole="button"
              onPress={handleClosePost}
              style={styles.viewerTopButton}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={23} />
            </Pressable>
            <AppText numberOfLines={1} style={styles.viewerTitle} variant="titleSm">
              Post
            </AppText>
            <View style={styles.viewerTopButton} />
          </View>

          <ScrollView
            bounces={false}
            onMomentumScrollEnd={(event) =>
              handleViewerScroll(event.nativeEvent.contentOffset.y)
            }
            pagingEnabled
            ref={viewerScrollRef}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {orderedPosts.map((post) => (
              <View
                key={post.id}
                style={[styles.viewerPage, { minHeight: viewportHeight || undefined }]}
              >
                <View style={styles.feedHeader}>
                  <Avatar name={profile.full_name} size="sm" uri={avatarUrl} />
                  <View style={styles.feedHeaderText}>
                    <AppText style={styles.feedAuthor} variant="bodySm">
                      {profile.full_name}
                    </AppText>
                    <AppText color="secondary" variant="caption">
                      {formatPostDate(post.published_at ?? post.created_at)}
                    </AppText>
                  </View>
                </View>

                <View style={styles.feedMediaFrame}>
                  <PostThumbnail
                    authorAvatarUrl={avatarUrl}
                    post={post}
                    style={styles.feedMedia}
                  />
                  {post.visual_type === "video" ? (
                    <Pressable
                      accessibilityLabel="Riproduci video"
                      accessibilityRole="button"
                      onPress={() => {
                        setActiveViewerIndex(
                          orderedPosts.findIndex((entry) => entry.id === post.id),
                        );
                        setIsVideoOpen(true);
                      }}
                      style={styles.feedPlayButton}
                    >
                      <Ionicons color={colors.inkInvert} name="play" size={28} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.feedActions}>
                  <IconAction
                    active={post.is_liked}
                    accessibilityLabel="Metti like al post"
                    icon={post.is_liked ? "heart" : "heart-outline"}
                    onPress={() => {
                      void handleToggleLike(post);
                    }}
                  />
                  <IconAction
                    accessibilityLabel="Apri commenti del post"
                    icon="chatbubble-outline"
                    onPress={() => {}}
                  />
                  <View style={styles.actionSpacer} />
                  <IconAction
                    active={post.is_saved}
                    accessibilityLabel="Salva post"
                    icon={post.is_saved ? "bookmark" : "bookmark-outline"}
                    onPress={() => {
                      void handleToggleSave(post);
                    }}
                  />
                </View>

                <View style={styles.feedText}>
                  <AppText style={styles.feedLikes} variant="bodySm">
                    {formatCount(post.like_count)} Mi piace
                  </AppText>
                  {post.tag ? (
                    <View style={styles.feedTag}>
                      <AppText color="accentStrong" style={styles.feedTagText} variant="caption">
                        {post.tag}
                      </AppText>
                    </View>
                  ) : null}
                  <AppText style={styles.feedDescription} variant="bodySm">
                    <AppText style={styles.feedAuthorInline} variant="bodySm">
                      {profile.full_name}
                    </AppText>{" "}
                    {post.description}
                  </AppText>

                  <View style={styles.commentsBlock}>
                    {post.comments.length > 0 ? (
                      post.comments.slice(0, 3).map((comment) => (
                        <View key={comment.id} style={styles.commentRow}>
                          <Avatar
                            name={comment.author_name}
                            size="sm"
                            uri={comment.author_avatar_url}
                          />
                          <View style={styles.commentText}>
                            <AppText style={styles.commentAuthor} variant="bodySm">
                              {comment.author_name}
                            </AppText>
                            <AppText color="secondary" variant="bodySm">
                              {comment.body}
                            </AppText>
                          </View>
                        </View>
                      ))
                    ) : (
                      <AppText color="secondary" variant="bodySm">
                        Nessun commento per ora.
                      </AppText>
                    )}
                  </View>

                  <View style={styles.commentComposer}>
                    <View style={styles.commentInputWrap}>
                      <Input
                        label="Commento"
                        onChangeText={(value) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: value,
                          }))
                        }
                        placeholder="Scrivi un commento"
                        value={commentDrafts[post.id] ?? ""}
                      />
                    </View>
                    <Button
                      disabled={!commentDrafts[post.id]?.trim()}
                      label="Invia"
                      onPress={() => {
                        void handleAddComment(post);
                      }}
                      size="sm"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {currentViewerPost?.visual_type === "video" ? (
            <VideoPlayerModal
              onClose={() => setIsVideoOpen(false)}
              title={currentViewerPost.tag ?? "Bacheca"}
              url={currentViewerPost.visual_url}
              visible={isVideoOpen}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      <FanCreatePostModal
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
        profileId={profile.id}
        userId={viewerProfileId ?? profile.id}
        visible={isCreateModalOpen}
      />
      <FanCreateMenuModal
        activeTab={activeTab}
        onClose={() => setIsCreateMenuOpen(false)}
        onSelect={handleSelectCreateKind}
        visible={isCreateMenuOpen}
      />
      <FanCreateTribunaModal
        kind={tribunaComposerKind}
        onClose={() => setTribunaComposerKind(null)}
        onCreated={handleCreatedTribuna}
        profileId={profile.id}
        visible={tribunaComposerKind !== null}
      />
      <FanFavoriteTeamModal
        favoriteClubId={favoriteClubId}
        favoriteTeamName={favoriteTeamName}
        onClose={() => setIsFavoriteTeamModalOpen(false)}
        onSaved={(nextFavorite) => {
          setFavoriteTeamName(nextFavorite.favoriteTeamName);
          setFavoriteClubId(nextFavorite.favoriteClubId);
          setIsFavoriteTeamModalOpen(false);
        }}
        profileId={profile.id}
        visible={isFavoriteTeamModalOpen}
      />
    </View>
  );
}

function ProfileTabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: "Bacheca" | "Tribuna";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active ? styles.tabButtonActive : null,
        pressed ? styles.pressed : null,
      ]}
      testID={`fan-tab-${label}`}
    >
      <AppText
        color={active ? "accent" : "secondary"}
        style={styles.tabButtonText}
        variant="bodySm"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function InterestChips({
  emptyLabel,
  label,
  values,
}: {
  emptyLabel: string;
  label: string;
  values: string[] | null | undefined;
}) {
  const normalizedValues = values?.filter(Boolean) ?? [];

  return (
    <View style={styles.interestBlock}>
      <AppText style={styles.infoLabel} variant="bodySm">
        {label}
      </AppText>
      {normalizedValues.length > 0 ? (
        <View style={styles.interestChips}>
          {normalizedValues.slice(0, 4).map((value) => (
            <View key={value} style={styles.interestChip}>
              <AppText color="accentStrong" numberOfLines={1} variant="caption">
                {value}
              </AppText>
            </View>
          ))}
        </View>
      ) : (
        <AppText color="secondary" style={styles.infoText} variant="bodySm">
          {emptyLabel}
        </AppText>
      )}
    </View>
  );
}

function FanBachecaPostCard({
  authorAvatarUrl,
  authorName,
  commentDraft,
  onChangeComment,
  onComment,
  onLike,
  onOpen,
  onSave,
  post,
}: {
  authorAvatarUrl: string;
  authorName: string;
  commentDraft: string;
  onChangeComment: (value: string) => void;
  onComment: () => void;
  onLike: () => void;
  onOpen: () => void;
  onSave: () => void;
  post: FanMediaPost;
}) {
  return (
    <View style={styles.feedCard} testID={`fan-bacheca-post-${post.id}`}>
      <View style={styles.feedHeader}>
        <Avatar name={authorName} size="sm" uri={authorAvatarUrl} />
        <View style={styles.feedHeaderText}>
          <AppText style={styles.feedAuthor} variant="bodySm">
            {authorName}
          </AppText>
          <AppText color="secondary" variant="caption">
            {formatPostDate(post.published_at ?? post.created_at)}
          </AppText>
        </View>
        {post.tag ? (
          <View style={styles.feedTagCompact} testID={`fan-bacheca-tag-${post.id}`}>
            <AppText color="accentStrong" numberOfLines={1} variant="caption">
              {post.tag}
            </AppText>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel="Apri post bacheca"
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          styles.feedMediaFrame,
          pressed ? styles.pressed : null,
        ]}
      >
        <PostThumbnail authorAvatarUrl={authorAvatarUrl} post={post} style={styles.feedMedia} />
        {post.visual_type === "video" ? (
          <View style={styles.feedPlayButton}>
            <Ionicons color={colors.inkInvert} name="play" size={28} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.feedActions}>
        <IconAction
          active={post.is_liked}
          accessibilityLabel="Metti like al post"
          icon={post.is_liked ? "heart" : "heart-outline"}
          onPress={onLike}
        />
        <IconAction
          accessibilityLabel="Commenta post"
          icon="chatbubble-outline"
          onPress={() => {}}
        />
        <View style={styles.actionSpacer} />
        <IconAction
          active={post.is_saved}
          accessibilityLabel="Salva post"
          icon={post.is_saved ? "bookmark" : "bookmark-outline"}
          onPress={onSave}
        />
      </View>

      <View style={styles.feedText}>
        <AppText style={styles.feedLikes} variant="bodySm">
          {formatCount(post.like_count)} Mi piace
        </AppText>
        <AppText style={styles.feedDescription} variant="bodySm">
          <AppText style={styles.feedAuthorInline} variant="bodySm">
            {authorName}
          </AppText>{" "}
          {post.description}
        </AppText>
        <CommentPreview comments={post.comments} emptyLabel="Nessun commento per ora." />
        <CommentComposer
          draft={commentDraft}
          onChangeDraft={onChangeComment}
          onSend={onComment}
        />
      </View>
    </View>
  );
}

function FanTribunaPostCard({
  commentDraft,
  onChangeComment,
  onComment,
  onOpenPlayer,
  onSave,
  onSupport,
  onVote,
  post,
}: {
  commentDraft: string;
  onChangeComment: (value: string) => void;
  onComment: () => void;
  onOpenPlayer?: (profileId: string) => void;
  onSave: () => void;
  onSupport: () => void;
  onVote: (optionId: string) => void;
  post: FanTribunaPost;
}) {
  const hasSupportAction = post.kind !== "poll";

  return (
    <View style={styles.tribunaCard} testID={`fan-tribuna-card-${post.kind}`}>
      <View style={styles.tribunaHeader}>
        <View style={[styles.formatBadge, getFormatBadgeStyle(post.kind)]}>
          <Ionicons
            color={colors.inkInvert}
            name={getTribunaIcon(post.kind)}
            size={15}
          />
          <AppText color="inverse" style={styles.formatBadgeText} variant="caption">
            {getTribunaLabel(post.kind)}
          </AppText>
        </View>
        <AppText color="secondary" variant="caption">
          {formatPostDate(post.published_at ?? post.created_at)}
        </AppText>
      </View>

      <AppText style={styles.tribunaTitle} variant="titleSm">
        {post.title}
      </AppText>

      {post.reference_team_name || post.reference_category ? (
        <View style={styles.referenceRow}>
          {post.reference_team_name ? (
            <View style={styles.referenceChip}>
              <Ionicons color={colors.accent} name="shield-outline" size={14} />
              <AppText color="accentStrong" numberOfLines={1} variant="caption">
                {post.reference_team_name}
              </AppText>
            </View>
          ) : null}
          {post.reference_category ? (
            <View style={styles.referenceChip}>
              <AppText color="accentStrong" numberOfLines={1} variant="caption">
                {post.reference_category}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      {post.body ? (
        <AppText color="secondary" style={styles.tribunaBody} variant="bodySm">
          {post.body}
        </AppText>
      ) : null}

      {post.kind === "poll" ? (
        <View style={styles.pollOptions}>
          {post.poll_options.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.is_voted }}
              key={option.id}
              onPress={() => onVote(option.id)}
              style={({ pressed }) => [
                styles.pollOption,
                option.is_voted ? styles.pollOptionSelected : null,
                pressed ? styles.pressed : null,
              ]}
              testID={`fan-poll-option-${option.id}`}
            >
              <View
                pointerEvents="none"
                style={[styles.pollFill, { width: `${option.percentage}%` }]}
              />
              <AppText style={styles.pollLabel} variant="bodySm">
                {option.label}
              </AppText>
              <AppText color="secondary" style={styles.pollPercent} variant="caption">
                {post.total_vote_count > 0 ? `${option.percentage}%` : "Vota"}
              </AppText>
            </Pressable>
          ))}
          <AppText color="secondary" variant="caption">
            {formatCount(post.total_vote_count)} voti
          </AppText>
        </View>
      ) : null}

      {post.kind === "proposal" && post.tagged_players.length > 0 ? (
        <TaggedPlayersRow onOpenPlayer={onOpenPlayer} players={post.tagged_players} />
      ) : null}

      {post.kind === "formation" ? (
        <FootballPitchPreview
          formation={post.formation ?? "4-3-3"}
          players={post.lineup_players}
        />
      ) : null}

      <View style={styles.tribunaActions}>
        {hasSupportAction ? (
          <Pressable
            accessibilityLabel="Vota contenuto tribuna"
            accessibilityRole="button"
            onPress={onSupport}
            style={({ pressed }) => [
              styles.tribunaActionButton,
              post.is_supported ? styles.tribunaActionButtonActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              color={post.is_supported ? colors.inkInvert : colors.accent}
              name={post.is_supported ? "thumbs-up" : "thumbs-up-outline"}
              size={16}
            />
            <AppText
              color={post.is_supported ? "inverse" : "accent"}
              style={styles.tribunaActionText}
              variant="caption"
            >
              {formatCount(post.support_count)}
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.tribunaActionMeta}>
          <Ionicons color={colors.textSecondary} name="chatbubble-outline" size={16} />
          <AppText color="secondary" variant="caption">
            {formatCount(post.comment_count)}
          </AppText>
        </View>
        <View style={styles.actionSpacer} />
        <IconAction
          active={post.is_saved}
          accessibilityLabel="Salva contenuto tribuna"
          icon={post.is_saved ? "bookmark" : "bookmark-outline"}
          onPress={onSave}
        />
      </View>

      <CommentPreview comments={post.comments} emptyLabel="Apri tu il confronto." />
      <CommentComposer
        draft={commentDraft}
        onChangeDraft={onChangeComment}
        onSend={onComment}
      />
    </View>
  );
}

function CommentPreview({
  comments,
  emptyLabel,
}: {
  comments: FanMediaPost["comments"] | FanTribunaComment[];
  emptyLabel: string;
}) {
  return (
    <View style={styles.commentsBlock}>
      {comments.length > 0 ? (
        comments.slice(0, 2).map((comment) => (
          <View key={comment.id} style={styles.commentRow}>
            <Avatar
              name={comment.author_name}
              size="sm"
              uri={comment.author_avatar_url}
            />
            <View style={styles.commentText}>
              <AppText style={styles.commentAuthor} variant="bodySm">
                {comment.author_name}
              </AppText>
              <AppText color="secondary" variant="bodySm">
                {comment.body}
              </AppText>
            </View>
          </View>
        ))
      ) : (
        <AppText color="secondary" variant="bodySm">
          {emptyLabel}
        </AppText>
      )}
    </View>
  );
}

function CommentComposer({
  draft,
  onChangeDraft,
  onSend,
}: {
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.commentComposer}>
      <View style={styles.commentInputWrap}>
        <Input
          label="Commento"
          onChangeText={onChangeDraft}
          placeholder="Scrivi un commento"
          value={draft}
        />
      </View>
      <Button disabled={!draft.trim()} label="Invia" onPress={onSend} size="sm" />
    </View>
  );
}

function TaggedPlayersRow({
  onOpenPlayer,
  players,
}: {
  onOpenPlayer?: (profileId: string) => void;
  players: FanTribunaTaggedPlayer[];
}) {
  return (
    <View style={styles.taggedPlayersRow}>
      {players.map((player) => (
        <Pressable
          accessibilityLabel={`Apri profilo ${player.display_name}`}
          accessibilityRole="button"
          disabled={!onOpenPlayer}
          key={player.player_profile_id}
          onPress={() => onOpenPlayer?.(player.player_profile_id)}
          style={({ pressed }) => [
            styles.taggedPlayerChip,
            pressed ? styles.pressed : null,
          ]}
        >
          <Avatar name={player.display_name} size="sm" uri={player.avatar_url} />
          <AppText numberOfLines={1} style={styles.taggedPlayerText} variant="caption">
            {player.display_name}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

function FootballPitchPreview({
  formation,
  players,
}: {
  formation: FanTribunaFormation;
  players: FanTribunaLineupPlayer[];
}) {
  const slots = getFormationSlots(formation);
  const playerBySlot = new Map(players.map((player) => [player.slot_key, player]));

  return (
    <View style={styles.pitch} testID="fan-formation-pitch">
      <View style={styles.pitchHalfLine} />
      <View style={styles.pitchCenterCircle} />
      <View style={styles.pitchBoxTop} />
      <View style={styles.pitchBoxBottom} />
      {slots.map((slot) => {
        const player = playerBySlot.get(slot.key);

        return (
          <View
            key={slot.key}
            style={[
              styles.pitchMarkerWrap,
              {
                left: `${slot.x}%`,
                top: `${slot.y}%`,
              },
            ]}
            testID={`fan-formation-slot-${slot.key}`}
          >
            {player ? (
              <View style={styles.pitchMarker}>
                <Avatar name={player.display_name} size="sm" uri={player.avatar_url} />
                <AppText
                  align="center"
                  color="inverse"
                  numberOfLines={1}
                  style={styles.pitchMarkerName}
                  variant="caption"
                >
                  {player.display_name}
                </AppText>
              </View>
            ) : (
              <View style={styles.pitchPlaceholder}>
                <AppText color="inverse" style={styles.pitchPlaceholderText} variant="caption">
                  {slot.shortLabel}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function FanCreateMenuModal({
  activeTab,
  onClose,
  onSelect,
  visible,
}: {
  activeTab: FanProfileTab;
  onClose: () => void;
  onSelect: (kind: CreateContentKind) => void;
  visible: boolean;
}) {
  const options =
    activeTab === "bacheca"
      ? [{ icon: "image-outline" as const, kind: "post" as const, label: "Post" }]
      : [
          { icon: "stats-chart-outline" as const, kind: "poll" as const, label: "Sondaggio" },
          { icon: "bulb-outline" as const, kind: "proposal" as const, label: "Proposta" },
          { icon: "football-outline" as const, kind: "formation" as const, label: "Formazione" },
        ];

  return (
    <Modal animationType="fade" transparent onRequestClose={onClose} visible={visible}>
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable style={styles.createMenuSheet} testID="fan-create-menu">
          <View style={styles.createMenuHandle} />
          <AppText style={styles.createMenuTitle} variant="titleSm">
            + Crea
          </AppText>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.kind}
              onPress={() => onSelect(option.kind)}
              style={({ pressed }) => [
                styles.createMenuOption,
                pressed ? styles.pressed : null,
              ]}
              testID={`fan-create-option-${option.kind}`}
            >
              <View style={styles.createMenuIcon}>
                <Ionicons color={colors.accent} name={option.icon} size={20} />
              </View>
              <AppText style={styles.createMenuOptionText} variant="bodySm">
                {option.label}
              </AppText>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FanCreateTribunaModal({
  kind,
  onClose,
  onCreated,
  profileId,
  visible,
}: {
  kind: FanTribunaKind | null;
  onClose: () => void;
  onCreated: (post: FanTribunaPost) => void;
  profileId: string;
  visible: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [proposalDraft, setProposalDraft] = useState<DraftProposalState>(
    emptyProposalDraft,
  );
  const [formationDraft, setFormationDraft] = useState<DraftFormationState>(
    emptyFormationDraft,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setOptions(["", ""]);
      setProposalDraft(emptyProposalDraft);
      setFormationDraft(emptyFormationDraft);
      setIsSaving(false);
    }
  }, [visible]);

  async function handleSave() {
    if (!kind) {
      return;
    }

    setIsSaving(true);

    try {
      const post =
        kind === "poll"
          ? await createFanTribunaPoll({
              options,
              profileId,
              question,
            })
          : kind === "proposal"
            ? await createFanTribunaProposal({
                body: proposalDraft.body,
                profileId,
                referenceCategory: proposalDraft.referenceCategory,
                referenceClubId: proposalDraft.referenceClubId,
                referenceTeamName: proposalDraft.referenceTeamName,
                taggedPlayers: proposalDraft.taggedPlayers,
                title: proposalDraft.title,
              })
            : await createFanTribunaFormation({
                body: formationDraft.body,
                formation: formationDraft.formation,
                lineupPlayers: formationDraft.lineupPlayers,
                profileId,
                referenceCategory: formationDraft.referenceCategory,
                referenceClubId: formationDraft.referenceClubId,
                referenceTeamName: formationDraft.referenceTeamName,
                title: formationDraft.title,
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

  const title = kind ? `Nuov${kind === "proposal" ? "a" : "o"} ${getTribunaLabel(kind)}` : "";
  const canPublish =
    kind === "poll"
      ? question.trim().length > 0 && options.filter((option) => option.trim()).length >= 2
      : kind === "proposal"
        ? proposalDraft.title.trim().length > 0 && proposalDraft.body.trim().length > 0
        : kind === "formation"
          ? formationDraft.referenceTeamName.trim().length > 0
          : false;

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.createRoot} testID={`fan-create-${kind ?? "tribuna"}-modal`}>
        <View style={styles.createTopBar}>
          <Pressable
            accessibilityLabel="Annulla creazione tribuna"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.createTextButton}
          >
            <AppText variant="bodySm">Annulla</AppText>
          </Pressable>
          <AppText style={styles.createTitle} variant="titleSm">
            {title}
          </AppText>
          <Pressable
            accessibilityLabel="Pubblica contenuto tribuna"
            accessibilityRole="button"
            disabled={!canPublish || isSaving}
            onPress={() => {
              void handleSave();
            }}
            style={[styles.createTextButton, !canPublish ? styles.disabledAction : null]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <AppText color="accent" style={styles.publishText} variant="bodySm">
                Pubblica
              </AppText>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.createForm}>
          {kind === "poll" ? (
            <>
              <Input
                label="Domanda"
                onChangeText={setQuestion}
                placeholder="Confermeresti l'allenatore?"
                value={question}
              />
              {options.map((option, index) => (
                <Input
                  key={`poll-option-${index}`}
                  label={`Opzione ${index + 1}`}
                  onChangeText={(value) =>
                    setOptions((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? value : entry,
                      ),
                    )
                  }
                  placeholder={index === 0 ? "Si" : index === 1 ? "No" : "Altra opzione"}
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
          ) : kind === "proposal" ? (
            <>
              <Input
                label="Titolo proposta"
                onChangeText={(value) =>
                  setProposalDraft((current) => ({ ...current, title: value }))
                }
                placeholder="Serve un attaccante fisico per l'Under 19"
                value={proposalDraft.title}
              />
              <TeamAutocompleteInput
                label="Squadra o categoria"
                onChangeText={(value) =>
                  setProposalDraft((current) => ({
                    ...current,
                    referenceClubId: null,
                    referenceTeamName: value,
                  }))
                }
                onSelectTeam={(team) =>
                  setProposalDraft((current) => ({
                    ...current,
                    referenceClubId: team.id ?? null,
                    referenceTeamName: team.name,
                  }))
                }
                placeholder="Cerca squadra o scrivi categoria"
                searchTeams={searchTeams}
                value={proposalDraft.referenceTeamName}
              />
              <Input
                label="Categoria"
                onChangeText={(value) =>
                  setProposalDraft((current) => ({
                    ...current,
                    referenceCategory: value,
                  }))
                }
                placeholder="Under 19, Prima squadra..."
                value={proposalDraft.referenceCategory}
              />
              <Input
                helperText={`${proposalDraft.body.length}/${TRIBUNA_TEXT_LIMIT}`}
                label="Motivazione"
                maxLength={TRIBUNA_TEXT_LIMIT}
                multiline
                onChangeText={(value) =>
                  setProposalDraft((current) => ({ ...current, body: value }))
                }
                placeholder="Spiega in breve perche' questa idea puo' aiutare la squadra."
                value={proposalDraft.body}
              />
              <TaggedPlayerPicker
                onChange={(players) =>
                  setProposalDraft((current) => ({ ...current, taggedPlayers: players }))
                }
                value={proposalDraft.taggedPlayers}
              />
            </>
          ) : kind === "formation" ? (
            <>
              <TeamAutocompleteInput
                label="Squadra"
                onChangeText={(value) =>
                  setFormationDraft((current) => ({
                    ...current,
                    referenceClubId: null,
                    referenceTeamName: value,
                  }))
                }
                onSelectTeam={(team) =>
                  setFormationDraft((current) => ({
                    ...current,
                    referenceClubId: team.id ?? null,
                    referenceTeamName: team.name,
                  }))
                }
                placeholder="Cerca squadra"
                searchTeams={searchTeams}
                value={formationDraft.referenceTeamName}
              />
              <View style={styles.tagSection}>
                <AppText style={styles.tagSectionTitle} variant="bodySm">
                  Modulo
                </AppText>
                <View style={styles.tagList}>
                  {FAN_TRIBUNA_FORMATIONS.map((formation) => {
                    const isSelected = formationDraft.formation === formation;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={formation}
                        onPress={() =>
                          setFormationDraft((current) => ({
                            ...current,
                            formation,
                            lineupPlayers: [],
                            selectedSlotKey: null,
                          }))
                        }
                        style={[
                          styles.tagChip,
                          isSelected ? styles.tagChipActive : null,
                        ]}
                      >
                        <AppText
                          color={isSelected ? "inverse" : "accentStrong"}
                          style={styles.tagChipText}
                          variant="bodySm"
                        >
                          {formation}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <LineupBuilder draft={formationDraft} onChange={setFormationDraft} />
              <Input
                helperText={`${formationDraft.body.length}/${TRIBUNA_TEXT_LIMIT}`}
                label="Nota"
                maxLength={TRIBUNA_TEXT_LIMIT}
                multiline
                onChangeText={(value) =>
                  setFormationDraft((current) => ({ ...current, body: value }))
                }
                placeholder="Perche' sceglieresti questo undici?"
                value={formationDraft.body}
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TaggedPlayerPicker({
  onChange,
  value,
}: {
  onChange: (players: FanTribunaTaggedPlayer[]) => void;
  value: FanTribunaTaggedPlayer[];
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AgentPlayerCandidate[]>([]);

  useEffect(() => {
    let isMounted = true;
    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (query.trim().length < 2) {
          setSuggestions([]);
          return;
        }

        try {
          const results = await searchAgentPlayerCandidates(query.trim());
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
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const selectedIds = useMemo(
    () => new Set(value.map((player) => player.player_profile_id)),
    [value],
  );

  function handleSelect(candidate: AgentPlayerCandidate) {
    if (selectedIds.has(candidate.profile_id)) {
      return;
    }

    onChange([
      ...value,
      {
        avatar_url: candidate.avatar_url,
        display_name: candidate.full_name,
        player_profile_id: candidate.profile_id,
        sort_order: value.length,
      },
    ]);
    setQuery("");
    setSuggestions([]);
  }

  return (
    <View style={styles.playerPicker}>
      <Input
        label="Giocatori taggati"
        onChangeText={setQuery}
        placeholder="Cerca giocatore da taggare"
        value={query}
      />
      {value.length > 0 ? (
        <TaggedPlayersRow
          players={value}
          onOpenPlayer={(profileId) =>
            onChange(value.filter((player) => player.player_profile_id !== profileId))
          }
        />
      ) : null}
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((candidate) => (
            <Pressable
              accessibilityRole="button"
              disabled={selectedIds.has(candidate.profile_id)}
              key={candidate.profile_id}
              onPress={() => handleSelect(candidate)}
              style={styles.suggestionRow}
            >
              <Avatar name={candidate.full_name} size="sm" uri={candidate.avatar_url} />
              <View style={styles.suggestionText}>
                <AppText numberOfLines={1} style={styles.suggestionName} variant="bodySm">
                  {candidate.full_name}
                </AppText>
                <AppText color="secondary" numberOfLines={1} variant="caption">
                  {formatCandidateLine(candidate)}
                </AppText>
              </View>
              {selectedIds.has(candidate.profile_id) ? (
                <Ionicons color={colors.success} name="checkmark" size={18} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LineupBuilder({
  draft,
  onChange,
}: {
  draft: DraftFormationState;
  onChange: (draft: DraftFormationState) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AgentPlayerCandidate[]>([]);
  const slots = getFormationSlots(draft.formation);
  const playerBySlot = new Map(
    draft.lineupPlayers.map((player) => [player.slot_key, player]),
  );
  const selectedSlot =
    slots.find((slot) => slot.key === draft.selectedSlotKey) ?? slots[0] ?? null;

  useEffect(() => {
    let isMounted = true;
    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (query.trim().length < 2 || !selectedSlot) {
          setSuggestions([]);
          return;
        }

        try {
          const results = await searchAgentPlayerCandidates(query.trim());
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
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [query, selectedSlot]);

  function handleSelectSlot(slotKey: string) {
    onChange({ ...draft, selectedSlotKey: slotKey });
  }

  function handleSelectPlayer(candidate: AgentPlayerCandidate) {
    if (!selectedSlot) {
      return;
    }

    const nextPlayer: FanTribunaLineupPlayer = {
      avatar_url: candidate.avatar_url,
      display_name: candidate.full_name,
      player_profile_id: candidate.profile_id,
      slot_key: selectedSlot.key,
      sort_order: selectedSlot.order,
      x_percent: selectedSlot.x,
      y_percent: selectedSlot.y,
    };

    onChange({
      ...draft,
      lineupPlayers: [
        ...draft.lineupPlayers.filter((player) => player.slot_key !== selectedSlot.key),
        nextPlayer,
      ],
      selectedSlotKey: selectedSlot.key,
    });
    setQuery("");
    setSuggestions([]);
  }

  return (
    <View style={styles.lineupBuilder}>
      <FootballPitchPreview formation={draft.formation} players={draft.lineupPlayers} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.slotPills}>
          {slots.map((slot) => {
            const player = playerBySlot.get(slot.key);
            const isSelected = selectedSlot?.key === slot.key;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={slot.key}
                onPress={() => handleSelectSlot(slot.key)}
                style={[
                  styles.slotPill,
                  isSelected ? styles.slotPillSelected : null,
                ]}
                testID={`fan-lineup-slot-${slot.key}`}
              >
                <AppText
                  color={isSelected ? "inverse" : "accentStrong"}
                  numberOfLines={1}
                  variant="caption"
                >
                  {player?.display_name ?? slot.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Input
        label={selectedSlot ? `Giocatore per ${selectedSlot.label}` : "Giocatore"}
        onChangeText={setQuery}
        placeholder="Cerca giocatore"
        value={query}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((candidate) => (
            <Pressable
              accessibilityRole="button"
              key={candidate.profile_id}
              onPress={() => handleSelectPlayer(candidate)}
              style={styles.suggestionRow}
            >
              <Avatar name={candidate.full_name} size="sm" uri={candidate.avatar_url} />
              <View style={styles.suggestionText}>
                <AppText numberOfLines={1} style={styles.suggestionName} variant="bodySm">
                  {candidate.full_name}
                </AppText>
                <AppText color="secondary" numberOfLines={1} variant="caption">
                  {formatCandidateLine(candidate)}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function InfoLine({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress?: () => void;
  value: string;
}) {
  const content = (
    <>
      <AppText style={styles.infoLabel} variant="bodySm">
        {label}
      </AppText>
      <AppText color="secondary" style={styles.infoText} variant="bodySm">
        {value}
      </AppText>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={`Apri ${value}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.infoLine,
          styles.infoLinePressable,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.infoLine}>{content}</View>;
}

function IconAction({
  accessibilityLabel,
  active = false,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  active?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, pressed ? styles.pressed : null]}
    >
      <Ionicons color={active ? colors.accent : colors.textPrimary} name={icon} size={24} />
    </Pressable>
  );
}

type FormationSlot = {
  key: string;
  label: string;
  order: number;
  shortLabel: string;
  x: number;
  y: number;
};

const FORMATION_SLOTS: Record<FanTribunaFormation, FormationSlot[]> = {
  "3-5-2": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "center_back_left", label: "Braccetto sinistro", order: 1, shortLabel: "DC", x: 28, y: 70 },
    { key: "center_back", label: "Difensore centrale", order: 2, shortLabel: "DC", x: 50, y: 72 },
    { key: "center_back_right", label: "Braccetto destro", order: 3, shortLabel: "DC", x: 72, y: 70 },
    { key: "left_wingback", label: "Esterno sinistro", order: 4, shortLabel: "ES", x: 15, y: 48 },
    { key: "midfield_left", label: "Mezzala sinistra", order: 5, shortLabel: "CC", x: 36, y: 50 },
    { key: "midfield_center", label: "Regista", order: 6, shortLabel: "CC", x: 50, y: 56 },
    { key: "midfield_right", label: "Mezzala destra", order: 7, shortLabel: "CC", x: 64, y: 50 },
    { key: "right_wingback", label: "Esterno destro", order: 8, shortLabel: "ED", x: 85, y: 48 },
    { key: "striker_left", label: "Punta sinistra", order: 9, shortLabel: "ATT", x: 40, y: 22 },
    { key: "striker_right", label: "Punta destra", order: 10, shortLabel: "ATT", x: 60, y: 22 },
  ],
  "4-2-3-1": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "left_back", label: "Terzino sinistro", order: 1, shortLabel: "TS", x: 18, y: 68 },
    { key: "center_back_left", label: "Centrale sinistro", order: 2, shortLabel: "DC", x: 40, y: 72 },
    { key: "center_back_right", label: "Centrale destro", order: 3, shortLabel: "DC", x: 60, y: 72 },
    { key: "right_back", label: "Terzino destro", order: 4, shortLabel: "TD", x: 82, y: 68 },
    { key: "pivot_left", label: "Mediano sinistro", order: 5, shortLabel: "MED", x: 40, y: 54 },
    { key: "pivot_right", label: "Mediano destro", order: 6, shortLabel: "MED", x: 60, y: 54 },
    { key: "left_winger", label: "Esterno sinistro", order: 7, shortLabel: "AS", x: 22, y: 34 },
    { key: "attacking_midfielder", label: "Trequartista", order: 8, shortLabel: "TRQ", x: 50, y: 36 },
    { key: "right_winger", label: "Esterno destro", order: 9, shortLabel: "AD", x: 78, y: 34 },
    { key: "striker", label: "Attaccante", order: 10, shortLabel: "ATT", x: 50, y: 18 },
  ],
  "4-3-3": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "left_back", label: "Terzino sinistro", order: 1, shortLabel: "TS", x: 18, y: 68 },
    { key: "center_back_left", label: "Centrale sinistro", order: 2, shortLabel: "DC", x: 40, y: 72 },
    { key: "center_back_right", label: "Centrale destro", order: 3, shortLabel: "DC", x: 60, y: 72 },
    { key: "right_back", label: "Terzino destro", order: 4, shortLabel: "TD", x: 82, y: 68 },
    { key: "midfield_left", label: "Mezzala sinistra", order: 5, shortLabel: "CC", x: 34, y: 50 },
    { key: "midfield_center", label: "Regista", order: 6, shortLabel: "CC", x: 50, y: 56 },
    { key: "midfield_right", label: "Mezzala destra", order: 7, shortLabel: "CC", x: 66, y: 50 },
    { key: "left_winger", label: "Ala sinistra", order: 8, shortLabel: "AS", x: 24, y: 24 },
    { key: "striker", label: "Attaccante", order: 9, shortLabel: "ATT", x: 50, y: 18 },
    { key: "right_winger", label: "Ala destra", order: 10, shortLabel: "AD", x: 76, y: 24 },
  ],
  "4-4-2": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "left_back", label: "Terzino sinistro", order: 1, shortLabel: "TS", x: 18, y: 68 },
    { key: "center_back_left", label: "Centrale sinistro", order: 2, shortLabel: "DC", x: 40, y: 72 },
    { key: "center_back_right", label: "Centrale destro", order: 3, shortLabel: "DC", x: 60, y: 72 },
    { key: "right_back", label: "Terzino destro", order: 4, shortLabel: "TD", x: 82, y: 68 },
    { key: "left_midfielder", label: "Esterno sinistro", order: 5, shortLabel: "ES", x: 20, y: 46 },
    { key: "midfield_left", label: "Centrale sinistro", order: 6, shortLabel: "CC", x: 42, y: 50 },
    { key: "midfield_right", label: "Centrale destro", order: 7, shortLabel: "CC", x: 58, y: 50 },
    { key: "right_midfielder", label: "Esterno destro", order: 8, shortLabel: "ED", x: 80, y: 46 },
    { key: "striker_left", label: "Punta sinistra", order: 9, shortLabel: "ATT", x: 40, y: 22 },
    { key: "striker_right", label: "Punta destra", order: 10, shortLabel: "ATT", x: 60, y: 22 },
  ],
};

function getFormationSlots(formation: FanTribunaFormation) {
  return FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"];
}

function getTribunaLabel(kind: FanTribunaKind) {
  switch (kind) {
    case "formation":
      return "Formazione";
    case "proposal":
      return "Proposta";
    case "poll":
    default:
      return "Sondaggio";
  }
}

function getTribunaIcon(kind: FanTribunaKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "formation":
      return "football-outline";
    case "proposal":
      return "bulb-outline";
    case "poll":
    default:
      return "stats-chart-outline";
  }
}

function getFormatBadgeStyle(kind: FanTribunaKind): ViewStyle {
  switch (kind) {
    case "formation":
      return styles.formatBadge_formation;
    case "proposal":
      return styles.formatBadge_proposal;
    case "poll":
    default:
      return styles.formatBadge_poll;
  }
}

function formatCandidateLine(candidate: AgentPlayerCandidate) {
  return [
    candidate.category_label,
    candidate.region,
    candidate.is_free_agent ? "Svincolato" : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function PostThumbnail({
  authorAvatarUrl,
  post,
  style,
}: {
  authorAvatarUrl: string;
  post: FanMediaPost;
  style: StyleProp<ImageStyle | ViewStyle>;
}) {
  const thumbnailUrl =
    post.thumbnail_url ?? (post.visual_type === "image" ? post.visual_url : null);

  if (thumbnailUrl) {
    return <Image source={{ uri: thumbnailUrl }} style={style as StyleProp<ImageStyle>} />;
  }

  if (post.visual_type === "video") {
    return (
      <Video
        isMuted
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        source={{ uri: post.visual_url }}
        style={style as StyleProp<ViewStyle>}
        useNativeControls={false}
      />
    );
  }

  return (
    <View style={[style as StyleProp<ViewStyle>, styles.videoFallback]}>
      <Avatar name="Video" size="lg" uri={authorAvatarUrl} />
      <Ionicons color={colors.accent} name="play-circle" size={28} />
    </View>
  );
}

function FanCreatePostModal({
  onClose,
  onCreated,
  profileId,
  userId,
  visible,
}: {
  onClose: () => void;
  onCreated: (post: FanMediaPost) => void;
  profileId: string;
  userId: string;
  visible: boolean;
}) {
  const [draft, setDraft] = useState<DraftPostState>(emptyDraft);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(emptyDraft);
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [visible]);

  function patchDraft<Key extends keyof DraftPostState>(
    key: Key,
    value: DraftPostState[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handlePickMedia() {
    setIsUploading(true);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "fan-media",
        mediaTypes: ["images", "videos"],
        userId,
      });
      const upload = uploads[0];

      if (!upload) {
        return;
      }

      const visualType = upload.type === "video" ? "video" : "image";
      setDraft((current) => ({
        ...current,
        thumbnailUrl: visualType === "image" ? upload.url : null,
        visualType,
        visualUrl: upload.url,
      }));
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento media non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const post = await createFanMediaPost({
        description: draft.description,
        profileId,
        tag: draft.tag,
        thumbnailUrl: draft.thumbnailUrl,
        visualType: draft.visualType ?? "image",
        visualUrl: draft.visualUrl,
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

  const canPublish = Boolean(draft.visualUrl && draft.description.trim());

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.createRoot} testID="fan-create-post-modal">
        <View style={styles.createTopBar}>
          <Pressable
            accessibilityLabel="Annulla pubblicazione"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.createTextButton}
          >
            <AppText variant="bodySm">Annulla</AppText>
          </Pressable>
          <AppText style={styles.createTitle} variant="titleSm">
            Nuovo post
          </AppText>
          <Pressable
            accessibilityLabel="Pubblica post"
            accessibilityRole="button"
            disabled={!canPublish || isSaving}
            onPress={() => {
              void handleSave();
            }}
            style={[styles.createTextButton, !canPublish ? styles.disabledAction : null]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <AppText color="accent" style={styles.publishText} variant="bodySm">
                Pubblica
              </AppText>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.createContent}>
          <Pressable
            accessibilityLabel="Scegli foto o video"
            accessibilityRole="button"
            disabled={isUploading}
            onPress={() => {
              void handlePickMedia();
            }}
            style={({ pressed }) => [
              styles.createMedia,
              pressed ? styles.pressed : null,
            ]}
          >
            {draft.visualUrl && draft.visualType === "image" ? (
              <Image source={{ uri: draft.visualUrl }} style={styles.createMediaImage} />
            ) : draft.visualUrl ? (
              <View style={styles.createVideoPreview}>
                <Video
                  isMuted
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  source={{ uri: draft.visualUrl }}
                  style={styles.createMediaImage}
                  useNativeControls={false}
                />
                <View style={styles.createVideoOverlay}>
                  <Ionicons color={colors.inkInvert} name="play" size={26} />
                </View>
              </View>
            ) : (
              <View style={styles.createPlaceholder}>
                {isUploading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <>
                    <Ionicons color={colors.accent} name="image-outline" size={32} />
                    <AppText color="accent" style={styles.createPlaceholderText} variant="bodySm">
                      Scegli foto o video
                    </AppText>
                  </>
                )}
              </View>
            )}
          </Pressable>

          <View style={styles.createForm}>
            <Input
              helperText={`${draft.description.length}/${POST_TEXT_LIMIT}`}
              label="Testo breve"
              maxLength={POST_TEXT_LIMIT}
              multiline
              onChangeText={(value) => patchDraft("description", value)}
              placeholder="Scrivi un pensiero sulla partita, un'opinione o una domanda..."
              value={draft.description}
            />

            <View style={styles.tagSection}>
              <AppText style={styles.tagSectionTitle} variant="bodySm">
                Aggiungi tag (opzionale)
              </AppText>
              <View style={styles.tagList}>
                {FAN_MEDIA_TAG_OPTIONS.map((option) => {
                  const isSelected = draft.tag === option.value;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={option.value}
                      onPress={() =>
                        patchDraft("tag", isSelected ? null : option.value)
                      }
                      style={[
                        styles.tagChip,
                        isSelected ? styles.tagChipActive : null,
                      ]}
                      testID={`fan-create-tag-${option.value}`}
                    >
                      <AppText
                        color={isSelected ? "inverse" : "accentStrong"}
                        style={styles.tagChipText}
                        variant="bodySm"
                      >
                        {option.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function FanFavoriteTeamModal({
  favoriteClubId,
  favoriteTeamName,
  onClose,
  onSaved,
  profileId,
  visible,
}: {
  favoriteClubId: string | null;
  favoriteTeamName: string;
  onClose: () => void;
  onSaved: (nextFavorite: {
    favoriteClubId: string | null;
    favoriteTeamName: string;
  }) => void;
  profileId: string;
  visible: boolean;
}) {
  const [draftTeamName, setDraftTeamName] = useState(favoriteTeamName);
  const [draftClubId, setDraftClubId] = useState<string | null>(favoriteClubId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftTeamName(favoriteTeamName);
      setDraftClubId(favoriteClubId);
      setIsSaving(false);
    }
  }, [favoriteClubId, favoriteTeamName, visible]);

  async function handleSave() {
    const trimmedTeamName = draftTeamName.trim();

    if (!trimmedTeamName) {
      Alert.alert("Squadra richiesta", "Inserisci la squadra per cui tifi.");
      return;
    }

    setIsSaving(true);

    try {
      await updateFanFavoriteTeam({
        favoriteClubId: draftClubId,
        favoriteTeamName: trimmedTeamName,
        profileId,
      });
      onSaved({
        favoriteClubId: draftClubId,
        favoriteTeamName: trimmedTeamName,
      });
    } catch {
      Alert.alert("Errore", "Non siamo riusciti a salvare la squadra tifata.");
    } finally {
      setIsSaving(false);
    }
  }

  const canSave = Boolean(draftTeamName.trim()) && !isSaving;

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.createRoot} testID="fan-favorite-team-modal">
        <View style={styles.createTopBar}>
          <Pressable
            accessibilityLabel="Annulla modifica squadra"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.createTextButton}
          >
            <AppText variant="bodySm">Annulla</AppText>
          </Pressable>
          <AppText style={styles.createTitle} variant="titleSm">
            Squadra tifata
          </AppText>
          <Pressable
            accessibilityLabel="Salva squadra tifata"
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => {
              void handleSave();
            }}
            style={[styles.createTextButton, !canSave ? styles.disabledAction : null]}
            testID="fan-save-favorite-team-button"
          >
            {isSaving ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <AppText color="accent" style={styles.publishText} variant="bodySm">
                Salva
              </AppText>
            )}
          </Pressable>
        </View>

        <View style={styles.favoriteTeamContent}>
          <TeamAutocompleteInput
            label="Squadra"
            onChangeText={(value) => {
              setDraftTeamName(value);
              setDraftClubId(null);
            }}
            onSelectTeam={(team) => {
              setDraftTeamName(team.name);
              setDraftClubId(team.id ?? null);
            }}
            placeholder="Es. AC Como"
            searchTeams={searchTeams}
            value={draftTeamName}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function formatFollowedCategories(categories: string[] | null | undefined) {
  const values = categories?.filter(Boolean) ?? [];
  return values.length > 0 ? values.join(" • ") : "Categorie da completare";
}

function formatAreaLabel(regions: string[] | null | undefined, fallbackRegion: string | null) {
  const values = regions?.filter(Boolean) ?? [];
  if (values.length > 0) {
    return values.join(" • ");
  }

  return fallbackRegion?.trim() || "Area da completare";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("it-IT").format(Math.max(0, value));
}

function formatPostDate(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

const styles = StyleSheet.create({
  actionSpacer: {
    flex: 1,
  },
  createMenuHandle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: radius.full,
    height: 4,
    marginBottom: spacing[14],
    width: 44,
  },
  createMenuIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  createMenuOption: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 58,
    paddingHorizontal: spacing[14],
  },
  createMenuOptionText: {
    fontWeight: typography.fontWeight.semibold,
  },
  createMenuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius[12],
    borderTopRightRadius: radius[12],
    gap: spacing[10],
    padding: spacing[16],
    paddingBottom: spacing[28],
  },
  createMenuTitle: {
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[4],
  },
  commentAuthor: {
    fontWeight: typography.fontWeight.bold,
  },
  commentComposer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[10],
    marginTop: spacing[14],
  },
  commentInputWrap: {
    flex: 1,
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  commentsBlock: {
    gap: spacing[10],
    marginTop: spacing[12],
  },
  commentText: {
    flex: 1,
  },
  createContent: {
    paddingBottom: spacing[32],
  },
  createForm: {
    gap: spacing[20],
    padding: spacing[16],
  },
  createMedia: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    width: "100%",
  },
  createMediaImage: {
    height: "100%",
    width: "100%",
  },
  createPlaceholder: {
    alignItems: "center",
    flex: 1,
    gap: spacing[8],
    justifyContent: "center",
  },
  createPlaceholderText: {
    fontWeight: typography.fontWeight.bold,
  },
  createRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  createTextButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: spacing[12],
  },
  createTitle: {
    flex: 1,
    textAlign: "center",
  },
  createTopBar: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: spacing[6],
  },
  createVideoPreview: {
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    position: "relative",
  },
  createVideoOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(11,43,64,0.48)",
    borderRadius: radius.full,
    height: 58,
    justifyContent: "center",
    left: "50%",
    marginLeft: -29,
    marginTop: -29,
    position: "absolute",
    top: "50%",
    width: 58,
  },
  disabledAction: {
    opacity: 0.4,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[36],
  },
  emptyText: {
    maxWidth: 280,
  },
  emptyTitle: {
    marginTop: spacing[6],
  },
  editFavoriteTeamButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: 28,
    paddingHorizontal: spacing[6],
  },
  editFavoriteTeamText: {
    fontWeight: typography.fontWeight.semibold,
  },
  favoriteTeamContent: {
    padding: spacing[16],
  },
  feedActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  feedAuthor: {
    fontWeight: typography.fontWeight.bold,
  },
  feedAuthorInline: {
    fontWeight: typography.fontWeight.bold,
  },
  feedCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  feedDescription: {
    lineHeight: 21,
  },
  feedHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  feedHeaderText: {
    flex: 1,
  },
  feedList: {
    gap: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  feedLikes: {
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[8],
  },
  feedMedia: {
    height: "100%",
    width: "100%",
  },
  feedMediaFrame: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.surfaceMuted,
    position: "relative",
    width: "100%",
  },
  feedPlayButton: {
    alignItems: "center",
    backgroundColor: "rgba(11,43,64,0.46)",
    borderRadius: radius.full,
    height: 64,
    justifyContent: "center",
    left: "50%",
    marginLeft: -32,
    marginTop: -32,
    position: "absolute",
    top: "50%",
    width: 64,
  },
  feedTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[6],
    marginBottom: spacing[8],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  feedTagText: {
    fontWeight: typography.fontWeight.bold,
  },
  feedTagCompact: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    maxWidth: 96,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  feedText: {
    paddingBottom: spacing[28],
    paddingHorizontal: spacing[16],
  },
  formatBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 30,
    paddingHorizontal: spacing[10],
  },
  formatBadge_formation: {
    backgroundColor: "#198754",
  },
  formatBadge_poll: {
    backgroundColor: colors.accent,
  },
  formatBadge_proposal: {
    backgroundColor: "#8A4B00",
  },
  formatBadgeText: {
    fontWeight: typography.fontWeight.bold,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -1,
  },
  gridCell: {
    padding: 1,
    width: "33.3333%",
  },
  gridImage: {
    height: "100%",
    width: "100%",
  },
  gridItem: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    position: "relative",
  },
  gridTag: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius[4],
    left: spacing[6],
    maxWidth: "82%",
    paddingHorizontal: spacing[6],
    paddingVertical: 3,
    position: "absolute",
    top: spacing[6],
  },
  gridTagText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 14,
  },
  gridVideoBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11,43,64,0.74)",
    borderRadius: radius.full,
    bottom: spacing[6],
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    width: 24,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[24],
    paddingTop: spacing[18],
  },
  iconAction: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  identity: {
    gap: spacing[4],
    marginTop: spacing[14],
  },
  infoLabel: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  infoLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    justifyContent: "center",
  },
  infoLinePressable: {
    minHeight: 32,
    paddingHorizontal: spacing[6],
  },
  infoStack: {
    alignItems: "center",
    gap: spacing[6],
    marginBottom: spacing[20],
    marginTop: spacing[16],
  },
  infoText: {
    textAlign: "center",
  },
  interestBlock: {
    alignItems: "center",
    gap: spacing[8],
  },
  interestChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 132,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  interestChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    justifyContent: "center",
  },
  lineupBuilder: {
    gap: spacing[12],
  },
  menuBackdrop: {
    backgroundColor: "rgba(11,43,64,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  name: {
    letterSpacing: 0,
  },
  pitch: {
    aspectRatio: 0.72,
    backgroundColor: "#238A55",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: radius[8],
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  pitchBoxBottom: {
    alignSelf: "center",
    borderColor: "rgba(255,255,255,0.32)",
    borderTopWidth: 1,
    bottom: 0,
    height: "17%",
    position: "absolute",
    width: "52%",
  },
  pitchBoxTop: {
    alignSelf: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    height: "17%",
    position: "absolute",
    top: 0,
    width: "52%",
  },
  pitchCenterCircle: {
    alignSelf: "center",
    borderColor: "rgba(255,255,255,0.32)",
    borderRadius: 42,
    borderWidth: 1,
    height: 84,
    marginTop: -42,
    position: "absolute",
    top: "50%",
    width: 84,
  },
  pitchHalfLine: {
    backgroundColor: "rgba(255,255,255,0.32)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: "50%",
  },
  pitchMarker: {
    alignItems: "center",
    gap: spacing[4],
    width: 70,
  },
  pitchMarkerName: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 12,
    textShadowColor: "rgba(0,0,0,0.42)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 2,
  },
  pitchMarkerWrap: {
    alignItems: "center",
    marginLeft: -35,
    marginTop: -22,
    position: "absolute",
    width: 70,
  },
  pitchPlaceholder: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: radius.full,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  pitchPlaceholderText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 11,
  },
  playerPicker: {
    gap: spacing[12],
  },
  pollFill: {
    backgroundColor: "rgba(10,102,194,0.12)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  pollLabel: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
  },
  pollOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 48,
    overflow: "hidden",
    paddingHorizontal: spacing[12],
    position: "relative",
  },
  pollOptionSelected: {
    borderColor: colors.accent,
  },
  pollOptions: {
    gap: spacing[8],
    marginTop: spacing[12],
  },
  pollPercent: {
    fontWeight: typography.fontWeight.bold,
  },
  pressed: {
    opacity: 0.82,
  },
  publishActionWrap: {
    backgroundColor: colors.background,
    padding: spacing[16],
  },
  publishText: {
    fontWeight: typography.fontWeight.bold,
  },
  roleLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  referenceChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[4],
    maxWidth: "100%",
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  referenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    marginTop: spacing[8],
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[18],
  },
  sectionTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  stateBlock: {
    alignItems: "center",
    gap: spacing[10],
    justifyContent: "center",
    minHeight: 180,
  },
  slotPill: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 92,
    paddingHorizontal: spacing[12],
  },
  slotPillSelected: {
    backgroundColor: colors.accent,
  },
  slotPills: {
    flexDirection: "row",
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  suggestionName: {
    fontWeight: typography.fontWeight.semibold,
  },
  suggestionRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 54,
    paddingHorizontal: spacing[10],
  },
  suggestionText: {
    flex: 1,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingHorizontal: spacing[12],
  },
  tabButton: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  tabButtonActive: {
    borderBottomColor: colors.accent,
  },
  tabButtonText: {
    fontWeight: typography.fontWeight.bold,
  },
  tagChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing[14],
  },
  tagChipActive: {
    backgroundColor: colors.textPrimary,
  },
  tagChipText: {
    fontWeight: typography.fontWeight.semibold,
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  tagSection: {
    gap: spacing[12],
  },
  tagSectionTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  taggedPlayerChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    maxWidth: 170,
    minHeight: 38,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  taggedPlayerText: {
    flexShrink: 1,
    fontWeight: typography.fontWeight.semibold,
  },
  taggedPlayersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginTop: spacing[12],
  },
  tribunaActionButton: {
    alignItems: "center",
    borderColor: colors.accent,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 36,
    paddingHorizontal: spacing[12],
  },
  tribunaActionButtonActive: {
    backgroundColor: colors.accent,
  },
  tribunaActionMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  tribunaActionText: {
    fontWeight: typography.fontWeight.bold,
  },
  tribunaActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[14],
  },
  tribunaBody: {
    lineHeight: 21,
    marginTop: spacing[10],
  },
  tribunaCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[14],
  },
  tribunaHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tribunaTitle: {
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing[12],
  },
  videoFallback: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    gap: spacing[8],
    justifyContent: "center",
  },
  viewerPage: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewerRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  viewerTitle: {
    flex: 1,
    textAlign: "center",
  },
  viewerTopBar: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: spacing[8],
  },
  viewerTopButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
