/**
 * Messaggio con reference a un contenuto, in chat (HOM-09 §95–§118, §122).
 *
 * Un solo oggetto: testo opzionale e card nella stessa unità (§95–§97), non
 * due messaggi. Il testo, se c'è, sta in una fascia tinta sopra la card; la
 * card è la rappresentazione principale (§288), mai un URL.
 *
 *  • Post: thumbnail se c'è, autore, verifica, meta, excerpt, «Post» (§105–§106);
 *  • Articolo: cover se c'è, titolo prioritario, autore, «Articolo» (§107);
 *  • Video: thumbnail, Play, durata, titolo, autore — nessun autoplay (§108–§109).
 *
 * Il tap apre sempre il contenuto canonico per `content_id` e mostra la
 * versione attuale e autorizzata (§103, §111–§112): `origin=MESSAGE`, così il
 * Back riporta alla chat. Se il server non conferma l'accesso a QUESTO viewer
 * (eliminato, moderato, visibilità revocata, autore o pagina non disponibili,
 * permesso perso) la card diventa «Contenuto non disponibile» senza dire perché
 * (§115, §117–§118), e il testo scritto dall'utente resta (§116).
 *
 * Il contact card esistente usa `Text` grezzo: non si imita (CLAUDE.md, UI rules).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { contentDetailHref } from "../../feed/content-routes";
import { SharePreviewCard } from "../../share/components/SharePreviewCard";
import {
  readContentReference,
  SHARE_COPY,
  sharePreviewAccessibilityLabel,
} from "../../share/share-presentation";
import type { ConversationMessage } from "../messaging-service";

type ContentReferenceCardProps = {
  isOwnMessage: boolean;
  message: ConversationMessage;
  timestamp: string;
};

export function ContentReferenceCard({
  isOwnMessage,
  message,
  timestamp,
}: ContentReferenceCardProps) {
  const router = useRouter();
  const reference = readContentReference(message);
  const text = message.body.trim();

  return (
    <View style={styles.container} testID="content-reference-card">
      {text ? (
        <View
          style={[styles.textArea, isOwnMessage ? styles.textAreaOwn : styles.textAreaOther]}
          testID="content-reference-text"
        >
          <AppText color={isOwnMessage ? "accentStrong" : "primary"} variant="bodySm">
            {text}
          </AppText>
        </View>
      ) : null}

      {reference.available ? (
        <Pressable
          accessibilityHint="Apre il contenuto"
          accessibilityLabel={sharePreviewAccessibilityLabel(reference.preview)}
          accessibilityRole="button"
          onPress={() =>
            router.push(
              contentDetailHref(reference.contentType, reference.contentId, {
                origin: "MESSAGE",
              }) as never,
            )
          }
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
          testID="content-reference-open"
        >
          <SharePreviewCard preview={reference.preview} showAuthorMeta size="chat" />
          <AppText color="muted" style={styles.timestamp} variant="caption">
            {timestamp}
          </AppText>
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityLabel={`${SHARE_COPY.unavailableTitle}. ${SHARE_COPY.unavailableBody}`}
          style={styles.card}
          testID="content-reference-unavailable"
        >
          <View style={styles.unavailableRow}>
            <View style={styles.unavailableIcon}>
              <Ionicons color={colors.textMuted} name="document-text-outline" size={24} />
            </View>
            <View style={styles.unavailableText}>
              <AppText variant="titleSm">{SHARE_COPY.unavailableTitle}</AppText>
              <AppText color="secondary" variant="bodySm">
                {SHARE_COPY.unavailableBody}
              </AppText>
            </View>
          </View>
          <AppText color="muted" style={styles.timestamp} variant="caption">
            {timestamp}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    padding: spacing[12],
  },
  container: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
    width: "82%",
  },
  pressed: {
    opacity: 0.85,
  },
  textArea: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  textAreaOther: {
    backgroundColor: colors.chatBubbleReceived,
  },
  textAreaOwn: {
    backgroundColor: colors.chatBubbleSent,
  },
  timestamp: {
    alignSelf: "flex-end",
  },
  unavailableIcon: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  unavailableRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  unavailableText: {
    flex: 1,
    gap: spacing[4],
  },
});
