import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { useSession } from "../../../src/features/auth/use-session";
import {
  fetchClubMediaPostDetail,
  type ClubMediaPost,
} from "../../../src/features/clubs/club-media-service";
import {
  fetchMediaProfilePostDetail,
  type MediaProfilePost,
} from "../../../src/features/profiles/media-profile-post-service";
import {
  fetchFanTribunaPostDetail,
  type FanTribunaPostDetail,
} from "../../../src/features/profiles/fan-tribuna-service";
import {
  fetchMediaTribunaDetail,
  type MediaTribunaPost,
} from "../../../src/features/profiles/media-tribuna-service";
import {
  fetchFanMediaPostDetail,
  type FanMediaPost,
} from "../../../src/features/profiles/fan-media-service";
import { FanContentBody } from "../../../src/features/profiles/FanContentBody";
import {
  fetchContentPublisher,
  type ContentPublisher,
} from "../../../src/features/content/content-publisher-service";
import { CompactContentModule } from "../../../src/features/content/components/CompactContentModule";
import { ContentTaggedHeader } from "../../../src/features/content/components/ContentTaggedHeader";
import { TagManageSheet } from "../../../src/features/content/components/TagManageSheet";
import type { ContentTaggedTarget } from "../../../src/features/content/components/TaggedProfilesSheet";
import type { TaggedContentType } from "../../../src/features/content/content-tag-service";
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { AppText, Button } from "../../../src/ui";

type TaggedEntry = ContentTaggedTarget;

type ContentView = {
  authorName: string | null;
  body: string | null;
  displayMode: "full" | "preview";
  excerpt: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
  publisherId: string;
  publisherKind: "club" | "profile";
  publisherName: string;
  readingLabel: string | null;
  sourceName: string | null;
  tagged: TaggedEntry[];
  thumbnailUrl: string | null;
  title: string;
  typeLabel: string;
  viewerTagged: boolean;
};

/**
 * Tutte le superfici contenuto apribili in dettaglio. `media_tribuna` e
 * `fan_media` sono state aggiunte da CER-05 perché Cerca > Media e contenuti
 * le indicizza e ogni risultato deve essere apribile.
 */
type ContentDetailType = TaggedContentType | "media_tribuna" | "fan_media";

const SUPPORTED: ContentDetailType[] = [
  "club_media",
  "media_profile",
  "fan_tribuna",
  "media_tribuna",
  "fan_media",
];

/**
 * Solo tre superfici hanno una tag table: `media_tribuna_posts` e
 * `fan_media_posts` non sono taggabili, quindi non passano da TagManageSheet.
 */
const TAGGABLE: TaggedContentType[] = ["club_media", "media_profile", "fan_tribuna"];

function asTaggedContentType(value: ContentDetailType): TaggedContentType | null {
  return TAGGABLE.includes(value as TaggedContentType)
    ? (value as TaggedContentType)
    : null;
}

function clubMediaTypeLabel(kind: ClubMediaPost["kind"]): string {
  if (kind === "highlights") return "Highlights";
  if (kind === "interview") return "Intervista";
  if (kind === "market") return "Mercato";
  if (kind === "statement") return "Comunicato";
  if (kind === "training") return "Allenamento";
  if (kind === "event") return "Evento";
  return "Contenuto";
}

function mapClubMedia(post: ClubMediaPost, viewerId: string | null): ContentView {
  return {
    authorName: null,
    body: post.body ?? post.excerpt ?? null,
    displayMode: "full",
    excerpt: post.excerpt ?? null,
    externalUrl: null,
    publishedAt: null,
    publisherId: post.club_id,
    publisherKind: "club",
    publisherName: "Società",
    readingLabel: null,
    sourceName: null,
    tagged: post.tagged_profiles.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
      subtitle: tag.role,
      target_id: tag.target_id,
      target_type: tag.target_type,
    })),
    thumbnailUrl: post.thumbnail_url ?? post.visual_url,
    title: post.title,
    typeLabel: clubMediaTypeLabel(post.kind),
    viewerTagged:
      !!viewerId &&
      post.tagged_profiles.some(
        (tag) =>
          tag.target_type === "profile" &&
          (tag.profile_id ?? tag.target_id) === viewerId,
      ),
  };
}

