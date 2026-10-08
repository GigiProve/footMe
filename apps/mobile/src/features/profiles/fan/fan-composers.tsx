/**
 * Composer dei contenuti del Tifoso (REV-PROF-19 §"Composer esistenti").
 *
 * Nessun editor nuovo: sono gli stessi quattro composer già in produzione —
 * opinione, sondaggio, formazione, foto/video — più la gestione della squadra
 * del cuore, spostati qui perché il Master Profile li apre dal bottom sheet
 * "Crea" invece di contenerli. Modelli, validazioni, upload, salvataggio e
 * notifica dei tag restano quelli esistenti.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { VideoPreview } from "../../../components/ui/video-preview";
import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar, Button, Input } from "../../../ui";
import { TaggableTargetPicker } from "../../content/components/TaggableTargetPicker";
import { searchTagTargets } from "../../content/content-tag-service";
import { targetKey, type TaggableTarget } from "../../content/tag-types";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  searchTeams,
  searchAgentPlayerCandidates,
  type AgentPlayerCandidate,
} from "../profile-service";
import { TeamAutocompleteInput } from "../player-sports-section";
import {
  createFanTribunaFormation,
  createFanTribunaOpinion,
  createFanTribunaPhoto,
  createFanTribunaPoll,
  createFanTribunaProposal,
  FAN_TRIBUNA_FORMATIONS,
  type FanTribunaFormation,
  type FanTribunaKind,
  type FanTribunaLineupPlayer,
  type FanTribunaMediaType,
  type FanTribunaPost,
  type FanTribunaTaggedPlayer,
} from "../fan-tribuna-service";
import {
  FootballPitchPreview,
  getFormationSlots,
} from "./FootballPitchPreview";

const TRIBUNA_TEXT_LIMIT = 480;
const MAX_FAN_CONTENT_TAGS = 5;

/** Titoli delle modali per tipo di contenuto. */
const TRIBUNA_MODAL_TITLES: Record<FanTribunaKind, string> = {
  formation: "Nuova formazione",
  opinion: "Nuova opinione",
  photo: "Nuovo contenuto",
  poll: "Nuovo sondaggio",
  proposal: "Nuova proposta",
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

type DraftOpinionState = {
  body: string;
  targets: TaggableTarget[];
};

const emptyOpinionDraft: DraftOpinionState = {
  body: "",
  targets: [],
};

type DraftPhotoState = {
  caption: string;
  isUploading: boolean;
  mediaType: FanTribunaMediaType | null;
  mediaUrl: string;
  targets: TaggableTarget[];
  thumbnailUrl: string | null;
};

const emptyPhotoDraft: DraftPhotoState = {
  caption: "",
  isUploading: false,
  mediaType: null,
  mediaUrl: "",
  targets: [],
  thumbnailUrl: null,
};

type DraftPollOption = {
  label: string;
  target: TaggableTarget | null;
};

const emptyPollOptions: DraftPollOption[] = [
  { label: "", target: null },
  { label: "", target: null },
];

export function FanCreateTribunaModal({
  kind,
  onClose,
  onCreated,
  profileId,
  publisherName,
  userId,
  visible,
}: {
  kind: FanTribunaKind | null;
  onClose: () => void;
  onCreated: (post: FanTribunaPost) => void;
  profileId: string;
  publisherName: string | null;
  userId: string;
  visible: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<DraftPollOption[]>(emptyPollOptions);
  const [opinionDraft, setOpinionDraft] = useState<DraftOpinionState>(emptyOpinionDraft);
  const [photoDraft, setPhotoDraft] = useState<DraftPhotoState>(emptyPhotoDraft);
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
      setPollOptions(emptyPollOptions);
      setOpinionDraft(emptyOpinionDraft);
      setPhotoDraft(emptyPhotoDraft);
      setProposalDraft(emptyProposalDraft);
      setFormationDraft(emptyFormationDraft);
      setIsSaving(false);
    }
  }, [visible]);

  async function handlePickPhotoMedia() {
    setPhotoDraft((current) => ({ ...current, isUploading: true }));

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "fan-tribuna",
        mediaTypes: ["images", "videos"],
        userId,
      });
      const upload = uploads[0];

      if (!upload) {
        setPhotoDraft((current) => ({ ...current, isUploading: false }));
        return;
      }

      const mediaType: FanTribunaMediaType = upload.type === "video" ? "video" : "image";
      setPhotoDraft((current) => ({
        ...current,
        isUploading: false,
        mediaType,
        mediaUrl: upload.url,
        thumbnailUrl: mediaType === "image" ? upload.url : null,
      }));
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento media non riuscito.";
      setPhotoDraft((current) => ({ ...current, isUploading: false }));
      Alert.alert("Errore", message);
    }
  }

  async function handleSave() {
    if (!kind) {
      return;
    }

    setIsSaving(true);

    try {
      let post: FanTribunaPost;

      if (kind === "poll") {
        post = await createFanTribunaPoll({
          options: pollOptions.map((option) => ({
            label: option.label,
            target: option.target,
          })),
          profileId,
          publisherName,
          question,
        });
      } else if (kind === "opinion") {
        post = await createFanTribunaOpinion({
          body: opinionDraft.body,
          profileId,
          publisherName,
          targets: opinionDraft.targets,
        });
      } else if (kind === "photo") {
        post = await createFanTribunaPhoto({
          caption: photoDraft.caption,
          mediaType: photoDraft.mediaType ?? "image",
          mediaUrl: photoDraft.mediaUrl,
          profileId,
          publisherName,
          targets: photoDraft.targets,
          thumbnailUrl: photoDraft.thumbnailUrl,
        });
      } else if (kind === "proposal") {
        post = await createFanTribunaProposal({
          body: proposalDraft.body,
          profileId,
          publisherName,
          referenceCategory: proposalDraft.referenceCategory,
          referenceClubId: proposalDraft.referenceClubId,
          referenceTeamName: proposalDraft.referenceTeamName,
          taggedPlayers: proposalDraft.taggedPlayers,
          title: proposalDraft.title,
        });
      } else {
        post = await createFanTribunaFormation({
          body: formationDraft.body,
          formation: formationDraft.formation,
          lineupPlayers: formationDraft.lineupPlayers,
          profileId,
          referenceCategory: formationDraft.referenceCategory,
          referenceClubId: formationDraft.referenceClubId,
          referenceTeamName: formationDraft.referenceTeamName,
          title: formationDraft.title,
        });
      }

      onCreated(post);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pubblicazione non riuscita.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  const title = kind ? TRIBUNA_MODAL_TITLES[kind] : "";
  const canPublish =
    kind === "poll"
      ? question.trim().length > 0 &&
        pollOptions.filter((option) => option.label.trim()).length >= 2
      : kind === "opinion"
        ? opinionDraft.body.trim().length > 0
        : kind === "photo"
          ? photoDraft.mediaUrl.trim().length > 0 && !photoDraft.isUploading
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
              {pollOptions.map((option, index) => (
                <View key={`poll-option-${index}`} style={styles.pollOptionEditor}>
                  <Input
                    label={`Opzione ${index + 1}`}
                    onChangeText={(value) =>
                      setPollOptions((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, label: value } : entry,
                        ),
                      )
                    }
                    placeholder={index === 0 ? "Si" : index === 1 ? "No" : "Altra opzione"}
                    value={option.label}
                  />
                  <PollOptionProfileLink
                    onChange={(target) =>
                      setPollOptions((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, target } : entry,
                        ),
                      )
                    }
                    value={option.target}
                  />
                </View>
              ))}
              {pollOptions.length < 6 ? (
                <Button
                  label="Aggiungi opzione"
                  onPress={() =>
                    setPollOptions((current) => [...current, { label: "", target: null }])
                  }
                  variant="outline"
                />
              ) : null}
              <AppText color="secondary" variant="caption">
                I profili collegati alle opzioni vengono taggati nel contenuto.
              </AppText>
            </>
          ) : kind === "opinion" ? (
            <>
              <Input
                helperText={`${opinionDraft.body.length}/${TRIBUNA_TEXT_LIMIT}`}
                label="La tua opinione"
                maxLength={TRIBUNA_TEXT_LIMIT}
                multiline
                onChangeText={(value) =>
                  setOpinionDraft((current) => ({ ...current, body: value }))
                }
                placeholder="Secondo me servirebbe un attaccante rapido per completare la rosa..."
                value={opinionDraft.body}
              />
              <TaggableTargetPicker
                label="Tagga profili (opzionale)"
                max={MAX_FAN_CONTENT_TAGS}
                onChange={(targets) =>
                  setOpinionDraft((current) => ({ ...current, targets }))
                }
                value={opinionDraft.targets}
              />
            </>
          ) : kind === "photo" ? (
            <>
              <Pressable
                accessibilityLabel="Scegli foto o video"
                accessibilityRole="button"
                disabled={photoDraft.isUploading}
                onPress={() => {
                  void handlePickPhotoMedia();
                }}
                style={({ pressed }) => [
                  styles.createMedia,
                  pressed ? styles.pressed : null,
                ]}
              >
                {photoDraft.mediaUrl && photoDraft.mediaType === "image" ? (
                  <Image source={{ uri: photoDraft.mediaUrl }} style={styles.createMediaImage} />
                ) : photoDraft.mediaUrl ? (
                  <View style={styles.createVideoPreview}>
                    <VideoPreview style={styles.createMediaImage} url={photoDraft.mediaUrl} />
                    <View style={styles.createVideoOverlay}>
                      <Ionicons color={colors.inkInvert} name="play" size={26} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.createPlaceholder}>
                    {photoDraft.isUploading ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <>
                        <Ionicons color={colors.accent} name="image-outline" size={32} />
                        <AppText
                          color="accent"
                          style={styles.createPlaceholderText}
                          variant="bodySm"
                        >
                          Scegli foto o video
                        </AppText>
                      </>
                    )}
                  </View>
                )}
              </Pressable>
              <Input
                helperText={`${photoDraft.caption.length}/${TRIBUNA_TEXT_LIMIT}`}
                label="Didascalia (opzionale)"
                maxLength={TRIBUNA_TEXT_LIMIT}
                multiline
                onChangeText={(value) =>
                  setPhotoDraft((current) => ({ ...current, caption: value }))
                }
                placeholder="Aggiungi una didascalia..."
                value={photoDraft.caption}
              />
              <TaggableTargetPicker
                label="Tagga profili (opzionale)"
                max={MAX_FAN_CONTENT_TAGS}
                onChange={(targets) =>
                  setPhotoDraft((current) => ({ ...current, targets }))
                }
                value={photoDraft.targets}
              />
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

