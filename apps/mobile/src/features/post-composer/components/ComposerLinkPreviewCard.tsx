/**
 * Anteprima del link nel composer (HOM-06.1 §73–94, mockup screen 5 e 7).
 *
 *  • ready (§81): miniatura, titolo, breve descrizione, dominio e X. Card con
 *    cornice `border` e raggio 16 come `PostLinkPreview` del Feed, così il
 *    composer anticipa ciò che verrà pubblicato. Mai l'URL lungo (§82);
 *  • loading: scheletro della stessa card, con X per rinunciare all'anteprima;
 *  • failed (§90–91): componente leggero, non una card — icona link + dominio,
 *    «Anteprima non disponibile» e, se ammessi, «Riprova» / «Apri link». Non
 *    blocca mai la pubblicazione (§89);
 *  • la X (`onDismiss`) rimuove solo il componente, non il testo (§92); la
 *    memoria `preview_dismissed` (§93) è del reducer.
 *
 * Con media presenti (§95–97) il chiamante non monta il componente: la
 * rich preview visuale resta nascosta ma il dato non va perso.
 */

import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ComposerLinkPreviewState } from "../composer-types";

export const COMPOSER_LINK_UNAVAILABLE_LABEL = "Anteprima non disponibile";

type ComposerLinkPreviewCardProps = {
  state: ComposerLinkPreviewState;
  onDismiss: () => void;
  /** Mostrato solo se lo stato fallito è `retryable`. */
  onRetry?: () => void;
  /** Apre il link nel browser (fallback §90). */
  onOpenLink?: () => void;
};

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Rimuovi anteprima del link"
      accessibilityRole="button"
      hitSlop={9}
      onPress={onDismiss}
      style={styles.dismiss}
      testID="composer-link-preview-dismiss"
    >
      <Ionicons color={colors.textSecondary} name="close" size={16} />
    </Pressable>
  );
}

export function ComposerLinkPreviewCard({
  state,
  onDismiss,
  onRetry,
  onOpenLink,
}: ComposerLinkPreviewCardProps) {
  const [thumbFailed, setThumbFailed] = useState(false);

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <View style={styles.wrapper}>
        <View style={styles.card} testID="composer-link-preview-loading">
          <View style={[styles.thumb, styles.skeleton]} />
          <View
            accessibilityLabel="Caricamento anteprima del link"
            accessible
            style={styles.text}
          >
            <View style={[styles.skeletonLine, styles.skeleton]} />
            <View style={[styles.skeletonLineShort, styles.skeleton]} />
            <View style={[styles.skeletonDomain, styles.skeleton]} />
          </View>
          <DismissButton onDismiss={onDismiss} />
        </View>
      </View>
    );
  }

  if (state.status === "failed") {
    const label = state.domain ?? state.url;

    return (
      <View style={styles.wrapper}>
        <View style={styles.fallback} testID="composer-link-preview-failed">
          <Ionicons color={colors.textSecondary} name="link-outline" size={20} />
          <View style={styles.text}>
            <AppText numberOfLines={1} variant="titleSm">
              {label}
            </AppText>
            <AppText color="secondary" variant="feedMeta">
              {COMPOSER_LINK_UNAVAILABLE_LABEL}
            </AppText>
            {(state.retryable && onRetry) || onOpenLink ? (
              <View style={styles.actions}>
                {state.retryable && onRetry ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={onRetry}
                    style={styles.action}
                  >
                    <AppText color="accent" variant="actionLabel">
                      Riprova
                    </AppText>
                  </Pressable>
                ) : null}
                {onOpenLink ? (
                  <Pressable
                    accessibilityLabel={`Apri link ${label}`}
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={onOpenLink}
                    style={styles.action}
                  >
                    <AppText color="accent" variant="actionLabel">
                      Apri link
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
          <DismissButton onDismiss={onDismiss} />
        </View>
      </View>
    );
  }

  const title = state.title?.trim() || state.domain;
  const showDomainLine = Boolean(state.title?.trim());
  const showThumb = Boolean(state.imageUrl) && !thumbFailed;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} testID="composer-link-preview">
        {showThumb ? (
          <Image
            accessibilityIgnoresInvertColors
            onError={() => setThumbFailed(true)}
            resizeMode="cover"
            source={{ uri: state.imageUrl ?? undefined }}
            style={styles.thumb}
          />
        ) : null}
        <View
          accessibilityLabel={[title, showDomainLine ? state.domain : null]
            .filter(Boolean)
            .join(", ")}
          accessible
          style={styles.text}
        >
          <AppText numberOfLines={2} variant="titleSm">
            {title}
          </AppText>
          {state.description ? (
            <AppText color="secondary" numberOfLines={2} variant="feedMeta">
              {state.description}
            </AppText>
          ) : null}
          {showDomainLine ? (
            <AppText color="muted" numberOfLines={1} variant="caption">
              {state.domain}
            </AppText>
          ) : null}
        </View>
        <DismissButton onDismiss={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: "center",
    minHeight: 32,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[16],
    marginTop: spacing[4],
  },
  card: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    overflow: "hidden",
    padding: spacing[10],
    // Spazio per la X, che resta fuori dal flusso del testo.
    paddingRight: spacing[40],
  },
  dismiss: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    position: "absolute",
    right: spacing[8],
    top: spacing[8],
    width: 26,
  },
  fallback: {
    alignItems: "flex-start",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    paddingRight: spacing[36],
    paddingVertical: spacing[10],
  },
  skeleton: {
    backgroundColor: colors.surfacePlaceholder,
  },
  skeletonDomain: {
    borderRadius: radius[4],
    height: 10,
    width: "30%",
  },
  skeletonLine: {
    borderRadius: radius[4],
    height: 14,
    width: "90%",
  },
  skeletonLineShort: {
    borderRadius: radius[4],
    height: 12,
    width: "60%",
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  thumb: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    height: 80,
    width: 80,
  },
  wrapper: {
    marginTop: spacing[12],
    paddingHorizontal: spacing[16],
  },
});
