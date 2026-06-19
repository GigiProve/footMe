import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { CompactContentModule } from "../../../src/features/content/components/CompactContentModule";
import { TagManageSheet } from "../../../src/features/content/components/TagManageSheet";
import type {
  TaggedContentType,
  TargetType,
} from "../../../src/features/content/content-tag-service";
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { AppText, Avatar, Button } from "../../../src/ui";

type TaggedEntry = {
  avatar_url: string | null;
  display_name: string;
  target_id: string;
  target_type: TargetType;
};

type ContentView = {
  body: string | null;
  publisherId: string;
  publisherKind: "club" | "profile";
  publisherName: string;
  tagged: TaggedEntry[];
  thumbnailUrl: string | null;
  title: string;
  typeLabel: string;
  viewerTagged: boolean;
};

const SUPPORTED: TaggedContentType[] = ["club_media", "media_profile"];

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
    body: post.body ?? post.excerpt ?? null,
    publisherId: post.club_id,
    publisherKind: "club",
    publisherName: "Società",
    tagged: post.tagged_profiles.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
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
    body: post.body ?? post.excerpt ?? null,
    publisherId: post.media_profile_id,
    publisherKind: "profile",
    publisherName: post.author_name,
    tagged: post.tagged_targets.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
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

export default function ContentDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const { profile } = useSession();
  const router = useRouter();
  const viewerId = profile?.id ?? null;

  const [content, setContent] = useState<ContentView | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isManageOpen, setManageOpen] = useState(false);

  const contentType = type as TaggedContentType;

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
        setContent(post ? mapClubMedia(post, viewerId) : null);
      } else {
        const post = await fetchMediaProfilePostDetail(id, viewerId);
        setContent(post ? mapMediaProfile(post, viewerId) : null);
      }
    } catch {
      setContent(null);
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

          <Pressable
            accessibilityRole="button"
            onPress={openPublisher}
            style={styles.publisherRow}
          >
            <Ionicons color={colors.textSecondary} name="megaphone-outline" size={16} />
            <AppText style={styles.publisherText} variant="bodySm">
              Pubblicato da{" "}
              <AppText color="accent" variant="bodySm">
                {content.publisherName}
              </AppText>
            </AppText>
          </Pressable>

          {content.body ? (
            <AppText color="secondary" variant="bodyLg">
              {content.body}
            </AppText>
          ) : null}

          {content.tagged.length > 0 ? (
            <View style={styles.taggedSection}>
              <AppText color="secondary" variant="caption">
                Profili taggati
              </AppText>
              <View style={styles.taggedList}>
                {content.tagged.map((target) => (
                  <Pressable
                    accessibilityRole="button"
                    key={`${target.target_type}:${target.target_id}`}
                    onPress={() => openTarget(target)}
                    style={styles.taggedChip}
                  >
                    <Avatar
                      name={target.display_name}
                      size="sm"
                      square={target.target_type !== "profile"}
                      uri={target.avatar_url}
                    />
                    <AppText numberOfLines={1} style={styles.taggedName} variant="bodySm">
                      {target.display_name}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

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

      {isManageOpen && content && viewerId ? (
        <TagManageSheet
          content={{
            thumbnailUrl: content.thumbnailUrl,
            title: content.title,
            typeLabel: content.typeLabel,
          }}
          contentType={contentType}
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

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
  },
  publisherRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  publisherText: {
    flex: 1,
  },
  scroll: {
    gap: spacing[16],
    paddingBottom: spacing[28],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
  },
  taggedChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  taggedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  taggedName: {
    maxWidth: 150,
  },
  taggedSection: {
    gap: spacing[8],
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
