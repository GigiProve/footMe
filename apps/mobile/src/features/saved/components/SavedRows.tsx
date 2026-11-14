/**
 * Righe del Saved Center (HOM-07 §107–§128, §179, §199).
 *
 * Liste verticali, non dashboard: le righe si separano con whitespace e una
 * hairline, mai con card (§198–§199). Una riga è una sola unità semantica
 * (§179): il corpo è un unico controllo con un nome parlato completo, e il
 * segnalibro attivo è il secondo, separato, target.
 *
 * Quattro forme, una per tipo di target: contenuto (thumbnail se c'è, play e
 * durata per i video, etichetta POST/VIDEO/ARTICOLO, titolo, autore con
 * verifica e tempo); profilo; Società/Squadra (stessa forma, logo quadrato);
 * posizione (ruolo, Società · Squadra, categoria · località; «Posizione chiusa»
 * senza CTA, mai scadenza, candidati o match score).
 *
 * Quali righe mostrare lo decide la schermata, leggendo lo store Salvati: la
 * rimozione (§116–§117) la nasconde subito e «Annulla» (§119) la fa tornare al
 * suo posto senza aspettare un reload.
 */

import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, VerifiedCheck } from "../../../ui";
import {
  CONTENT_KIND_LABEL,
  SAVED_COPY,
  contentRowAccessibilityLabel,
  contentRowTime,
  contentRowTitle,
  formatClock,
  positionRowMeta,
  positionRowSubtitle,
  positionRowTitle,
  profileRowSubtitle,
  societyRowSubtitle,
  societyRowTitle,
} from "../saved-presentation";
import type { SavedContentPayload, SavedRow } from "../saved-types";
import { SavedBookmarkButton } from "./SavedBookmarkButton";

type SavedRowItemProps = {
  row: SavedRow;
  onOpen: (row: SavedRow) => void;
  onRemove: (row: SavedRow) => void;
};

export function SavedRowItem({ onOpen, onRemove, row }: SavedRowItemProps) {
  const open = () => onOpen(row);
  const remove = () => onRemove(row);

  switch (row.kind) {
    case "content":
      return <SavedContentRow onOpen={open} onRemove={remove} payload={row.payload} />;
    case "profile":
      return (
        <SavedEntityRow
          left={<Avatar name={row.payload.name} size="md" uri={row.payload.avatar_url} />}
          isVerified={row.payload.is_verified}
          onOpen={open}
          onRemove={remove}
          subtitle={profileRowSubtitle(row.payload)}
          title={row.payload.name}
        />
      );
    case "society":
    case "team":
      return (
        <SavedEntityRow
          left={
            <Avatar
              name={row.payload.name}
              size="md"
              square
              tone="ink"
              uri={row.payload.logo_url}
            />
          }
          isVerified={row.payload.is_verified}
          onOpen={open}
          onRemove={remove}
          subtitle={societyRowSubtitle(row)}
          title={societyRowTitle(row)}
        />
      );
    case "position":
      return (
        <SavedRowShell
          accessibilityLabel={[
            positionRowTitle(row.payload),
            positionRowSubtitle(row.payload),
            positionRowMeta(row.payload),
            row.payload.lifecycle === "closed" ? SAVED_COPY.closedPosition : null,
          ]
            .filter(Boolean)
            .join(", ")}
          onOpen={open}
          onRemove={remove}
        >
          <View style={styles.body}>
            <AppText numberOfLines={2} variant="titleSm">
              {positionRowTitle(row.payload)}
            </AppText>
            {positionRowSubtitle(row.payload) ? (
              <AppText color="secondary" numberOfLines={2} variant="feedMeta">
                {positionRowSubtitle(row.payload)}
              </AppText>
            ) : null}
            {positionRowMeta(row.payload) ? (
              <AppText color="muted" numberOfLines={2} variant="feedMeta">
                {positionRowMeta(row.payload)}
              </AppText>
            ) : null}
            {row.payload.lifecycle === "closed" ? (
              // §150: una posizione chiusa resta leggibile; nessuna CTA candidatura,
              // nessun colore d'allarme (DAS-REV-05 §16).
              <AppText color="muted" variant="caption">
                {SAVED_COPY.closedPosition}
              </AppText>
            ) : null}
          </View>
        </SavedRowShell>
      );
  }
}

function SavedRowShell({
  accessibilityLabel,
  children,
  left,
  onOpen,
  onRemove,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  left?: ReactNode;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
      >
        {left ?? null}
        {children}
      </Pressable>
      <SavedBookmarkButton isSaved onToggle={onRemove} />
    </View>
  );
}

