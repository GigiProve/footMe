/**
 * Copertina dell'Articolo (HOM-06.2 §36–§40, §251; mockup 2–3).
 *
 *  • vuota: area tratteggiata «Aggiungi copertina» (mockup 2) — non obbligatoria
 *    (§37), nessun placeholder artificiale dopo che l'utente l'ha ignorata (§38);
 *  • presente: anteprima 16:9 con X per rimuoverla e «Sostituisci» (§39);
 *  • caricamento: spinner sull'immagine; fallito → «Riprova» senza perdere la scelta.
 *
 * Il ritaglio è del picker nativo (vedi `article-cover.ts`).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import type { ArticleCover } from "../article-types";

type Props = {
  cover: ArticleCover | null;
  notice: string | null;
  disabled?: boolean;
  onPick: () => void;
  onRemove: () => void;
  onRetry: () => void;
};

export function ArticleCoverField({ cover, notice, disabled = false, onPick, onRemove, onRetry }: Props) {
  const uri = cover ? (cover.localUri ?? cover.url) : null;

  return (
    <View style={styles.wrapper}>
      {cover && uri ? (
        <View style={styles.frame} testID="article-cover">
          <Image accessibilityLabel="Copertina dell'articolo" resizeMode="cover" source={{ uri }} style={styles.image} />

          {cover.uploadStatus === "uploading" || cover.uploadStatus === "pending" ? (
            <View accessibilityLabel="Caricamento della copertina" style={styles.scrim}>
              <ActivityIndicator color={colors.inkInvert} size="small" />
            </View>
          ) : null}

          {cover.uploadStatus === "failed" ? (
            <View style={styles.scrim}>
              <AppText align="center" color="inverse" variant="bodySm">
                Caricamento non riuscito
              </AppText>
              <Pressable
                accessibilityLabel="Riprova a caricare la copertina"
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.pill}
                testID="article-cover-retry"
              >
                <AppText color="inverse" variant="actionLabel">
                  Riprova
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {disabled ? null : (
            <>
              <Pressable
                accessibilityLabel="Rimuovi copertina"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onRemove}
                style={styles.remove}
                testID="article-cover-remove"
              >
                <Ionicons color={colors.inkInvert} name="close" size={16} />
              </Pressable>
              <Pressable
                accessibilityLabel="Sostituisci copertina"
                accessibilityRole="button"
                onPress={onPick}
                style={[styles.pill, styles.replace]}
                testID="article-cover-replace"
              >
                <AppText color="inverse" variant="actionLabel">
                  Sostituisci
                </AppText>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityHint="Scegli una foto da usare come copertina"
          accessibilityLabel="Aggiungi copertina"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPick}
          style={({ pressed }) => [styles.empty, pressed ? styles.pressed : null]}
          testID="article-cover-add"
        >
          <Ionicons color={colors.textSecondary} name="image-outline" size={28} />
          <AppText color="secondary" variant="bodyLg">
            Aggiungi copertina
          </AppText>
        </Pressable>
      )}

      {notice ? (
        <AppText accessibilityLiveRegion="polite" color="danger" style={styles.notice} variant="bodySm">
          {notice}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radius[16],
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing[8],
    justifyContent: "center",
    minHeight: 128,
  },
  frame: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[16],
    overflow: "hidden",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  notice: {
    paddingTop: spacing[8],
  },
  pill: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: spacing[14],
  },
  pressed: {
    opacity: 0.7,
  },
  remove: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: spacing[10],
    top: spacing[10],
    width: 28,
  },
  replace: {
    bottom: spacing[10],
    left: spacing[10],
    position: "absolute",
  },
  scrim: {
    alignItems: "center",
    backgroundColor: colors.mediaViewerOverlay,
    gap: spacing[8],
    justifyContent: "center",
    ...StyleSheet.absoluteFill,
  },
  wrapper: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
});
