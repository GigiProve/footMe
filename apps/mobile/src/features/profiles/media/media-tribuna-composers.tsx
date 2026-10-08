/**
 * Composer della Tribuna editoriale (REV-PROF-21, "Azioni Tribuna").
 *
 * Sono i composer che esistevano già dentro il vecchio profilo Media da 4.000
 * righe: REV-PROF-21 non li ridisegna e non ne crea di nuovi, li sposta in un
 * file loro perché la vista del Master Profile resti una vista. I quattro
 * content type sono quelli approvati — sondaggio editoriale, dibattito da
 * articolo, vota il migliore, Q&A — e la selezione passa dal bottom sheet
 * condiviso invece che da un menu disegnato a mano.
 */
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { colors, radius, spacing } from "../../../theme/tokens";
import { ActionSheet, AppText, Avatar, Button, Input, ModalHeader } from "../../../ui";
import {
  searchMediaProfilePostTargets,
  type MediaProfilePost,
} from "../media-profile-post-service";
import {
  createMediaArticleDebate,
  createMediaCommunityQa,
  createMediaPlayerVote,
  createMediaTribunaPoll,
  type MediaTribunaKind,
  type MediaTribunaPlayerOptionInput,
  type MediaTribunaPost,
} from "../media-tribuna-service";

const SEARCH_DEBOUNCE_MS = 250;
const MAX_POLL_OPTIONS = 6;

const TRIBUNA_CREATE_OPTIONS: readonly {
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

/** Bottom sheet condiviso: la scelta del tipo non è una schermata. */
export function MediaTribunaCreateSheet({
  onClose,
  onSelect,
  visible,
}: {
  onClose: () => void;
  onSelect: (kind: MediaTribunaKind) => void;
  visible: boolean;
}) {
  return (
    <ActionSheet
      actions={TRIBUNA_CREATE_OPTIONS.map((option) => ({
        icon: option.icon,
        label: option.title,
        onPress: () => onSelect(option.kind),
        subtitle: option.description,
      }))}
      onClose={onClose}
      title="Crea contenuto Tribuna"
      visible={visible}
    />
  );
}

export type MediaTribunaComposerModalProps = {
  /** Articoli pubblicati, per il dibattito collegato. */
  articles: readonly MediaProfilePost[];
  kind: MediaTribunaKind | null;
  mediaProfileId: string;
  onClose: () => void;
  onCreated: (post: MediaTribunaPost) => void;
  userId: string | null;
  visible: boolean;
};

export function MediaTribunaComposerModal({
  articles,
  kind,
  mediaProfileId,
  onClose,
  onCreated,
  userId,
  visible,
}: MediaTribunaComposerModalProps) {
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
      ? title.trim().length > 0 &&
        options.filter((option) => option.trim()).length >= 2
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
      <SafeAreaView style={styles.root}>
        <ModalHeader onClose={onClose} title={getComposerTitle(kind)} />

        <KeyboardAwareForm contentContainerStyle={styles.content}>
          {kind === "article_debate" ? (
            <View style={styles.block}>
              <AppText color="secondary" variant="caption">
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
                        styles.articleRow,
                        isSelected ? styles.articleRowActive : null,
                      ]}
                      testID={`media-tribuna-article-select-${article.id}`}
                    >
                      <AppText
                        numberOfLines={2}
                        style={styles.articleTitle}
                        variant="bodySm"
                      >
                        {article.title}
                      </AppText>
                      {isSelected ? (
                        <Ionicons
                          color={colors.accent}
                          name="checkmark"
                          size={18}
                        />
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
            label={
              kind === "community_qa" || kind === "player_vote"
                ? "Titolo"
                : "Domanda"
            }
            onChangeText={setTitle}
            placeholder={getTitlePlaceholder(kind)}
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
                  placeholder="Scrivi un'opzione"
                  value={option}
                />
              ))}
              {options.length < MAX_POLL_OPTIONS ? (
                <Button
                  label="Aggiungi opzione"
                  onPress={() => setOptions((current) => [...current, ""])}
                  variant="outline"
                />
              ) : null}
            </>
          ) : null}

          {kind === "player_vote" ? (
            <View style={styles.block}>
              <Input
                label="Giocatori votabili"
                onChangeText={setPlayerQuery}
                placeholder="Cerca giocatore…"
                value={playerQuery}
              />
              {selectedPlayers.length > 0 ? (
                <View style={styles.chipRow}>
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
                      style={styles.playerChip}
                    >
                      <Avatar
                        name={player.displayName}
                        size="sm"
                        uri={player.avatarUrl ?? undefined}
                      />
                      <AppText
                        numberOfLines={1}
                        style={styles.playerChipText}
                        variant="caption"
                      >
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
                        uri={player.avatarUrl ?? undefined}
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
              label={
                kind === "community_qa" ? "Descrizione breve" : "Contesto breve"
              }
              multiline
              onChangeText={setBody}
              placeholder={getBodyPlaceholder(kind)}
              value={body}
            />
          ) : null}
        </KeyboardAwareForm>

        <View style={styles.footer}>
          <Button
            disabled={!canPublish || isSaving}
            label={isSaving ? "Pubblicazione…" : "Pubblica"}
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

function getComposerTitle(kind: MediaTribunaKind) {
  switch (kind) {
    case "editorial_poll":
      return "Sondaggio editoriale";
    case "article_debate":
      return "Dibattito da articolo";
    case "player_vote":
      return "Vota il migliore";
    default:
      return "Q&A community";
  }
}

function getTitlePlaceholder(kind: MediaTribunaKind) {
  switch (kind) {
    case "editorial_poll":
      return "Chi vincerà il campionato?";
    case "article_debate":
      return "Quanto conta davvero il settore giovanile?";
    case "player_vote":
      return "Il migliore in campo";
    default:
      return "Le domande della community";
  }
}

function getBodyPlaceholder(kind: MediaTribunaKind) {
  switch (kind) {
    case "article_debate":
      return "Aggiungi il contesto della discussione";
    case "player_vote":
      return "Racconta la partita in due righe";
    default:
      return "Spiega di che cosa si parla";
  }
}

const styles = StyleSheet.create({
  articleRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 44,
    paddingHorizontal: spacing[12],
  },
  articleRowActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  articleTitle: {
    flexShrink: 1,
    minWidth: 0,
  },
  block: {
    gap: spacing[8],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  content: {
    gap: spacing[16],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  playerChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  playerChipText: {
    flexShrink: 1,
    maxWidth: 140,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 48,
    paddingHorizontal: spacing[12],
  },
  suggestionText: {
    flexShrink: 1,
    minWidth: 0,
  },
  suggestions: {
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
  },
});