function SavedEntityRow({
  isVerified,
  left,
  onOpen,
  onRemove,
  subtitle,
  title,
}: {
  isVerified: boolean;
  left: ReactNode;
  onOpen: () => void;
  onRemove: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <SavedRowShell
      accessibilityLabel={[title, isVerified ? "profilo verificato" : null, subtitle]
        .filter(Boolean)
        .join(", ")}
      left={left}
      onOpen={onOpen}
      onRemove={onRemove}
    >
      <View style={styles.body}>
        <View style={styles.nameLine}>
          <AppText numberOfLines={1} style={styles.nameText} variant="titleSm">
            {title}
          </AppText>
          {isVerified ? <VerifiedCheck size={14} /> : null}
        </View>
        {subtitle ? (
          <AppText color="secondary" numberOfLines={1} variant="feedMeta">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </SavedRowShell>
  );
}

function SavedContentRow({
  onOpen,
  onRemove,
  payload,
}: {
  onOpen: () => void;
  onRemove: () => void;
  payload: SavedContentPayload;
}) {
  const time = contentRowTime(payload);
  const isVideo = payload.item_kind === "video";

  return (
    <SavedRowShell
      accessibilityLabel={contentRowAccessibilityLabel(payload)}
      left={
        // §110: il Post text-only non ha placeholder immagine.
        payload.thumbnail_url ? (
          <View style={styles.thumbnail}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: payload.thumbnail_url }}
              style={styles.thumbnailImage}
            />
            {isVideo ? (
              <>
                <View style={styles.playBadge}>
                  <Ionicons color={colors.inkInvert} name="play" size={14} />
                </View>
                {payload.duration_seconds ? (
                  <View style={styles.durationBadge}>
                    <AppText color="inverse" variant="caption">
                      {formatClock(payload.duration_seconds)}
                    </AppText>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null
      }
      onOpen={onOpen}
      onRemove={onRemove}
    >
      <View style={styles.body}>
        <AppText color="accent" variant="eyebrow">
          {CONTENT_KIND_LABEL[payload.item_kind]}
        </AppText>
        <AppText numberOfLines={2} variant="titleSm">
          {contentRowTitle(payload)}
        </AppText>
        {payload.author || time ? (
          <View style={styles.nameLine}>
            {payload.author ? (
              <>
                <AppText
                  color="secondary"
                  numberOfLines={1}
                  style={styles.nameText}
                  variant="feedMeta"
                >
                  {payload.author.name}
                </AppText>
                {payload.author.is_verified ? <VerifiedCheck size={13} /> : null}
              </>
            ) : null}
            {time ? (
              <AppText color="secondary" variant="feedMeta">
                {payload.author ? `· ${time}` : time}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </SavedRowShell>
  );
}

/** Righe segnaposto durante il caricamento (§157): stesse proporzioni, nessun salto. */
export function SavedListSkeleton() {
  return (
    <View testID="saved-skeleton">
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonThumb} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLineMedium} />
          </View>
        </View>
      ))}
    </View>
  );
}

const THUMB_WIDTH = 88;
const THUMB_HEIGHT = 64;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  durationBadge: {
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    bottom: spacing[4],
    left: spacing[4],
    paddingHorizontal: spacing[6],
    position: "absolute",
  },
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  nameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  nameText: {
    flexShrink: 1,
  },
  playBadge: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    height: 26,
    justifyContent: "center",
    left: (THUMB_WIDTH - 26) / 2,
    position: "absolute",
    top: (THUMB_HEIGHT - 26) / 2,
    width: 26,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[4],
  },
  skeletonLine: {
    backgroundColor: colors.border,
    borderRadius: radius[4],
    height: 14,
    width: "90%",
  },
  skeletonLineMedium: {
    backgroundColor: colors.border,
    borderRadius: radius[4],
    height: 12,
    width: "55%",
  },
  skeletonLineShort: {
    backgroundColor: colors.border,
    borderRadius: radius[4],
    height: 10,
    width: "25%",
  },
  skeletonRow: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  skeletonText: {
    flex: 1,
    gap: spacing[8],
  },
  skeletonThumb: {
    backgroundColor: colors.border,
    borderRadius: radius[8],
    height: THUMB_HEIGHT,
    width: THUMB_WIDTH,
  },
  thumbnail: {
    borderRadius: radius[8],
    height: THUMB_HEIGHT,
    overflow: "hidden",
    width: THUMB_WIDTH,
  },
  thumbnailImage: {
    backgroundColor: colors.surfacePlaceholder,
    height: THUMB_HEIGHT,
    width: THUMB_WIDTH,
  },
});
