/**
 * Pubblicazione di un contenuto Media della redazione (REV-PROF-21,
 * "Azioni Media owner").
 *
 * La CTA della tab Media non deve creare un articolo: apre questo composer,
 * che pubblica una foto o un video sulla stessa tabella dei contenuti Media
 * con `kind = 'media'`. Riusa l'uploader condiviso (`pickAndUploadMedia`) e
 * il servizio di pubblicazione che esisteva già: nessun upload duplicato,
 * nessun bucket nuovo, nessun redesign del composer editoriale — quello
 * appartiene a HOM-06.2 e resta dov'è.
 *
 * Una didascalia obbligatoria perché è anche il nome accessibile della
 * thumbnail nella griglia: una cella senza nome non è leggibile da uno
 * screen reader.
 */
import { useEffect, useState } from "react";
import { Alert, Modal, SafeAreaView, StyleSheet, View } from "react-native";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, Input, ModalHeader } from "../../../ui";
import {
  createMediaProfilePost,
  type MediaProfilePost,
} from "../media-profile-post-service";
import {
  ProfileMediaUploadError,
  pickAndUploadMedia,
} from "../media-upload-service";

/**
 * La categoria è obbligatoria sulla tabella: un contenuto Media non ha una
 * categoria editoriale, quindi ne porta una tecnica che la tab Articoli non
 * legge e che la RPC dei filtri esclude per costruzione.
 */
const MEDIA_CONTENT_CATEGORY = "Media";

export type MediaContentComposerProps = {
  /** Firma del contenuto: la realtà editoriale, non il proprietario. */
  entityName: string;
  mediaProfileId: string;
  onClose: () => void;
  onCreated: (post: MediaProfilePost) => void;
  userId: string | null;
  visible: boolean;
};

export function MediaContentComposer({
  entityName,
  mediaProfileId,
  onClose,
  onCreated,
  userId,
  visible,
}: MediaContentComposerProps) {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCaption("");
      setMediaUrl(null);
      setMediaType("image");
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  async function handlePickMedia() {
    if (!userId) {
      Alert.alert("Accesso richiesto", "Accedi per pubblicare contenuti.");
      return;
    }

    setIsUploading(true);

    try {
      const uploads = await pickAndUploadMedia({
        folder: "media-profile-content",
        mediaTypes: ["images", "videos"],
        userId,
      });
      const upload = uploads[0];

      if (!upload) {
        return;
      }

      setMediaUrl(upload.url);
      setMediaType(upload.type === "video" ? "video" : "image");
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento del contenuto non riuscito.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePublish() {
    if (!userId || !mediaUrl) {
      return;
    }

    setIsSaving(true);

    try {
      const post = await createMediaProfilePost({
        authorName: entityName,
        category: MEDIA_CONTENT_CATEGORY,
        coverType: mediaType,
        coverUrl: mediaUrl,
        createdByProfileId: userId,
        kind: "media",
        mediaProfileId,
        publisherName: entityName,
        title: caption.trim(),
      });

      onCreated(post);
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error
          ? error.message
          : "Pubblicazione del contenuto non riuscita.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const canPublish = Boolean(mediaUrl) && caption.trim().length > 0 && !isSaving;

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.root}>
        <ModalHeader onClose={onClose} title="Aggiungi contenuto" />

        <KeyboardAwareForm contentContainerStyle={styles.content}>
          <AppText color="secondary" variant="bodySm">
            Foto e video della redazione. Compaiono nella tab Media del
            profilo.
          </AppText>

          <MediaPickerField
            buttonLabel={mediaUrl ? "Sostituisci" : "Scegli foto o video"}
            isUploading={isUploading}
            label="Contenuto"
            mediaType={mediaType}
            onPick={() => {
              void handlePickMedia();
            }}
            onRemove={() => setMediaUrl(null)}
            previewUrl={mediaUrl}
            removable={Boolean(mediaUrl)}
          />

          <Input
            label="Didascalia"
            multiline
            onChangeText={setCaption}
            placeholder="Racconta il contenuto in una riga"
            value={caption}
          />
        </KeyboardAwareForm>

        <View style={styles.footer}>
          <Button
            disabled={!canPublish}
            label={isSaving ? "Pubblicazione…" : "Pubblica"}
            loading={isSaving}
            onPress={() => {
              void handlePublish();
            }}
            testID="media-content-publish-button"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