function mapMediaProfile(
  post: MediaProfilePost,
  viewerId: string | null,
): ContentView {
  return {
    authorName: post.author_name,
    body: post.body ?? post.excerpt ?? null,
    displayMode: post.display_mode,
    excerpt: post.excerpt ?? null,
    externalUrl: post.external_url,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.media_profile_id,
    publisherKind: "profile",
    publisherName: post.publisher_name,
    readingLabel: post.kind === "news" ? null : `${post.reading_time_minutes} min`,
    sourceName: post.source_name,
    tagged: post.tagged_targets.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
      subtitle: tag.subtitle,
      target_id: tag.target_id,
      target_type: tag.target_type,
    })),
    thumbnailUrl: post.cover_url,
    title: post.title,
    typeLabel: post.kind === "news" ? "News" : "Articolo",
    viewerTagged:
      !!viewerId &&
      post.tagged_targets.some(
        (tag) => tag.target_type === "profile" && tag.target_id === viewerId,
      ),
  };
}

function fanTribunaTypeLabel(kind: FanTribunaPostDetail["kind"]): string {
  if (kind === "poll") return "Sondaggio";
  if (kind === "formation") return "Formazione";
  if (kind === "photo") return "Foto / Video";
  if (kind === "opinion") return "Opinione";
  return "Proposta";
}

function mapFanTribuna(
  post: FanTribunaPostDetail,
  viewerId: string | null,
): ContentView {
  return {
    authorName: null,
    body: post.body ?? null,
    displayMode: "full",
    excerpt: null,
    externalUrl: null,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.profile_id,
    publisherKind: "profile",
    publisherName: post.publisher_name,
    readingLabel: null,
    sourceName: null,
    tagged: post.tagged_targets.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
      subtitle: null,
      target_id: tag.target_id,
      target_type: tag.target_type,
    })),
    thumbnailUrl: post.thumbnail_url ?? null,
    title: post.title,
    typeLabel: fanTribunaTypeLabel(post.kind),
    viewerTagged:
      !!viewerId &&
      post.tagged_targets.some(
        (tag) => tag.target_type === "profile" && tag.target_id === viewerId,
      ),
  };
}

function mediaTribunaTypeLabel(kind: MediaTribunaPost["kind"]): string {
  if (kind === "editorial_poll") return "Sondaggio editoriale";
  if (kind === "article_debate") return "Dibattito";
  if (kind === "player_vote") return "Votazione";
  return "Domande e risposte";
}

function mapMediaTribuna(
  post: MediaTribunaPost,
  publisher: ContentPublisher,
): ContentView {
  return {
    authorName: null,
    body: post.body ?? null,
    displayMode: "full",
    excerpt: null,
    externalUrl: null,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.media_profile_id,
    publisherKind: "profile",
    publisherName: publisher.name,
    readingLabel: null,
    sourceName: null,
    tagged: [],
    thumbnailUrl: null,
    title: post.title,
    typeLabel: mediaTribunaTypeLabel(post.kind),
    viewerTagged: false,
  };
}

function mapFanMedia(post: FanMediaPost, publisher: ContentPublisher): ContentView {
  return {
    authorName: null,
    body: null,
    displayMode: "full",
    excerpt: post.description,
    externalUrl: null,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.profile_id,
    publisherKind: "profile",
    publisherName: publisher.name,
    readingLabel: null,
    sourceName: post.tag,
    tagged: [],
    thumbnailUrl: post.thumbnail_url ?? post.visual_url,
    title: post.description,
    typeLabel: post.visual_type === "video" ? "Video" : "Foto",
    viewerTagged: false,
  };
}

