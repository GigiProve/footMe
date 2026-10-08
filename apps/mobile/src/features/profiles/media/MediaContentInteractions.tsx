/**
 * Interazioni del dettaglio contenuto Media/Creator (REV-PROF-21,
 * "Dettagli contenuto").
 *
 * Il Master Profile mostra anteprime; il dettaglio condiviso è responsabile
 * di Salva, commenti e reazioni. Prima della task quelle azioni vivevano in
 * una modale dentro il profilo — un secondo dettaglio, che la task vieta — e
 * il dettaglio canonico non le aveva. Sono state spostate qui, così esiste un
 * solo dettaglio e non si perde nulla: Salva resta disponibile, i commenti
 * restano dove si leggono i contenuti.
 *
 * Funziona per entrambe le superfici Media — articoli e Tribuna — perché le
 * due hanno lo stesso contratto di interazione e lo stesso modello di
 * commento. Nessuna icona Salvati finisce nelle griglie: sta qui, nel
 * dettaglio, come REV-PROF-12 prescrive.
 */
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, Input } from "../../../ui";
import {
  addMediaProfilePostComment,
  toggleSavedMediaProfilePost,
} from "../media-profile-post-service";
import {
  addMediaTribunaComment,
  toggleSavedMediaTribuna,
} from "../media-tribuna-service";

export type MediaInteractionComment = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  profile_id: string;
};

export type MediaContentInteractionsProps = {
  /** Quale superficie: decide quale servizio esistente viene chiamato. */
  contentType: "media_profile" | "media_tribuna";
  initialComments: readonly MediaInteractionComment[];
  initialIsSaved: boolean;
  postId: string;
  viewerProfileId: string | null;
};

export function MediaContentInteractions({
  contentType,
  initialComments,
  initialIsSaved,
  postId,
  viewerProfileId,
}: MediaContentInteractionsProps) {
  const [comments, setComments] = useState<MediaInteractionComment[]>([
    ...initialComments,
  ]);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  async function handleToggleSave() {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per salvare questo contenuto.");
      return;
    }

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    setIsSaving(true);

    try {
      if (contentType === "media_profile") {
        await toggleSavedMediaProfilePost(viewerProfileId, postId, nextSaved);
      } else {
        await toggleSavedMediaTribuna(viewerProfileId, postId, nextSaved);
      }
    } catch {
      // Rollback: un salvataggio non riuscito non resta a schermo come fatto.
      setIsSaved(!nextSaved);
      Alert.alert("Errore", "Impossibile aggiornare il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddComment() {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per commentare.");
      return;
    }

    const body = draft.trim();

    if (!body) {
      return;
    }

    setIsPosting(true);

    try {
      const comment =
        contentType === "media_profile"
          ? await addMediaProfilePostComment({
              body,
              postId,
              profileId: viewerProfileId,
            })
          : await addMediaTribunaComment({
              body,
              postId,
              profileId: viewerProfileId,
            });

      setComments((current) => [...current, comment]);
      setDraft("");
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error ? error.message : "Commento non pubblicato.",
      );
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <View style={styles.root} testID="media-content-interactions">
      <View style={styles.rail}>
        <Pressable
          accessibilityLabel={isSaved ? "Rimuovi dai salvati" : "Salva contenuto"}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving, selected: isSaved }}
          disabled={isSaving}
          hitSlop={8}
          onPress={() => {
            void handleToggleSave();
          }}
          style={({ pressed }) => [
            styles.railAction,
            pressed ? styles.pressed : null,
          ]}
          testID="media-content-save"
        >
          <Ionicons
            color={isSaved ? colors.accent : colors.textSecondary}
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={18}
          />
          <AppText color={isSaved ? "accent" : "secondary"} variant="actionLabel">
            {isSaved ? "Salvato" : "Salva"}
          </AppText>
        </Pressable>

        <View accessible accessibilityLabel={`${comments.length} commenti`} style={styles.railCount}>
          <Ionicons
            color={colors.textMuted}
            name="chatbubble-outline"
            size={16}
          />
          <AppText color="secondary" variant="caption">
            {comments.length}
          </AppText>
        </View>
      </View>

      {comments.length > 0 ? (
        <View style={styles.comments}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Avatar
                name={comment.author_name}
                size="sm"
                uri={comment.author_avatar_url ?? undefined}
              />
              <View style={styles.commentText}>
                <AppText numberOfLines={1} variant="titleSm">
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

      <View style={styles.composer}>
        <Input
          onChangeText={setDraft}
          placeholder="Scrivi un commento"
          style={styles.composerInput}
          value={draft}
        />
        <Button
          disabled={draft.trim().length === 0 || isPosting}
          label={isPosting ? "Invio…" : "Invia"}
          onPress={() => {
            void handleAddComment();
          }}
          size="sm"
          testID="media-content-comment-submit"
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  comment: {
    flexDirection: "row",
    gap: spacing[10],
  },
  commentText: {
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  comments: {
    gap: spacing[12],
  },
  composer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[8],
  },
  composerInput: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  rail: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    // Il rail azioni del design system: 44 px, hairline sopra, azioni a
    // sinistra.
    minHeight: 44,
  },
  railAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 44,
    paddingRight: spacing[8],
  },
  railCount: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  root: {
    gap: spacing[16],
  },
});
