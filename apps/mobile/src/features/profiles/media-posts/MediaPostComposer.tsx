import { type RefObject, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  type TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { colors, radius, spacing, typography } from "../../../styles";
import { AppText, Button, Input } from "../../../ui";
import { fetchLinkPreview, normalizeLinkUrl } from "../../../lib/link-preview";
import { CompactContentModule } from "../../content/components/CompactContentModule";
import { TaggableTargetPicker } from "../../content/components/TaggableTargetPicker";
import { type TaggableTarget, targetKey } from "../../content/tag-types";
import {
  calculateReadingTime,
  countWords,
  createMediaProfilePost,
  type MediaProfilePost,
  type MediaProfilePostDisplayMode,
  type MediaProfilePostSourceType,
  type MediaProfilePostTaggedTarget,
} from "../media-profile-post-service";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  clearDraft,
  type ComposerStep,
  isResumableDraft,
  loadDraft,
  type PersistedDraft,
  saveDraft,
} from "./media-post-draft";

type IoniconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES = ["Mercato", "Interviste", "Giovanili", "Opinioni"];
const AUTOSAVE_DEBOUNCE_MS = 600;

const MODE_OPTIONS: {
  description: string;
  icon: IoniconName;
  mode: MediaProfilePostSourceType;
  title: string;
}[] = [
  {
    description: "Crea e impagina l'articolo direttamente dentro l'app.",
    icon: "create-outline",
    mode: "platform",
    title: "Scrivi su piattaforma",
  },
  {
    description: "Collega un articolo già pubblicato sul tuo sito.",
    icon: "link-outline",
    mode: "link",
    title: "Importa da link",
  },
  {
    description: "Incolla un articolo già scritto altrove.",
    icon: "clipboard-outline",
    mode: "pasted",
    title: "Copia testo articolo",
  },
];

type ComposerProps = {
  defaultAuthorName: string;
  defaultCategory?: string;
  mediaProfileId: string;
  onClose: () => void;
  onCreated: (post: MediaProfilePost) => void;
  publisherName: string;
  userId: string | null;
  visible: boolean;
};

type DraftState = Omit<PersistedDraft, "savedAt" | "step">;

function createEmptyDraft(
  authorName: string,
  category: string,
): DraftState {
  return {
    authorName,
    body: "",
    category,
    coverType: null,
    coverUrl: "",
    displayMode: "full",
    externalUrl: "",
    mode: "platform",
    sourceName: "",
    subtitle: "",
    taggedTargets: [],
    title: "",
  };
}

