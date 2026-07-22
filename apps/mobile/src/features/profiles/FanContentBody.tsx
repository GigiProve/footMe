import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { ResizeMode, Video } from "expo-av";

import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../../ui";
import { FootballPitchPreview } from "./FanProfileView";
import {
  voteFanTribunaPoll,
  type FanTribunaPollOption,
  type FanTribunaPost,
} from "./fan-tribuna-service";

type FanContentBodyProps = {
  onVoteError?: (message: string) => void;
  post: FanTribunaPost;
  viewerProfileId: string | null;
};

/**
 * Renders the kind-specific body of a fan tribuna post in the content detail
 * screen: opinion/proposal text, an interactive poll, a formation pitch, or a
 * photo/video. The tag header and chrome live in the detail route.
 */
export function FanContentBody({
  onVoteError,
  post,
  viewerProfileId,
}: FanContentBodyProps) {
  const [options, setOptions] = useState<FanTribunaPollOption[]>(post.poll_options);
  const [totalVotes, setTotalVotes] = useState(post.total_vote_count);
  const [isVoting, setIsVoting] = useState(false);

  async function handleVote(optionId: string) {
    if (!viewerProfileId || isVoting) {
      return;
    }

    const current = options.find((option) => option.is_voted);
    if (current?.id === optionId) {
      return;
    }

    const nextTotal = totalVotes + (current ? 0 : 1);
    const nextOptions = options.map((option) => {
      let voteCount = option.vote_count;
      if (option.id === current?.id) {
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

    setOptions(nextOptions);
    setTotalVotes(nextTotal);
    setIsVoting(true);

    try {
      await voteFanTribunaPoll({
        optionId,
        postId: post.id,
        profileId: viewerProfileId,
      });
    } catch (error) {
      setOptions(post.poll_options);
      setTotalVotes(post.total_vote_count);
      onVoteError?.(error instanceof Error ? error.message : "Voto non riuscito.");
    } finally {
      setIsVoting(false);
    }
  }

  return (
    <View style={styles.container}>
      {post.body ? (
        <AppText color="secondary" variant="bodyLg">
          {post.body}
        </AppText>
      ) : null}

      {post.kind === "photo" && post.media_url ? (
        post.media_type === "video" ? (
          <Video
            isMuted
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            source={{ uri: post.media_url }}
            style={styles.media}
            useNativeControls
          />
        ) : (
          <Image source={{ uri: post.media_url }} style={styles.media} />
        )
      ) : null}

      {post.kind === "poll" ? (
        <View style={styles.poll}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.is_voted }}
              disabled={isVoting}
              key={option.id}
              onPress={() => {
                void handleVote(option.id);
              }}
              style={[styles.pollOption, option.is_voted ? styles.pollOptionSelected : null]}
            >
              <View
                pointerEvents="none"
                style={[styles.pollFill, { width: `${option.percentage}%` }]}
              />
              <AppText style={styles.pollLabel} variant="bodySm">
                {option.label}
              </AppText>
              <AppText color="secondary" variant="caption">
                {totalVotes > 0 ? `${option.percentage}%` : "Vota"}
              </AppText>
            </Pressable>
          ))}
          <AppText color="secondary" variant="caption">
            {totalVotes} voti
          </AppText>
        </View>
      ) : null}

      {post.kind === "formation" ? (
        <FootballPitchPreview
          formation={post.formation ?? "4-3-3"}
          players={post.lineup_players}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  media: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    width: "100%",
  },
  poll: {
    gap: spacing[8],
  },
  pollFill: {
    backgroundColor: colors.accentSoft,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  pollLabel: {
    flex: 1,
  },
  pollOption: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    overflow: "hidden",
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  pollOptionSelected: {
    borderColor: colors.accent,
  },
});
