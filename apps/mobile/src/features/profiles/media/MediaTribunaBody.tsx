/**
 * Corpo interattivo di un contenuto Tribuna nel dettaglio condiviso
 * (REV-PROF-21, "Vota il migliore e Q&A").
 *
 * Simmetrico a `FanContentBody`: il dettaglio canonico è lo stesso per tutte
 * le superfici contenuto, e ogni dominio porta soltanto il proprio corpo. Qui
 * vivono il voto di un sondaggio o di una votazione e le domande di un Q&A —
 * le implementazioni che esistevano già, spostate dalla card del profilo al
 * posto che la task assegna loro.
 */
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, Input } from "../../../ui";
import {
  submitMediaTribunaQuestion,
  voteMediaTribunaOption,
  voteMediaTribunaQuestion,
  type MediaTribunaPost,
  type MediaTribunaQuestion,
} from "../media-tribuna-service";
import {
  buildVotedMediaTribunaState,
  isMediaTribunaVotable,
  sortMediaTribunaQuestions,
} from "./media-tribuna-model";

export type MediaTribunaBodyProps = {
  post: MediaTribunaPost;
  viewerProfileId: string | null;
};

export function MediaTribunaBody({
  post,
  viewerProfileId,
}: MediaTribunaBodyProps) {
  const [options, setOptions] = useState(post.options);
  const [totalVotes, setTotalVotes] = useState(post.total_vote_count);
  const [questions, setQuestions] = useState<MediaTribunaQuestion[]>(
    sortMediaTribunaQuestions(post.questions),
  );
  const [questionDraft, setQuestionDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasVoted = options.some((option) => option.is_voted);
  const showResults = hasVoted || !viewerProfileId;

  async function handleVote(optionId: string) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare nella Tribuna.");
      return;
    }

    const previousOptions = options;
    const previousTotal = totalVotes;
    const next = buildVotedMediaTribunaState(
      { ...post, options, total_vote_count: totalVotes },
      optionId,
    );

    setOptions(next.options);
    setTotalVotes(next.total_vote_count);

    try {
      await voteMediaTribunaOption({
        optionId,
        postId: post.id,
        profileId: viewerProfileId,
      });
    } catch {
      setOptions(previousOptions);
      setTotalVotes(previousTotal);
      Alert.alert("Errore", "Impossibile registrare il voto.");
    }
  }

  async function handleToggleQuestionVote(question: MediaTribunaQuestion) {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per votare una domanda.");
      return;
    }

    const previousQuestions = questions;
    const nextVoted = !question.is_voted;

    setQuestions(
      sortMediaTribunaQuestions(
        questions.map((entry) =>
          entry.id === question.id
            ? {
                ...entry,
                is_voted: nextVoted,
                vote_count: Math.max(
                  0,
                  entry.vote_count + (nextVoted ? 1 : -1),
                ),
              }
            : entry,
        ),
      ),
    );

    try {
      await voteMediaTribunaQuestion(question.id, viewerProfileId, nextVoted);
    } catch {
      setQuestions(previousQuestions);
      Alert.alert("Errore", "Impossibile aggiornare il voto.");
    }
  }

  async function handleSubmitQuestion() {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per inviare una domanda.");
      return;
    }

    const body = questionDraft.trim();

    if (!body) {
      return;
    }

    setIsSubmitting(true);

    try {
      const question = await submitMediaTribunaQuestion({
        body,
        postId: post.id,
        profileId: viewerProfileId,
      });
      setQuestions((current) =>
        sortMediaTribunaQuestions([...current, question]),
      );
      setQuestionDraft("");
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error ? error.message : "Domanda non pubblicata.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.root} testID="media-tribuna-body">
      {post.body ? (
        <AppText color="secondary" variant="bodyLg">
          {post.body}
        </AppText>
      ) : null}

      {isMediaTribunaVotable(post.kind) && options.length > 0 ? (
        <View style={styles.options}>
          {options.map((option) => {
            const label =
              post.kind === "player_vote"
                ? option.player_display_name || option.label
                : option.label;
            const percentage = Math.max(0, Math.min(100, option.percentage));

            return (
              <Pressable
                accessibilityLabel={
                  showResults
                    ? `${label}, ${percentage} per cento`
                    : `Vota ${label}`
                }
                accessibilityRole="button"
                accessibilityState={{
                  disabled: hasVoted || !viewerProfileId,
                  selected: option.is_voted,
                }}
                disabled={hasVoted || !viewerProfileId}
                key={option.id}
                onPress={() => {
                  void handleVote(option.id);
                }}
                style={({ pressed }) => [
                  styles.option,
                  pressed ? styles.pressed : null,
                ]}
                testID={`media-tribuna-detail-option-${option.id}`}
              >
                <View style={styles.optionRow}>
                  {post.kind === "player_vote" ? (
                    <Avatar
                      name={label}
                      size="sm"
                      uri={option.player_avatar_url ?? undefined}
                    />
                  ) : null}
                  <AppText
                    numberOfLines={1}
                    style={styles.optionLabel}
                    variant="bodyLg"
                  >
                    {label}
                  </AppText>
                  {showResults ? (
                    <AppText variant="numeric">{`${percentage}%`}</AppText>
                  ) : null}
                </View>

                {showResults ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.track}
                  >
                    <View
                      style={[
                        styles.trackFill,
                        { width: `${percentage}%` },
                        option.is_voted ? styles.trackFillVoted : null,
                      ]}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <AppText color="secondary" variant="caption">
            {`${totalVotes} ${totalVotes === 1 ? "voto" : "voti"}`}
          </AppText>
        </View>
      ) : null}

      {post.kind === "community_qa" ? (
        <View style={styles.questions}>
          {questions.map((question) => (
            <View key={question.id} style={styles.question}>
              <Pressable
                accessibilityLabel={`Vota questa domanda, ${question.vote_count} voti`}
                accessibilityRole="button"
                accessibilityState={{ selected: question.is_voted }}
                onPress={() => {
                  void handleToggleQuestionVote(question);
                }}
                style={[
                  styles.questionVote,
                  question.is_voted ? styles.questionVoteActive : null,
                ]}
                testID={`media-tribuna-question-vote-${question.id}`}
              >
                <Ionicons
                  color={question.is_voted ? colors.inkInvert : colors.accent}
                  name="chevron-up"
                  size={16}
                />
                <AppText
                  color={question.is_voted ? "inverse" : "accent"}
                  variant="caption"
                >
                  {question.vote_count}
                </AppText>
              </Pressable>

              <View style={styles.questionText}>
                <AppText variant="bodySm">{question.body}</AppText>
                <AppText color="secondary" variant="caption">
                  {question.author_name}
                </AppText>
              </View>
            </View>
          ))}

          <View style={styles.composer}>
            <Input
              onChangeText={setQuestionDraft}
              placeholder="Scrivi una domanda per la community"
              style={styles.composerInput}
              value={questionDraft}
            />
            <Button
              disabled={questionDraft.trim().length === 0 || isSubmitting}
              label={isSubmitting ? "Invio…" : "Invia"}
              onPress={() => {
                void handleSubmitQuestion();
              }}
              size="sm"
              testID="media-tribuna-question-submit"
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[8],
  },
  composerInput: {
    flex: 1,
  },
  option: {
    gap: spacing[6],
    paddingVertical: spacing[6],
  },
  optionLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  optionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 32,
  },
  options: {
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  question: {
    flexDirection: "row",
    gap: spacing[10],
  },
  questionText: {
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  questionVote: {
    alignItems: "center",
    borderColor: colors.accentSoftBorder,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    width: 44,
  },
  questionVoteActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  questions: {
    gap: spacing[12],
  },
  root: {
    gap: spacing[16],
  },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 6,
    overflow: "hidden",
  },
  trackFill: {
    backgroundColor: colors.accentSoftBorder,
    borderRadius: radius.full,
    height: "100%",
  },
  trackFillVoted: {
    backgroundColor: colors.accent,
  },
});