export function MediaPostComposer({
  defaultAuthorName,
  defaultCategory = "Mercato",
  mediaProfileId,
  onClose,
  onCreated,
  publisherName,
  userId,
  visible,
}: ComposerProps) {
  const [step, setStep] = useState<ComposerStep>("mode");
  const [draft, setDraft] = useState<DraftState>(() =>
    createEmptyDraft(defaultAuthorName, defaultCategory),
  );
  const [selection, setSelection] = useState({ end: 0, start: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createdPost, setCreatedPost] = useState<MediaProfilePost | null>(null);
  const bodyRef = useRef<TextInput>(null);

  // Reset / restore on open.
  useEffect(() => {
    if (!visible) {
      return;
    }

    let active = true;
    setDraft(createEmptyDraft(defaultAuthorName, defaultCategory));
    setStep("mode");
    setCreatedPost(null);
    setIsSaving(false);
    setIsUploading(false);
    setIsFetchingPreview(false);

    void loadDraft(mediaProfileId).then((saved) => {
      if (active && isResumableDraft(saved)) {
        const { savedAt: _savedAt, step: savedStep, ...rest } = saved;
        setDraft(rest);
        setStep(savedStep);
      }
    });

    return () => {
      active = false;
    };
  }, [visible, mediaProfileId, defaultAuthorName, defaultCategory]);

  // Debounced autosave while editing (never persist the chooser or the
  // post-publish confirmation step).
  useEffect(() => {
    if (!visible || step === "mode" || step === ("published" as ComposerStep)) {
      return;
    }

    const timeout = setTimeout(() => {
      void saveDraft(mediaProfileId, {
        ...draft,
        savedAt: new Date().toISOString(),
        step,
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [draft, step, visible, mediaProfileId]);

  if (!visible) {
    return null;
  }

  function patch<Key extends keyof DraftState>(key: Key, value: DraftState[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function goBack() {
    setStep((current) => previousStep(current, draft));
    if (step === "mode") {
      onClose();
    }
  }

  function handleClose() {
    onClose();
  }

  function applyMarker(kind: "bold" | "quote" | "list") {
    setDraft((current) => {
      const value = current.body;
      const start = Math.min(selection.start, value.length);
      const end = Math.min(selection.end, value.length);
      const before = value.slice(0, start);
      const selected = value.slice(start, end);
      const after = value.slice(end);
      const needsBreak = before.length > 0 && !before.endsWith("\n");

      if (kind === "bold") {
        return { ...current, body: `${before}**${selected || "grassetto"}**${after}` };
      }

      const prefix = kind === "quote" ? "> " : "- ";
      return {
        ...current,
        body: `${before}${needsBreak ? "\n" : ""}${prefix}${selected}${after}`,
      };
    });
    bodyRef.current?.focus();
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
      if (upload) {
        patch("coverUrl", upload.url);
        patch("coverType", upload.type === "video" ? "video" : "image");
      }
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento copertina non riuscito.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleLoadPreview() {
    const url = normalizeLinkUrl(draft.externalUrl);
    if (!url) {
      Alert.alert("Link non valido", "Inserisci un URL valido dell'articolo.");
      return;
    }

    setIsFetchingPreview(true);
    try {
      const preview = await fetchLinkPreview(url);
      setDraft((current) => ({
        ...current,
        authorName: preview.author?.trim() || current.authorName,
        coverType: preview.imageUrl ? "image" : current.coverType,
        coverUrl: preview.imageUrl ?? current.coverUrl,
        externalUrl: url,
        sourceName: preview.siteName?.trim() || current.sourceName,
        subtitle: preview.description?.trim() || current.subtitle,
        title: preview.title?.trim() || current.title,
      }));
      setStep("setup");
    } catch {
      // Graceful fallback: let the user fill fields manually.
      setDraft((current) => ({ ...current, externalUrl: url }));
      setStep("setup");
    } finally {
      setIsFetchingPreview(false);
    }
  }

  async function handlePublish() {
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per pubblicare articoli.");
      return;
    }

    const needsBody = draft.mode !== "link" || draft.displayMode === "full";
    setIsSaving(true);
    try {
      const post = await createMediaProfilePost({
        authorName: draft.authorName,
        body: needsBody ? draft.body : null,
        category: draft.category,
        coverType: draft.coverType,
        coverUrl: draft.coverUrl || null,
        createdByProfileId: userId,
        displayMode: draft.displayMode,
        excerpt: draft.mode === "link" ? draft.subtitle || null : null,
        externalUrl: draft.externalUrl || null,
        kind: "article",
        mediaProfileId,
        publisherName,
        sourceName: draft.sourceName || null,
        sourceType: draft.mode,
        subtitle: draft.subtitle || null,
        taggedTargets: draft.taggedTargets.map(toTaggedTarget),
        title: draft.title,
      });

      await clearDraft(mediaProfileId);
      setCreatedPost(post);
      setStep("published" as ComposerStep);
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error ? error.message : "Pubblicazione non riuscita.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function finish(post: MediaProfilePost) {
    onCreated(post);
    onClose();
  }

  return (
    <Modal animationType="slide" onRequestClose={handleClose} visible>
      <SafeAreaView style={styles.root}>
        <StepHeader
          onBack={goBack}
          onClose={handleClose}
          title={stepTitle(step, draft)}
        />

        {step === "mode" ? (
          <ModeStep
            mode={draft.mode}
            onContinue={() =>
              setStep(draft.mode === "link" ? "linkUrl" : "setup")
            }
            onSelect={(mode) => patch("mode", mode)}
          />
        ) : null}

        {step === "linkUrl" ? (
          <LinkUrlStep
            isFetching={isFetchingPreview}
            onChange={(value) => patch("externalUrl", value)}
            onContinue={() => void handleLoadPreview()}
            value={draft.externalUrl}
          />
        ) : null}

        {step === "setup" ? (
          <SetupStep
            draft={draft}
            isUploading={isUploading}
            onContinue={() =>
              setStep(draft.mode === "link" ? "displayMode" : "editor")
            }
            onPatch={patch}
            onPickCover={() => void handlePickCover()}
          />
        ) : null}

        {step === "displayMode" ? (
          <DisplayModeStep
            onContinue={() =>
              setStep(draft.displayMode === "full" ? "editor" : "details")
            }
            onSelect={(mode) => patch("displayMode", mode)}
            value={draft.displayMode}
          />
        ) : null}

        {step === "editor" ? (
          <EditorStep
            bodyRef={bodyRef}
            onApplyMarker={applyMarker}
            onChangeBody={(value) => patch("body", value)}
            onContinue={() => setStep("preview")}
            onSelectionChange={setSelection}
            value={draft.body}
          />
        ) : null}

        {step === "preview" ? (
          <PreviewStep
            authorName={draft.authorName}
            body={draft.body}
            category={draft.category}
            coverUrl={draft.coverUrl}
            onContinue={() => setStep("details")}
            onEdit={() => setStep(draft.mode === "link" ? "setup" : "editor")}
            publisherName={publisherName}
            subtitle={draft.subtitle}
            title={draft.title}
          />
        ) : null}

        {step === "details" ? (
          <DetailsStep
            authorName={draft.authorName}
            coverUrl={draft.coverUrl}
            isSaving={isSaving}
            modeLabel={modeLabel(draft)}
            onChangeTags={(next) => patch("taggedTargets", next)}
            onPublish={() => void handlePublish()}
            publisherName={publisherName}
            taggedTargets={draft.taggedTargets}
            title={draft.title}
          />
        ) : null}

        {step === ("published" as ComposerStep) && createdPost ? (
          <PublishedStep
            modeLabel={modeLabel(draft)}
            onDone={() => finish(createdPost)}
            onView={() => finish(createdPost)}
            publisherName={publisherName}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function ModeStep({
  mode,
  onContinue,
  onSelect,
}: {
  mode: MediaProfilePostSourceType;
  onContinue: () => void;
  onSelect: (mode: MediaProfilePostSourceType) => void;
}) {
  return (
    <View style={styles.content}>
      <AppText color="secondary" style={styles.stepIntro} variant="bodyLg">
        Come vuoi pubblicare l'articolo?
      </AppText>
      <View style={styles.modeList}>
        {MODE_OPTIONS.map((option) => {
          const selected = mode === option.mode;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.mode}
              onPress={() => onSelect(option.mode)}
              style={[styles.modeCard, selected ? styles.modeCardActive : null]}
              testID={`media-composer-mode-${option.mode}`}
            >
              <View style={styles.modeIcon}>
                <Ionicons color={colors.accent} name={option.icon} size={22} />
              </View>
              <View style={styles.modeText}>
                <AppText variant="bodyLg">{option.title}</AppText>
                <AppText color="secondary" variant="bodySm">
                  {option.description}
                </AppText>
              </View>
              {selected ? (
                <Ionicons color={colors.accent} name="checkmark-circle" size={20} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Button label="Continua" onPress={onContinue} />
      </View>
    </View>
  );
}

function LinkUrlStep({
  isFetching,
  onChange,
  onContinue,
  value,
}: {
  isFetching: boolean;
  onChange: (value: string) => void;
  onContinue: () => void;
  value: string;
}) {
  return (
    <View style={styles.content}>
      <KeyboardAwareForm contentContainerStyle={styles.form}>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          label="Link articolo originale"
          onChangeText={onChange}
          placeholder="https://..."
          value={value}
        />
        <AppText color="secondary" variant="caption">
          Genereremo un'anteprima con titolo, immagine e fonte. Potrai
          modificarla prima di pubblicare.
        </AppText>
      </KeyboardAwareForm>
      <View style={styles.footer}>
        <Button
          disabled={isFetching}
          label={isFetching ? "Carico anteprima..." : "Carica anteprima"}
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

function SetupStep({
  draft,
  isUploading,
  onContinue,
  onPatch,
  onPickCover,
}: {
  draft: DraftState;
  isUploading: boolean;
  onContinue: () => void;
  onPatch: <Key extends keyof DraftState>(key: Key, value: DraftState[Key]) => void;
  onPickCover: () => void;
}) {
  const isPaste = draft.mode === "pasted";
  const sourceLabel = draft.sourceName
    ? `${draft.sourceName}${hostFromUrl(draft.externalUrl) ? ` • ${hostFromUrl(draft.externalUrl)}` : ""}`
    : null;

  return (
    <View style={styles.content}>
      <KeyboardAwareForm contentContainerStyle={styles.form}>
        {draft.mode === "link" && sourceLabel ? (
          <View style={styles.sourcePill}>
            <Ionicons color={colors.accent} name="link-outline" size={15} />
            <AppText color="secondary" numberOfLines={1} variant="caption">
              {sourceLabel}
            </AppText>
          </View>
        ) : null}

        <Input
          label="Titolo"
          onChangeText={(value) => onPatch("title", value)}
          placeholder="Inserisci il titolo..."
          value={draft.title}
        />

        <Input
          label={draft.mode === "link" ? "Sottotitolo / anteprima" : "Sottotitolo"}
          multiline
          onChangeText={(value) => onPatch("subtitle", value)}
          placeholder="Scrivi una breve introduzione..."
          value={draft.subtitle}
        />

        <Input
          label="Autore"
          onChangeText={(value) => onPatch("authorName", value)}
          placeholder="Nome autore..."
          value={draft.authorName}
        />

        {isPaste ? (
          <>
            <Input
              label="Fonte originale (opzionale)"
              onChangeText={(value) => onPatch("sourceName", value)}
              placeholder="Es. Gazzetta dello Sport"
              value={draft.sourceName}
            />
            <Input
              autoCapitalize="none"
              label="Link originale (opzionale)"
              onChangeText={(value) => onPatch("externalUrl", value)}
              placeholder="https://..."
              value={draft.externalUrl}
            />
          </>
        ) : null}

        <CategoryChips
          onChange={(value) => onPatch("category", value)}
          value={draft.category}
        />

        <MediaPickerField
          buttonLabel={draft.coverUrl ? "Sostituisci immagine" : "Carica immagine"}
          helperText="Immagine o video di apertura dell'articolo."
          isUploading={isUploading}
          label="Immagine di copertina"
          mediaType={draft.coverType ?? "image"}
          onPick={onPickCover}
          previewUrl={draft.coverUrl || null}
        />
      </KeyboardAwareForm>
      <View style={styles.footer}>
        <Button
          label={
            draft.mode === "link"
              ? "Continua"
              : draft.mode === "pasted"
                ? "Continua al testo"
                : "Continua alla scrittura"
          }
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

function DisplayModeStep({
  onContinue,
  onSelect,
  value,
}: {
  onContinue: () => void;
  onSelect: (mode: MediaProfilePostDisplayMode) => void;
  value: MediaProfilePostDisplayMode;
}) {
  const options: {
    description: string;
    icon: IoniconName;
    label: string;
    value: MediaProfilePostDisplayMode;
  }[] = [
    {
      description: "Mostra titolo, copertina e un link al sito originale.",
      icon: "open-outline",
      label: "Anteprima + link al sito originale",
      value: "preview",
    },
    {
      description: "Porta il testo completo dentro l'app, con fonte sempre visibile.",
      icon: "document-text-outline",
      label: "Articolo completo anche in app",
      value: "full",
    },
  ];

  return (
    <View style={styles.content}>
      <AppText color="secondary" style={styles.stepIntro} variant="bodyLg">
        Come vuoi mostrarlo nell'app?
      </AppText>
      <View style={styles.modeList}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[styles.modeCard, selected ? styles.modeCardActive : null]}
            >
              <View style={styles.modeIcon}>
                <Ionicons color={colors.accent} name={option.icon} size={22} />
              </View>
              <View style={styles.modeText}>
                <AppText variant="bodyLg">{option.label}</AppText>
                <AppText color="secondary" variant="bodySm">
                  {option.description}
                </AppText>
              </View>
              {selected ? (
                <Ionicons color={colors.accent} name="checkmark-circle" size={20} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Button label="Continua" onPress={onContinue} />
      </View>
    </View>
  );
}

function EditorStep({
  bodyRef,
  onApplyMarker,
  onChangeBody,
  onContinue,
  onSelectionChange,
  value,
}: {
  bodyRef: RefObject<TextInput | null>;
  onApplyMarker: (kind: "bold" | "quote" | "list") => void;
  onChangeBody: (value: string) => void;
  onContinue: () => void;
  onSelectionChange: (selection: { end: number; start: number }) => void;
  value: string;
}) {
  const words = countWords(value);
  const minutes = calculateReadingTime(value);

  return (
    <View style={styles.content}>
      <View style={styles.autosaveRow}>
        <Ionicons color={colors.success} name="cloud-done-outline" size={14} />
        <AppText color="secondary" variant="caption">
          Salvato automaticamente
        </AppText>
      </View>
      <MarkdownToolbar onApply={onApplyMarker} />
      <KeyboardAwareForm contentContainerStyle={styles.form}>
        <Input
          multiline
          onChangeText={onChangeBody}
          onSelectionChange={(event) =>
            onSelectionChange(event.nativeEvent.selection)
          }
          placeholder="Scrivi il contenuto dell'articolo..."
          ref={bodyRef}
          style={styles.bodyInput}
          value={value}
        />
      </KeyboardAwareForm>
      <View style={styles.footer}>
        <AppText align="center" color="muted" style={styles.counter} variant="caption">
          {words} parole • {minutes} min di lettura
        </AppText>
        <Button label="Anteprima" onPress={onContinue} />
      </View>
    </View>
  );
}

function PreviewStep({
  authorName,
  body,
  category,
  coverUrl,
  onContinue,
  onEdit,
  publisherName,
  subtitle,
  title,
}: {
  authorName: string;
  body: string;
  category: string;
  coverUrl: string;
  onContinue: () => void;
  onEdit: () => void;
  publisherName: string;
  subtitle: string;
  title: string;
}) {
  const minutes = calculateReadingTime(body);
  const paragraphs = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <View style={styles.content}>
      <KeyboardAwareForm contentContainerStyle={styles.form}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.previewCover} />
        ) : null}
        <View style={styles.previewTypeRow}>
          <AppText color="accent" style={styles.previewType} variant="overline">
            ARTICOLO
          </AppText>
          <AppText color="secondary" variant="overline">
            {category}
          </AppText>
        </View>
        <AppText style={styles.previewTitle} variant="headingLg">
          {title || "Senza titolo"}
        </AppText>
        {subtitle ? (
          <AppText color="secondary" variant="bodyLg">
            {subtitle}
          </AppText>
        ) : null}
        <AppText color="secondary" variant="bodySm">
          {publisherName}
        </AppText>
        <AppText color="secondary" variant="caption">
          di {authorName} • Oggi • {minutes} min
        </AppText>
        <View style={styles.previewBody}>
          {paragraphs.map((paragraph, index) => {
            const isQuote = paragraph.startsWith(">");
            return (
              <AppText
                color={isQuote ? "primary" : "secondary"}
                key={`${index}-${paragraph.slice(0, 12)}`}
                style={isQuote ? styles.previewQuote : undefined}
                variant="bodyLg"
              >
                {isQuote ? paragraph.replace(/^>\s*/, "") : paragraph}
              </AppText>
            );
          })}
        </View>
      </KeyboardAwareForm>
      <View style={styles.footerRow}>
        <Button label="Modifica testo" onPress={onEdit} style={styles.flex1} variant="secondary" />
        <Button label="Continua ai tag" onPress={onContinue} style={styles.flex1} />
      </View>
    </View>
  );
}

function DetailsStep({
  authorName,
  coverUrl,
  isSaving,
  modeLabel: label,
  onChangeTags,
  onPublish,
  publisherName,
  taggedTargets,
  title,
}: {
  authorName: string;
  coverUrl: string;
  isSaving: boolean;
  modeLabel: string;
  onChangeTags: (next: TaggableTarget[]) => void;
  onPublish: () => void;
  publisherName: string;
  taggedTargets: TaggableTarget[];
  title: string;
}) {
  return (
    <View style={styles.content}>
      <KeyboardAwareForm contentContainerStyle={styles.form}>
        <View style={styles.summaryCard}>
          <CompactContentModule
            taggedAvatars={taggedTargets.map((target) => ({
              avatarUrl: target.avatar_url,
              id: targetKey(target),
              name: target.display_name,
            }))}
            thumbnailUrl={coverUrl || null}
            title={title || "Senza titolo"}
            typeLabel={label}
          />
          <AppText color="secondary" variant="caption">
            di {authorName} • {publisherName}
          </AppText>
        </View>

        <TaggableTargetPicker
          label="Profili taggati"
          onChange={onChangeTags}
          placeholder="Cerca un profilo, una società o una squadra"
          value={taggedTargets}
        />
        <AppText color="muted" variant="caption">
          I profili taggati riceveranno una notifica e il contenuto comparirà
          nella loro sezione Media.
        </AppText>
      </KeyboardAwareForm>
      <View style={styles.footer}>
        <Button
          disabled={isSaving}
          label={isSaving ? "Pubblicazione..." : "Pubblica"}
          onPress={onPublish}
          testID="media-composer-publish-button"
        />
      </View>
    </View>
  );
}

function PublishedStep({
  modeLabel: label,
  onDone,
  onView,
  publisherName,
}: {
  modeLabel: string;
  onDone: () => void;
  onView: () => void;
  publisherName: string;
}) {
  return (
    <View style={styles.content}>
      <View style={styles.publishedBody}>
        <View style={styles.publishedIcon}>
          <Ionicons color={colors.success} name="checkmark-circle" size={56} />
        </View>
        <AppText align="center" variant="headingMd">
          Contenuto pubblicato
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          Pubblicato da: {publisherName}
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          Modalità: {label}
        </AppText>
      </View>
      <View style={styles.footerRow}>
        <Button
          label="Torna ai Contenuti"
          onPress={onDone}
          style={styles.flex1}
          variant="secondary"
        />
        <Button label="Vedi contenuto" onPress={onView} style={styles.flex1} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StepHeader({
  onBack,
  onClose,
  title,
}: {
  onBack: () => void;
  onClose: () => void;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.headerButton}
      >
        <Ionicons color={colors.textPrimary} name="chevron-back" size={23} />
      </Pressable>
      <AppText numberOfLines={1} style={styles.headerTitle} variant="titleSm">
        {title}
      </AppText>
      <Pressable
        accessibilityLabel="Chiudi"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.headerButton}
      >
        <Ionicons color={colors.textPrimary} name="close" size={22} />
      </Pressable>
    </View>
  );
}

function MarkdownToolbar({
  onApply,
}: {
  onApply: (kind: "bold" | "quote" | "list") => void;
}) {
  const items: { icon: IoniconName; kind: "bold" | "quote" | "list"; label: string }[] = [
    { icon: "text", kind: "bold", label: "Grassetto" },
    { icon: "chatbox-ellipses-outline", kind: "quote", label: "Citazione" },
    { icon: "list-outline", kind: "list", label: "Elenco" },
  ];

  return (
    <View style={styles.toolbar}>
      {items.map((item) => (
        <Pressable
          accessibilityLabel={item.label}
          accessibilityRole="button"
          key={item.kind}
          onPress={() => onApply(item.kind)}
          style={styles.toolbarButton}
        >
          <Ionicons color={colors.textSecondary} name={item.icon} size={18} />
        </Pressable>
      ))}
    </View>
  );
}

function CategoryChips({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.categoryBlock}>
      <AppText color="muted" style={styles.categoryLabel} variant="caption">
        Categoria
      </AppText>
      <View style={styles.categoryOptions}>
        {CATEGORIES.map((category) => {
          const selected = value === category;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={category}
              onPress={() => onChange(category)}
              style={[
                styles.categoryChip,
                selected ? styles.categoryChipActive : null,
              ]}
            >
              <AppText
                color={selected ? "inverse" : "secondary"}
                variant="caption"
              >
                {category}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTaggedTarget(target: TaggableTarget): MediaProfilePostTaggedTarget {
  return {
    avatar_url: target.avatar_url,
    display_name: target.display_name,
    role: target.role_label ?? null,
    subtitle: target.subtitle ?? null,
    target_id: target.target_id,
    target_type: target.target_type,
  };
}

function previousStep(step: ComposerStep, draft: DraftState): ComposerStep {
  switch (step) {
    case "linkUrl":
      return "mode";
    case "setup":
      return draft.mode === "link" ? "linkUrl" : "mode";
    case "displayMode":
      return "setup";
    case "editor":
      return draft.mode === "link" ? "displayMode" : "setup";
    case "preview":
      return draft.mode === "link" && draft.displayMode === "preview"
        ? "displayMode"
        : "editor";
    case "details":
      // The link preview-only flow skips the editor and the preview step,
      // so Back must return to the display-mode choice, not an unseen preview.
      return draft.mode === "link" && draft.displayMode === "preview"
        ? "displayMode"
        : "preview";
    default:
      return "mode";
  }
}

function stepTitle(step: ComposerStep, draft: DraftState): string {
  switch (step) {
    case "mode":
      return "Nuovo articolo";
    case "linkUrl":
      return "Importa articolo";
    case "setup":
      return draft.mode === "link"
        ? "Anteprima articolo"
        : draft.mode === "pasted"
          ? "Incolla articolo"
          : "Nuovo articolo";
    case "displayMode":
      return "Modalità visualizzazione";
    case "editor":
      return draft.mode === "pasted" ? "Testo articolo" : "Scrivi articolo";
    case "preview":
      return "Anteprima articolo";
    case "details":
      return "Dettagli finali";
    default:
      return "Completato";
  }
}

function modeLabel(draft: DraftState): string {
  if (draft.mode === "link") {
    return draft.displayMode === "preview"
      ? "Anteprima + link esterno"
      : "Articolo completo (da link)";
  }

  return draft.mode === "pasted" ? "Testo incollato" : "Scritto su piattaforma";
}

function hostFromUrl(url: string): string | null {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1].replace(/^www\./i, "") : null;
}

const styles = StyleSheet.create({
  autosaveRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
  },
  bodyInput: {
    minHeight: 280,
    textAlignVertical: "top",
  },
  categoryBlock: {
    gap: spacing[8],
  },
  categoryChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryLabel: {
    marginBottom: spacing[4],
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  content: {
    flex: 1,
  },
  counter: {
    marginBottom: spacing[8],
  },
  flex1: {
    flex: 1,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[16],
  },
  footerRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  form: {
    gap: spacing[16],
    padding: spacing[16],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing[8],
  },
  headerButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },
  modeCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  modeCardActive: {
    borderColor: colors.accent,
  },
  modeIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  modeList: {
    gap: spacing[12],
    paddingHorizontal: spacing[16],
  },
  modeText: {
    flex: 1,
    gap: spacing[4],
  },
  previewBody: {
    gap: spacing[12],
    marginTop: spacing[8],
  },
  previewCover: {
    borderRadius: radius[12],
    height: 180,
    width: "100%",
  },
  previewQuote: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    fontStyle: "italic",
    paddingLeft: spacing[12],
  },
  previewTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  previewType: {
    letterSpacing: 0.5,
  },
  previewTypeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  publishedBody: {
    alignItems: "center",
    flex: 1,
    gap: spacing[8],
    justifyContent: "center",
    padding: spacing[24],
  },
  publishedIcon: {
    marginBottom: spacing[8],
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sourcePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  stepIntro: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[16],
  },
  toolbar: {
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  toolbarButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 40,
  },
});