export default function ContentDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const { profile } = useSession();
  const router = useRouter();
  const viewerId = profile?.id ?? null;

  const [content, setContent] = useState<ContentView | null>(null);
  const [fanPost, setFanPost] = useState<FanTribunaPostDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isManageOpen, setManageOpen] = useState(false);

  const contentType = type as ContentDetailType;
  const taggableType = asTaggedContentType(contentType);

  const load = useCallback(async () => {
    if (!id || !SUPPORTED.includes(contentType)) {
      setContent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (contentType === "club_media") {
        const post = await fetchClubMediaPostDetail(id, viewerId);
        setFanPost(null);
        setContent(post ? mapClubMedia(post, viewerId) : null);
      } else if (contentType === "fan_tribuna") {
        const post = await fetchFanTribunaPostDetail(id, viewerId);
        setFanPost(post);
        setContent(post ? mapFanTribuna(post, viewerId) : null);
      } else if (contentType === "media_tribuna") {
        const post = await fetchMediaTribunaDetail(id, viewerId);
        setFanPost(null);
        const publisher = post ? await fetchContentPublisher(post.media_profile_id) : null;
        setContent(post && publisher ? mapMediaTribuna(post, publisher) : null);
      } else if (contentType === "fan_media") {
        const post = await fetchFanMediaPostDetail(id, viewerId);
        setFanPost(null);
        const publisher = post ? await fetchContentPublisher(post.profile_id) : null;
        setContent(post && publisher ? mapFanMedia(post, publisher) : null);
      } else {
        const post = await fetchMediaProfilePostDetail(id, viewerId);
        setFanPost(null);
        setContent(post ? mapMediaProfile(post, viewerId) : null);
      }
    } catch {
      setContent(null);
      setFanPost(null);
    } finally {
      setLoading(false);
    }
  }, [contentType, id, viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  function openTarget(target: TaggedEntry) {
    if (target.target_type === "club") {
      router.push({ params: { id: target.target_id }, pathname: "/club/[id]" });
    } else if (target.target_type === "team") {
      router.push({
        params: { id: target.target_id },
        pathname: "/club/team/[id]",
      });
    } else {
      router.push({ params: { id: target.target_id }, pathname: "/profile/[id]" });
    }
  }

  function openPublisher() {
    if (!content) {
      return;
    }
    if (content.publisherKind === "club") {
      router.push({ params: { id: content.publisherId }, pathname: "/club/[id]" });
    } else {
      router.push({
        params: { id: content.publisherId },
        pathname: "/profile/[id]",
      });
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.topBarButton}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>
        <AppText align="center" style={styles.topBarTitle} variant="bodySm">
          Contenuto
        </AppText>
        <View style={styles.topBarButton} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : !content ? (
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodyLg">
            Contenuto non disponibile.
          </AppText>
          <Button label="Torna indietro" onPress={() => router.back()} variant="secondary" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <CompactContentModule
            thumbnailUrl={content.thumbnailUrl}
            title={content.title}
            typeLabel={content.typeLabel}
          />

          <ContentTaggedHeader
            authorName={content.authorName}
            onOpenTarget={openTarget}
            onPressPublisher={openPublisher}
            publishedAt={content.publishedAt}
            publisherName={content.publisherName}
            readingLabel={content.readingLabel}
            tagged={content.tagged}
          />

          {contentType === "fan_tribuna" && fanPost ? (
            <FanContentBody post={fanPost} viewerProfileId={viewerId} />
          ) : content.displayMode === "preview" ? (
            <>
              {content.excerpt ? (
                <AppText color="secondary" variant="bodyLg">
                  {content.excerpt}
                </AppText>
              ) : null}
              {content.externalUrl ? (
                <SourceLinkCard
                  sourceName={content.sourceName}
                  title="Leggi l'articolo completo sul sito"
                  url={content.externalUrl}
                />
              ) : null}
            </>
          ) : (
            <>
              {content.body ? (
                <AppText color="secondary" variant="bodyLg">
                  {content.body}
                </AppText>
              ) : null}
              {content.externalUrl ? (
                <SourceLinkCard
                  sourceName={content.sourceName}
                  title="Leggi anche sul sito"
                  url={content.externalUrl}
                />
              ) : null}
            </>
          )}

          {content.viewerTagged ? (
            <Button
              label="Gestisci tag"
              leftIcon={
                <Ionicons color={colors.textPrimary} name="pricetag-outline" size={18} />
              }
              onPress={() => setManageOpen(true)}
              variant="secondary"
            />
          ) : null}
        </ScrollView>
      )}

      {isManageOpen && content && viewerId && taggableType ? (
        <TagManageSheet
          content={{
            thumbnailUrl: content.thumbnailUrl,
            title: content.title,
            typeLabel: content.typeLabel,
          }}
          contentType={taggableType}
          onActionDone={load}
          onClose={() => setManageOpen(false)}
          postId={id}
          taggedId={viewerId}
          targetType="profile"
          visible
        />
      ) : null}
    </Screen>
  );
}

function SourceLinkCard({
  sourceName,
  title,
  url,
}: {
  sourceName: string | null;
  title: string;
  url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={styles.sourceCard}
    >
      <View style={styles.sourceCardText}>
        <AppText color="accent" variant="bodySm">
          {title}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {sourceName ? `Fonte: ${sourceName}` : "Fonte originale"}
        </AppText>
      </View>
      <Ionicons color={colors.accent} name="open-outline" size={19} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
  },
  scroll: {
    gap: spacing[16],
    paddingBottom: spacing[28],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
  },
  sourceCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  sourceCardText: {
    flex: 1,
    gap: spacing[4],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarTitle: {
    flex: 1,
    fontWeight: "600",
  },
});
