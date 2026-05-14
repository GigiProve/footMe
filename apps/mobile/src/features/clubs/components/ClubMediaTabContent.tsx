import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
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

import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { SelectField } from "../../../components/ui/select-field";
import { VideoPlayerModal } from "../../../components/ui/video-player-modal";
import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar, Button, Input } from "../../../ui";
import { searchAgentPlayerCandidates } from "../../profiles/profile-service";
import type { AgentPlayerCandidate } from "../../profiles/agent-profile";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  type UploadedMediaItem,
} from "../../profiles/media-upload-service";
import type { PublicClubProfile } from "../club-service";
import {
  addClubMediaComment,
  createClubMediaPost,
  fetchClubMediaFeed,
  fetchClubMediaPostDetail,
  toggleClubMediaLike,
  toggleSavedClubMedia,
  type ClubMediaKind,
  type ClubMediaPost,
  type ClubMediaTaggedProfile,
  type ClubMediaVisualType,
} from "../club-media-service";

type ClubMediaTabContentProps = {
  club: PublicClubProfile;
  isOwner: boolean;
  onOpenProfile: (profileId: string) => void;
  viewerProfileId?: string | null;
};

type MediaFilter = "all" | ClubMediaKind;

type DraftState = {
  attachmentLabel: string;
  body: string;
  eventDate: string;
  excerpt: string;
  externalUrl: string;
  intervieweeName: string;
  playerBirthYear: string;
  playerName: string;
  playerPreviousClub: string;
  playerRole: string;
  taggedProfiles: ClubMediaTaggedProfile[];
  title: string;
  videoDurationSeconds: string;
  visualType: ClubMediaVisualType | null;
  visualUrl: string;
};

const FILTERS: { label: string; value: MediaFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Highlights", value: "highlights" },
  { label: "Interviste", value: "interview" },
  { label: "Mercato", value: "market" },
  { label: "Comunicati", value: "statement" },
  { label: "Allenamenti", value: "training" },
  { label: "Eventi", value: "event" },
];

const CREATE_OPTIONS: {
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  kind: ClubMediaKind;
  title: string;
}[] = [
  {
    description: "Carica video partita o azioni",
    icon: "play-circle-outline",
    kind: "highlights",
    title: "Highlights",
  },
  {
    description: "Pubblica video o contenuto intervista",
    icon: "mic-outline",
    kind: "interview",
    title: "Intervista",
  },
  {
    description: "Annuncia un nuovo giocatore",
    icon: "person-add-outline",
    kind: "market",
    title: "Nuovo acquisto",
  },
  {
    description: "Pubblica una comunicazione ufficiale",
    icon: "document-text-outline",
    kind: "statement",
    title: "Comunicato",
  },
  {
    description: "Foto e video dalla seduta",
    icon: "images-outline",
    kind: "training",
    title: "Allenamento",
  },
  {
    description: "Racconta un evento della societa'",
    icon: "calendar-outline",
    kind: "event",
    title: "Evento",
  },
];

const KIND_META: Record<
  ClubMediaKind,
  {
    color: string;
    detailLabel: string;
    icon: ComponentProps<typeof Ionicons>["name"];
    label: string;
    softColor: string;
  }
> = {
  event: {
    color: "#DB2777",
    detailLabel: "Evento",
    icon: "calendar-outline",
    label: "Eventi",
    softColor: "#FCE7F3",
  },
  highlights: {
    color: colors.accent,
    detailLabel: "Highlights",
    icon: "videocam-outline",
    label: "Highlights",
    softColor: colors.accentSoft,
  },
  interview: {
    color: colors.accent,
    detailLabel: "Intervista",
    icon: "mic-outline",
    label: "Interviste",
    softColor: colors.accentSoft,
  },
  market: {
    color: colors.success,
    detailLabel: "Nuovo acquisto",
    icon: "person-add-outline",
    label: "Nuovo acquisto",
    softColor: colors.successSoft,
  },
  statement: {
    color: "#4F46E5",
    detailLabel: "Comunicato",
    icon: "document-text-outline",
    label: "Comunicati",
    softColor: "#EEF2FF",
  },
  training: {
    color: "#D97706",
    detailLabel: "Allenamento",
    icon: "images-outline",
    label: "Allenamenti",
    softColor: colors.warningSoft,
  },
};

const ROLE_OPTIONS = [
  { label: "Portiere", value: "Portiere" },
  { label: "Difensore", value: "Difensore" },
  { label: "Centrocampista", value: "Centrocampista" },
  { label: "Attaccante", value: "Attaccante" },
  { label: "Esterno", value: "Esterno" },
  { label: "Trequartista", value: "Trequartista" },
];