function PollOptionProfileLink({
  onChange,
  value,
}: {
  onChange: (target: TaggableTarget | null) => void;
  value: TaggableTarget | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TaggableTarget[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (query.trim().length < 2) {
          setSuggestions([]);
          return;
        }

        try {
          const results = await searchTagTargets(query.trim());
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
  }, [isOpen, query]);

  if (value) {
    return (
      <View style={styles.pollOptionLinkChip}>
        <Avatar
          name={value.display_name}
          size="sm"
          square={value.target_type !== "profile"}
          uri={value.avatar_url}
        />
        <AppText numberOfLines={1} style={styles.pollOptionLinkName} variant="caption">
          {value.display_name}
        </AppText>
        <Pressable
          accessibilityLabel={`Rimuovi collegamento ${value.display_name}`}
          hitSlop={8}
          onPress={() => onChange(null)}
        >
          <Ionicons color={colors.accent} name="close" size={16} />
        </Pressable>
      </View>
    );
  }

  if (!isOpen) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={styles.pollOptionLinkButton}
      >
        <Ionicons color={colors.accent} name="link-outline" size={14} />
        <AppText color="accent" variant="caption">
          Collega profilo
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.pollOptionLinkSearch}>
      <Input
        onChangeText={setQuery}
        placeholder="Cerca un profilo da collegare"
        value={query}
      />
      {suggestions.length > 0 ? (
        <View style={styles.pollOptionSuggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              accessibilityRole="button"
              key={targetKey(suggestion)}
              onPress={() => {
                onChange(suggestion);
                setIsOpen(false);
                setQuery("");
                setSuggestions([]);
              }}
              style={styles.pollOptionSuggestionRow}
            >
              <Avatar
                name={suggestion.display_name}
                size="sm"
                square={suggestion.target_type !== "profile"}
                uri={suggestion.avatar_url}
              />
              <AppText numberOfLines={1} variant="bodySm">
                {suggestion.display_name}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
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
          accessibilityLabel={`Rimuovi ${player.display_name}`}
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

function formatCandidateLine(candidate: AgentPlayerCandidate) {
  return [
    candidate.category_label,
    candidate.region,
    candidate.is_free_agent ? "Svincolato" : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

const styles = StyleSheet.create({
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
  createForm: {
    gap: spacing[20],
    padding: spacing[16],
  },
  pollOptionEditor: {
    gap: spacing[8],
  },
  pollOptionLinkButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
    paddingVertical: spacing[4],
  },
  pollOptionLinkChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  pollOptionLinkName: {
    maxWidth: 160,
  },
  pollOptionLinkSearch: {
    gap: spacing[8],
  },
  pollOptionSuggestionRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  pollOptionSuggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    overflow: "hidden",
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
  lineupBuilder: {
    gap: spacing[12],
  },
  playerPicker: {
    gap: spacing[12],
  },
  pressed: {
    opacity: 0.82,
  },
  publishText: {
    fontWeight: typography.fontWeight.bold,
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
});