export function ClubMediaTabContent({
  club,
  isOwner,
  onOpenProfile,
  viewerProfileId,
}: ClubMediaTabContentProps) {
  const [activeFilter, setActiveFilter] = useState<MediaFilter>("all");
  const [posts, setPosts] = useState<ClubMediaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ClubMediaPost | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [createKind, setCreateKind] = useState<ClubMediaKind | null>(null);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await fetchClubMediaFeed(club.id, viewerProfileId);
      setPosts(result);
    } catch {
      Alert.alert("Errore", "Impossibile caricare i media della societa'.");
    } finally {
      setIsLoading(false);
    }
  }, [club.id, viewerProfileId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const filteredPosts = useMemo(
    () =>
      activeFilter === "all"
        ? posts
        : posts.filter((post) => post.kind === activeFilter),
    [activeFilter, posts],
  );

  async function handleOpenPost(post: ClubMediaPost) {
    setSelectedPost(post);
    setIsDetailLoading(true);

    try {
      const detail = await fetchClubMediaPostDetail(post.id, viewerProfileId);
      if (detail) {
        setSelectedPost(detail);
      }
    } catch {
      Alert.alert("Errore", "Impossibile aprire il contenuto.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function handleClosePost() {
    setSelectedPost(null);
    setIsVideoOpen(false);
  }

  function patchPost(postId: string, patch: Partial<ClubMediaPost>) {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
    setSelectedPost((current) =>
      current?.id === postId ? { ...current, ...patch } : current,
    );
  }

  async function handleToggleLike(post: ClubMediaPost) {
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
      await toggleClubMediaLike(viewerProfileId, post.id, nextLiked);
    } catch {
      patchPost(post.id, {
        is_liked: post.is_liked,
        like_count: post.like_count,
      });
      Alert.alert("Errore", "Impossibile aggiornare il Mi piace.");
    }
  }

  async function handleToggleSave(post: ClubMediaPost) {
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
      await toggleSavedClubMedia(viewerProfileId, post.id, nextSaved);
    } catch {
      patchPost(post.id, {
        is_saved: post.is_saved,
        saved_count: post.saved_count,
      });
      Alert.alert("Errore", "Impossibile aggiornare i salvati.");
    }
  }

  async function handleAddComment(body: string) {
    if (!selectedPost || !viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per commentare.");
      return;
    }

    try {
      const comment = await addClubMediaComment({
        body,
        postId: selectedPost.id,
        profileId: viewerProfileId,
      });
      const nextComments = [...selectedPost.comments, comment];
      patchPost(selectedPost.id, {
        comment_count: selectedPost.comment_count + 1,
        comments: nextComments,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossibile pubblicare il commento.";
      Alert.alert("Errore", message);
    }
  }

  async function handleShare(post: ClubMediaPost) {
    await Share.share({
      message: [post.title, post.excerpt ?? post.body ?? "", post.external_url ?? ""]
        .filter(Boolean)
        .join("\n"),
      title: post.title,
    });
  }

  function handleCreated(post: ClubMediaPost) {
    setPosts((current) => [post, ...current]);
    setCreateKind(null);
  }

  return (
    <View style={styles.root} testID="club-media-tab">
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText style={styles.title} variant="headingSm">
            Media
          </AppText>
          <AppText color="secondary" style={styles.subtitle} variant="bodySm">
            Highlights, interviste, comunicati e contenuti ufficiali della societa'.
          </AppText>
        </View>
        {isOwner ? (
          <Button
            label="+ Pubblica"
            onPress={() => setIsCreateMenuOpen(true)}
            size="sm"
            testID="club-media-publish-button"
            variant="primary"
          />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.filtersContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={filter.value}
              onPress={() => setActiveFilter(filter.value)}
              style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
              testID={`club-media-filter-${filter.value}`}
            >
              <AppText
                color={isActive ? "inverse" : "secondary"}
                style={styles.filterText}
                variant="bodySm"
              >
                {filter.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.accent} />
          <AppText color="secondary" variant="bodySm">
            Caricamento media...
          </AppText>
        </View>
      ) : filteredPosts.length > 0 ? (
        <View style={styles.feedList}>
          {filteredPosts.map((post) => (
            <MediaFeedRow
              key={post.id}
              onPress={() => {
                void handleOpenPost(post);
              }}
              post={post}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons color={colors.textMuted} name="images-outline" size={24} />
          <View style={styles.emptyText}>
            <AppText style={styles.emptyTitle} variant="titleSm">
              Nessun contenuto media
            </AppText>
            <AppText color="secondary" variant="bodySm">
              {isOwner
                ? "Pubblica il primo contenuto ufficiale della societa'."
                : "La societa' non ha ancora pubblicato contenuti."}
            </AppText>
          </View>
        </View>
      )}

      <CreateMenuSheet
        onClose={() => setIsCreateMenuOpen(false)}
        onSelect={(kind) => {
          setIsCreateMenuOpen(false);
          setCreateKind(kind);
        }}
        visible={isCreateMenuOpen}
      />

      <ClubMediaPostFormModal
        clubId={club.id}
        kind={createKind}
        onClose={() => setCreateKind(null)}
        onCreated={handleCreated}
        userId={viewerProfileId ?? null}
      />

      <ClubMediaDetailModal
        isLoading={isDetailLoading}
        isVideoOpen={isVideoOpen}
        onAddComment={(body) => {
          void handleAddComment(body);
        }}
        onClose={handleClosePost}
        onOpenProfile={onOpenProfile}
        onOpenVideo={() => setIsVideoOpen(true)}
        onShare={(post) => {
          void handleShare(post);
        }}
        onToggleLike={(post) => {
          void handleToggleLike(post);
        }}
        onToggleSave={(post) => {
          void handleToggleSave(post);
        }}
        onVideoClose={() => setIsVideoOpen(false)}
        post={selectedPost}
      />
    </View>
  );
}

function MediaFeedRow({
  onPress,
  post,
}: {
  onPress: () => void;
  post: ClubMediaPost;
}) {
  const meta = KIND_META[post.kind];
  const thumbnailUrl = post.thumbnail_url ?? (post.visual_type === "image" ? post.visual_url : null);

  return (
    <Pressable
      accessibilityLabel={`Apri contenuto ${meta.detailLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.mediaRow, pressed ? styles.pressedRow : null]}
      testID={`club-media-row-${post.id}`}
    >
      <View style={styles.mediaRowContent}>
        <AppText style={[styles.mediaLabel, { color: meta.color }]} variant="caption">
          {meta.label}
        </AppText>
        <AppText numberOfLines={2} style={styles.mediaTitle} variant="bodySm">
          {post.title}
        </AppText>
        <AppText color="secondary" numberOfLines={2} style={styles.mediaExcerpt} variant="bodySm">
          {buildFeedExcerpt(post)}
        </AppText>
        <View style={styles.mediaMetaRow}>
          <Ionicons color={colors.textSecondary} name={meta.icon} size={13} />
          <AppText color="secondary" style={styles.mediaMetaText} variant="caption">
            {buildMediaMeta(post)}
          </AppText>
        </View>
      </View>

      <View
        style={[styles.mediaThumb, { backgroundColor: meta.softColor }]}
        testID={`club-media-row-thumbnail-${post.id}`}
      >
        {thumbnailUrl ? (
          <Image
            accessibilityLabel={`Anteprima ${post.title}`}
            source={{ uri: thumbnailUrl }}
            style={styles.mediaThumbImage}
          />
        ) : (
          <Ionicons color={meta.color} name={meta.icon} size={28} />
        )}
        {post.visual_type === "video" ? (
          <View style={styles.playOverlay}>
            <Ionicons color={colors.inkInvert} name="play" size={14} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ClubMediaDetailModal({
  isLoading,
  isVideoOpen,
  onAddComment,
  onClose,
  onOpenProfile,
  onOpenVideo,
  onShare,
  onToggleLike,
  onToggleSave,
  onVideoClose,
  post,
}: {
  isLoading: boolean;
  isVideoOpen: boolean;
  onAddComment: (body: string) => void;
  onClose: () => void;
  onOpenProfile: (profileId: string) => void;
  onOpenVideo: () => void;
  onShare: (post: ClubMediaPost) => void;
  onToggleLike: (post: ClubMediaPost) => void;
  onToggleSave: (post: ClubMediaPost) => void;
  onVideoClose: () => void;
  post: ClubMediaPost | null;
}) {
  const [commentBody, setCommentBody] = useState("");

  useEffect(() => {
    if (!post) {
      setCommentBody("");
    }
  }, [post]);

  if (!post) {
    return null;
  }

  const meta = KIND_META[post.kind];
  const heroUrl = post.thumbnail_url ?? (post.visual_type === "image" ? post.visual_url : null);
  const isStatement = post.kind === "statement";

  function handleSubmitComment() {
    const trimmed = commentBody.trim();
    if (!trimmed) {
      return;
    }
    onAddComment(trimmed);
    setCommentBody("");
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={post !== null}>
      <SafeAreaView style={styles.detailRoot}>
        <View style={styles.detailTopBar}>
          <Pressable
            accessibilityLabel="Chiudi contenuto media"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.detailTopButton}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={23} />
          </Pressable>
          <AppText numberOfLines={1} style={styles.detailTopTitle} variant="bodySm">
            {meta.detailLabel}
          </AppText>
          <View style={styles.detailTopButton} />
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          {isStatement ? (
            <View style={styles.documentHero}>
              <View style={styles.documentIcon}>
                <Ionicons color={meta.color} name="document-text-outline" size={34} />
              </View>
            </View>
          ) : (
            <View style={styles.detailHero}>
              {heroUrl ? (
                <Image source={{ uri: heroUrl }} style={styles.detailHeroImage} />
              ) : (
                <View style={styles.detailHeroFallback}>
                  <Ionicons color={colors.inkInvert} name={meta.icon} size={44} />
                </View>
              )}
              {post.visual_type === "video" && post.visual_url ? (
                <Pressable
                  accessibilityLabel="Riproduci video"
                  accessibilityRole="button"
                  onPress={onOpenVideo}
                  style={styles.detailPlayButton}
                >
                  <Ionicons color={colors.inkInvert} name="play" size={28} />
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.detailBody} testID={`club-media-detail-${post.kind}`}>
            {isLoading ? (
              <ActivityIndicator color={colors.accent} style={styles.detailLoader} />
            ) : null}

            <AppText style={[styles.detailLabel, { color: meta.color }]} variant="caption">
              {meta.detailLabel}
            </AppText>
            <AppText style={styles.detailTitle} variant="headingSm">
              {post.title}
            </AppText>

            {post.kind === "interview" && post.interviewee_name ? (
              <View style={styles.subjectBox}>
                <View style={[styles.subjectIcon, { backgroundColor: meta.softColor }]}>
                  <Ionicons color={meta.color} name="mic-outline" size={18} />
                </View>
                <View>
                  <AppText color="secondary" style={styles.subjectKicker} variant="caption">
                    Intervistato
                  </AppText>
                  <AppText style={styles.subjectName} variant="bodySm">
                    {post.interviewee_name}
                  </AppText>
                </View>
              </View>
            ) : null}

            {post.kind === "market" ? <MarketSummary post={post} /> : null}

            {post.body || post.excerpt ? (
              <AppText
                style={isStatement ? styles.statementBody : styles.detailDescription}
                variant="bodySm"
              >
                {post.body ?? post.excerpt}
              </AppText>
            ) : null}

            <View style={styles.detailMetaRow}>
              <Ionicons color={colors.textSecondary} name={meta.icon} size={14} />
              <AppText color="secondary" variant="caption">
                {buildMediaMeta(post)}
              </AppText>
            </View>

            {post.tagged_profiles.length > 0 ? (
              <TaggedProfiles
                onOpenProfile={onOpenProfile}
                profiles={post.tagged_profiles}
                title={post.kind === "market" ? "Profilo giocatore taggato" : "Taggati"}
              />
            ) : null}

            {post.kind === "statement" && (post.attachment_label || post.external_url) ? (
              <Pressable
                accessibilityRole="button"
                disabled={!post.external_url}
                onPress={() => {
                  if (post.external_url) {
                    void Linking.openURL(normalizeExternalUrl(post.external_url));
                  }
                }}
                style={styles.attachmentCard}
              >
                <View style={styles.attachmentIcon}>
                  <Ionicons color={meta.color} name="document-attach-outline" size={20} />
                </View>
                <AppText numberOfLines={1} style={styles.attachmentName} variant="bodySm">
                  {post.attachment_label ?? post.external_url}
                </AppText>
                {post.external_url ? (
                  <Ionicons color={colors.accent} name="open-outline" size={19} />
                ) : null}
              </Pressable>
            ) : null}

            <View style={styles.actionsBar}>
              {post.kind !== "statement" ? (
                <DetailAction
                  active={post.is_liked}
                  icon={post.is_liked ? "heart" : "heart-outline"}
                  label={`Mi piace ${post.like_count > 0 ? post.like_count : ""}`.trim()}
                  onPress={() => onToggleLike(post)}
                />
              ) : null}
              <DetailAction
                icon="chatbubble-outline"
                label={`Commenta ${post.comment_count > 0 ? post.comment_count : ""}`.trim()}
                onPress={() => {}}
              />
              <DetailAction
                active={post.is_saved}
                icon={post.is_saved ? "bookmark" : "bookmark-outline"}
                label="Salva"
                onPress={() => onToggleSave(post)}
              />
              <DetailAction
                icon="share-social-outline"
                label="Condividi"
                onPress={() => onShare(post)}
              />
            </View>

            <View style={styles.commentsSection}>
              <AppText style={styles.commentsTitle} variant="titleSm">
                Commenti
              </AppText>
              {post.comments.length > 0 ? (
                <View style={styles.commentsList}>
                  {post.comments.map((comment) => (
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
                  ))}
                </View>
              ) : (
                <AppText color="secondary" variant="bodySm">
                  Nessun commento per ora.
                </AppText>
              )}

              <View style={styles.commentComposer}>
                <View style={styles.commentInputWrap}>
                  <Input
                    label="Aggiungi commento"
                    onChangeText={setCommentBody}
                    placeholder="Scrivi un commento"
                    value={commentBody}
                  />
                </View>
                <Button
                  disabled={!commentBody.trim()}
                  label="Invia"
                  onPress={handleSubmitComment}
                  size="sm"
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {post.visual_type === "video" && post.visual_url ? (
          <VideoPlayerModal
            onClose={onVideoClose}
            title={post.title}
            url={post.visual_url}
            visible={isVideoOpen}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function MarketSummary({ post }: { post: ClubMediaPost }) {
  const summary = [
    post.player_role,
    post.player_birth_year ? `classe ${post.player_birth_year}` : null,
    post.player_previous_club ? `provenienza ${post.player_previous_club}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={styles.marketSummary}>
      <AppText style={styles.marketPlayer} variant="titleSm">
        {post.player_name ?? "Nuovo giocatore"}
      </AppText>
      {summary ? (
        <AppText color="accent" style={styles.marketMeta} variant="bodySm">
          {summary}
        </AppText>
      ) : null}
    </View>
  );
}

function TaggedProfiles({
  onOpenProfile,
  profiles,
  title,
}: {
  onOpenProfile: (profileId: string) => void;
  profiles: ClubMediaTaggedProfile[];
  title: string;
}) {
  return (
    <View style={styles.taggedSection}>
      <AppText color="secondary" style={styles.taggedTitle} variant="caption">
        {title}
      </AppText>
      <View style={styles.taggedList}>
        {profiles.map((profile) => (
          <Pressable
            accessibilityLabel={`Apri profilo ${profile.display_name}`}
            accessibilityRole="button"
            key={profile.profile_id}
            onPress={() => onOpenProfile(profile.profile_id)}
            style={styles.taggedProfileCard}
          >
            <Avatar
              name={profile.display_name}
              size="md"
              uri={profile.avatar_url}
            />
            <View style={styles.taggedInfo}>
              <AppText numberOfLines={1} style={styles.taggedName} variant="bodySm">
                {profile.display_name}
              </AppText>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {formatRole(profile.role)}
              </AppText>
            </View>
            <AppText color="accent" style={styles.taggedCta} variant="caption">
              Apri
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DetailAction({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.detailAction}
    >
      <Ionicons color={active ? colors.accent : colors.textSecondary} name={icon} size={18} />
      <AppText color={active ? "accent" : "secondary"} style={styles.detailActionText} variant="bodySm">
        {label}
      </AppText>
    </Pressable>
  );
}

function CreateMenuSheet({
  onClose,
  onSelect,
  visible,
}: {
  onClose: () => void;
  onSelect: (kind: ClubMediaKind) => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Chiudi menu pubblicazione"
        onPress={onClose}
        style={styles.sheetOverlay}
      />
      <View style={styles.bottomSheet} testID="club-media-create-menu">
        <View style={styles.sheetHandle} />
        <AppText align="center" style={styles.sheetTitle} variant="titleSm">
          Pubblica contenuto
        </AppText>
        {CREATE_OPTIONS.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.kind}
            onPress={() => onSelect(option.kind)}
            style={styles.createOption}
            testID={`club-media-create-option-${option.kind}`}
          >
            <View style={styles.createIcon}>
              <Ionicons color={colors.accent} name={option.icon} size={24} />
            </View>
            <View style={styles.createText}>
              <AppText style={styles.createTitle} variant="bodySm">
                {option.title}
              </AppText>
              <AppText color="secondary" variant="caption">
                {option.description}
              </AppText>
            </View>
            <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

function ClubMediaPostFormModal({
  clubId,
  kind,
  onClose,
  onCreated,
  userId,
}: {
  clubId: string;
  kind: ClubMediaKind | null;
  onClose: () => void;
  onCreated: (post: ClubMediaPost) => void;
  userId: string | null;
}) {
  const [draft, setDraft] = useState<DraftState>(createEmptyDraft);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (kind) {
      setDraft(createEmptyDraft());
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [kind]);

  if (!kind) {
    return null;
  }

  const currentKind = kind;
  const meta = KIND_META[currentKind];
  const requiresMedia = currentKind !== "statement" && currentKind !== "event";
  const showMedia = currentKind !== "statement";
  const mediaLabel = currentKind === "highlights" ? "Video" : "Immagine o video";
  const titleLabel = getTitleLabel(currentKind);

  function patchDraft<Key extends keyof DraftState>(
    key: Key,
    value: DraftState[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handlePickMedia() {
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per pubblicare media.");
      return;
    }

    setIsUploading(true);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "club-media",
        mediaTypes: currentKind === "highlights" ? ["videos"] : ["images", "videos"],
        userId,
      });

      const upload = uploads[0];
      if (!upload) {
        return;
      }

      patchDraft("visualUrl", upload.url);
      patchDraft("visualType", upload.type === "video" ? "video" : "image");
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
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per pubblicare contenuti.");
      return;
    }

    setIsSaving(true);

    try {
      const post = await createClubMediaPost({
        attachmentLabel: draft.attachmentLabel,
        body: draft.body,
        clubId,
        createdByProfileId: userId,
        eventDate: draft.eventDate,
        excerpt: draft.excerpt,
        externalUrl: draft.externalUrl,
        intervieweeName: draft.intervieweeName,
        kind: currentKind,
        playerBirthYear: draft.playerBirthYear,
        playerName: draft.playerName,
        playerPreviousClub: draft.playerPreviousClub,
        playerRole: draft.playerRole,
        taggedProfileIds: draft.taggedProfiles.map((profile) => profile.profile_id),
        title: draft.title,
        videoDurationSeconds: draft.videoDurationSeconds,
        visualType: draft.visualType,
        visualUrl: draft.visualUrl,
      });

      onCreated(post);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pubblicazione non riuscita.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={kind !== null}>
      <SafeAreaView style={styles.formRoot}>
        <View style={styles.formHeader}>
          <Pressable
            accessibilityLabel="Chiudi form pubblicazione"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.detailTopButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={23} />
          </Pressable>
          <AppText numberOfLines={1} style={styles.formTitle} variant="titleSm">
            Pubblica {meta.detailLabel.toLowerCase()}
          </AppText>
          <View style={styles.detailTopButton} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent}>
          {showMedia ? (
            <MediaPickerField
              buttonLabel={draft.visualUrl ? "Sostituisci media" : `Carica ${mediaLabel.toLowerCase()}`}
              helperText={requiresMedia ? "Campo richiesto." : "Opzionale."}
              isUploading={isUploading}
              label={mediaLabel}
              mediaType={draft.visualType ?? "image"}
              onPick={handlePickMedia}
              previewUrl={draft.visualUrl || null}
            />
          ) : null}

          <Input
            label={titleLabel}
            onChangeText={(value) => patchDraft("title", value)}
            placeholder={getTitlePlaceholder(currentKind)}
            value={draft.title}
          />

          {currentKind === "market" ? (
            <>
              <Input
                label="Nome giocatore"
                onChangeText={(value) => patchDraft("playerName", value)}
                placeholder="Es. Marco Rossi"
                value={draft.playerName}
              />
              <View style={styles.inlineFields}>
                <View style={styles.inlineField}>
                  <SelectField
                    label="Ruolo"
                    onChange={(value) => patchDraft("playerRole", value)}
                    options={ROLE_OPTIONS}
                    placeholder="Ruolo"
                    value={draft.playerRole}
                  />
                </View>
                <View style={styles.inlineField}>
                  <Input
                    keyboardType="number-pad"
                    label="Classe"
                    onChangeText={(value) => patchDraft("playerBirthYear", value)}
                    placeholder="2006"
                    value={draft.playerBirthYear}
                  />
                </View>
              </View>
              <Input
                label="Provenienza"
                onChangeText={(value) => patchDraft("playerPreviousClub", value)}
                placeholder="Es. Lecco Academy"
                value={draft.playerPreviousClub}
              />
            </>
          ) : null}

          {currentKind === "interview" ? (
            <Input
              label="Nome intervistato"
              onChangeText={(value) => patchDraft("intervieweeName", value)}
              placeholder="Es. Giovanni Riva"
              value={draft.intervieweeName}
            />
          ) : null}

          {currentKind === "event" ? (
            <Input
              label="Data evento"
              onChangeText={(value) => patchDraft("eventDate", value)}
              placeholder="Es. 2026-05-20"
              value={draft.eventDate}
            />
          ) : null}

          {(currentKind === "highlights" || currentKind === "interview") ? (
            <Input
              keyboardType="number-pad"
              label="Durata video (secondi)"
              onChangeText={(value) => patchDraft("videoDurationSeconds", value)}
              placeholder="Es. 154"
              value={draft.videoDurationSeconds}
            />
          ) : null}

          {currentKind !== "statement" ? (
            <Input
              label="Anteprima"
              onChangeText={(value) => patchDraft("excerpt", value)}
              placeholder={getExcerptPlaceholder(currentKind)}
              value={draft.excerpt}
            />
          ) : null}

          <Input
            label={currentKind === "statement" ? "Testo comunicato" : "Descrizione"}
            multiline
            onChangeText={(value) => patchDraft("body", value)}
            placeholder={getBodyPlaceholder(currentKind)}
            value={draft.body}
          />

          {currentKind === "statement" ? (
            <>
              <Input
                label="Allegato o riferimento"
                onChangeText={(value) => patchDraft("attachmentLabel", value)}
                placeholder="Es. Calendario aggiornato.pdf"
                value={draft.attachmentLabel}
              />
              <Input
                autoCapitalize="none"
                label="Link esterno"
                onChangeText={(value) => patchDraft("externalUrl", value)}
                placeholder="https://..."
                value={draft.externalUrl}
              />
            </>
          ) : null}

          {currentKind === "market" || currentKind === "interview" || currentKind === "highlights" ? (
            <TaggedProfilePicker
              onChange={(profiles) => patchDraft("taggedProfiles", profiles)}
              required={currentKind === "market"}
              value={draft.taggedProfiles}
            />
          ) : null}
        </ScrollView>

        <View style={styles.formFooter}>
          <Button
            disabled={isUploading || isSaving}
            label={isSaving ? "Pubblicazione..." : "Pubblica"}
            onPress={() => {
              void handleSave();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function TaggedProfilePicker({
  onChange,
  required,
  value,
}: {
  onChange: (profiles: ClubMediaTaggedProfile[]) => void;
  required: boolean;
  value: ClubMediaTaggedProfile[];
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
    () => new Set(value.map((profile) => profile.profile_id)),
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
        profile_id: candidate.profile_id,
        role: "player",
      },
    ]);
    setQuery("");
    setSuggestions([]);
  }

  return (
    <View style={styles.tagPicker}>
      <Input
        label={required ? "Profilo giocatore taggato" : "Profili taggati"}
        onChangeText={setQuery}
        placeholder="Cerca giocatore da taggare"
        value={query}
      />

      {value.length > 0 ? (
        <View style={styles.selectedTags}>
          {value.map((profile) => (
            <View key={profile.profile_id} style={styles.selectedTagChip}>
              <Avatar name={profile.display_name} size="sm" uri={profile.avatar_url} />
              <AppText numberOfLines={1} style={styles.selectedTagText} variant="bodySm">
                {profile.display_name}
              </AppText>
              <Pressable
                accessibilityLabel={`Rimuovi ${profile.display_name}`}
                hitSlop={8}
                onPress={() =>
                  onChange(value.filter((item) => item.profile_id !== profile.profile_id))
                }
              >
                <Ionicons color={colors.accent} name="close" size={16} />
              </Pressable>
            </View>
          ))}
        </View>
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
              <Avatar
                name={candidate.full_name}
                size="sm"
                uri={candidate.avatar_url}
              />
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

function createEmptyDraft(): DraftState {
  return {
    attachmentLabel: "",
    body: "",
    eventDate: "",
    excerpt: "",
    externalUrl: "",
    intervieweeName: "",
    playerBirthYear: "",
    playerName: "",
    playerPreviousClub: "",
    playerRole: "",
    taggedProfiles: [],
    title: "",
    videoDurationSeconds: "",
    visualType: null,
    visualUrl: "",
  };
}

function buildFeedExcerpt(post: ClubMediaPost) {
  if (post.kind === "market") {
    return [
      post.player_role,
      post.player_birth_year ? `classe ${post.player_birth_year}` : null,
      post.player_previous_club,
    ]
      .filter(Boolean)
      .join(" • ");
  }

  return post.excerpt ?? post.body ?? "Contenuto ufficiale della societa'.";
}

function buildMediaMeta(post: ClubMediaPost) {
  const dateValue = post.kind === "event" ? post.event_date ?? post.published_at : post.published_at;
  const parts = [
    post.visual_type === "video"
      ? `Video${post.video_duration_seconds ? ` • ${formatDuration(post.video_duration_seconds)}` : ""}`
      : post.kind === "statement"
        ? "Comunicazione ufficiale"
        : post.visual_type === "image"
          ? "Foto"
          : "Media",
    formatDateLabel(dateValue ?? post.created_at),
  ];

  return parts.filter(Boolean).join(" • ");
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Data non disponibile";
  }

  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });
}

function formatRole(role: string | null) {
  const labels: Record<string, string> = {
    club_admin: "Societa'",
    coach: "Allenatore",
    fan: "Fan",
    media: "Media",
    player: "Giocatore",
    staff: "Staff",
  };

  return role ? labels[role] ?? role : "Profilo FootMe";
}

function formatCandidateLine(candidate: AgentPlayerCandidate) {
  return [
    candidate.primary_position,
    candidate.birth_year ? `classe ${candidate.birth_year}` : null,
    candidate.region,
  ]
    .filter(Boolean)
    .join(" • ");
}

function normalizeExternalUrl(url: string) {
  const trimmedUrl = url.trim();
  return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
}

function getTitleLabel(kind: ClubMediaKind) {
  if (kind === "highlights") return "Titolo partita";
  if (kind === "market") return "Titolo annuncio";
  if (kind === "statement") return "Titolo comunicato";
  if (kind === "event") return "Titolo evento";
  return "Titolo";
}

function getTitlePlaceholder(kind: ClubMediaKind) {
  if (kind === "highlights") return "Es. AC Como 2-1 Lecco";
  if (kind === "market") return "Es. Marco Rossi e' un nuovo giocatore";
  if (kind === "statement") return "Es. Aggiornamento calendario allenamenti";
  if (kind === "event") return "Es. Open day settore giovanile";
  return "Titolo contenuto";
}

function getExcerptPlaceholder(kind: ClubMediaKind) {
  if (kind === "highlights") return "Le migliori azioni della partita";
  if (kind === "training") return "Seduta tecnico-tattica del mercoledi";
  if (kind === "event") return "Breve anteprima dell'evento";
  return "Breve anteprima";
}

function getBodyPlaceholder(kind: ClubMediaKind) {
  if (kind === "market") return "Scrivi il testo ufficiale o il messaggio di benvenuto...";
  if (kind === "statement") return "Scrivi il comunicato ufficiale...";
  if (kind === "event") return "Dettagli evento, luogo, orari e informazioni utili...";
  return "Descrivi il contenuto...";
}

const styles = StyleSheet.create({
  actionsBar: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[16],
    paddingVertical: spacing[14],
  },
  attachmentCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  attachmentIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius[6],
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  attachmentName: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    bottom: 0,
    left: 0,
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    position: "absolute",
    right: 0,
  },
  commentAuthor: {
    fontWeight: typography.fontWeight.bold,
  },
  commentComposer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[10],
  },
  commentInputWrap: {
    flex: 1,
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  commentText: {
    flex: 1,
    gap: spacing[4],
  },
  commentsList: {
    gap: spacing[14],
  },
  commentsSection: {
    gap: spacing[14],
  },
  commentsTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  createIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  createOption: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[14],
    minHeight: 76,
    paddingVertical: spacing[12],
  },
  createText: {
    flex: 1,
    gap: spacing[4],
  },
  createTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  detailAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 44,
  },
  detailActionText: {
    fontWeight: typography.fontWeight.semibold,
  },
  detailBody: {
    backgroundColor: colors.surface,
    gap: spacing[16],
    padding: spacing[20],
  },
  detailContent: {
    backgroundColor: colors.surface,
    paddingBottom: spacing[28],
  },
  detailDescription: {
    lineHeight: 23,
  },
  detailHero: {
    backgroundColor: "#000",
    height: 240,
    position: "relative",
  },
  detailHeroFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  detailHeroImage: {
    height: "100%",
    opacity: 0.9,
    width: "100%",
  },
  detailLabel: {
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  detailLoader: {
    alignSelf: "flex-start",
  },
  detailMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  detailPlayButton: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.44)",
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
  detailRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  detailTitle: {
    fontWeight: typography.fontWeight.heavy,
  },
  detailTopBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  detailTopButton: {
    alignItems: "center",
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  detailTopTitle: {
    flex: 1,
    fontWeight: typography.fontWeight.bold,
    textAlign: "center",
  },
  documentHero: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing[28],
  },
  documentIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[12],
    marginHorizontal: spacing[20],
    padding: spacing[16],
  },
  emptyText: {
    flex: 1,
    gap: spacing[4],
  },
  emptyTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  feedList: {
    backgroundColor: colors.surface,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing[14],
  },
  filterChipActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },
  filterText: {
    fontWeight: typography.fontWeight.bold,
  },
  filtersContent: {
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  filtersScroll: {
    marginHorizontal: -spacing[20],
  },
  formContent: {
    gap: spacing[16],
    padding: spacing[20],
    paddingBottom: spacing[28],
  },
  formFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  formHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  formRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  formTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  inlineField: {
    flex: 1,
  },
  inlineFields: {
    flexDirection: "row",
    gap: spacing[12],
  },
  loadingState: {
    alignItems: "center",
    gap: spacing[8],
    padding: spacing[24],
  },
  marketMeta: {
    fontWeight: typography.fontWeight.bold,
  },
  marketPlayer: {
    fontWeight: typography.fontWeight.bold,
  },
  marketSummary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    gap: spacing[4],
    padding: spacing[12],
  },
  mediaExcerpt: {
    lineHeight: 19,
  },
  mediaLabel: {
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  mediaMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  mediaMetaText: {
    flexShrink: 1,
  },
  mediaRow: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[15],
  },
  mediaRowContent: {
    flex: 1,
    gap: spacing[4],
    minHeight: 80,
  },
  mediaThumb: {
    alignItems: "center",
    borderRadius: radius[8],
    height: 80,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 80,
  },
  mediaThumbImage: {
    height: "100%",
    width: "100%",
  },
  mediaTitle: {
    fontWeight: typography.fontWeight.bold,
    lineHeight: 20,
  },
  playOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 24,
    width: 32,
  },
  pressedRow: {
    backgroundColor: colors.surfaceMuted,
  },
  root: {
    backgroundColor: colors.background,
    paddingBottom: spacing[24],
  },
  selectedTagChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    maxWidth: "100%",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  selectedTagText: {
    flexShrink: 1,
    fontWeight: typography.fontWeight.semibold,
  },
  selectedTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: radius.full,
    height: 4,
    marginBottom: spacing[16],
    width: 40,
  },
  sheetOverlay: {
    backgroundColor: "rgba(0,0,0,0.42)",
    flex: 1,
  },
  sheetTitle: {
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[10],
  },
  statementBody: {
    fontSize: typography.fontSize[15],
    lineHeight: 24,
  },
  subjectBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  subjectIcon: {
    alignItems: "center",
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  subjectKicker: {
    fontWeight: typography.fontWeight.bold,
  },
  subjectName: {
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    lineHeight: 20,
  },
  suggestionName: {
    fontWeight: typography.fontWeight.bold,
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[10],
  },
  suggestionText: {
    flex: 1,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    overflow: "hidden",
  },
  tagPicker: {
    gap: spacing[10],
  },
  taggedCta: {
    fontWeight: typography.fontWeight.bold,
  },
  taggedInfo: {
    flex: 1,
  },
  taggedList: {
    gap: spacing[8],
  },
  taggedName: {
    fontWeight: typography.fontWeight.bold,
  },
  taggedProfileCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[10],
  },
  taggedSection: {
    gap: spacing[8],
  },
  taggedTitle: {
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  title: {
    fontWeight: typography.fontWeight.heavy,
  },
});
