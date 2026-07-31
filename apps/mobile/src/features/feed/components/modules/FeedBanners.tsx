/**
 * Banner e avvisi sovrapposti al Feed.
 *
 * Vivono tutti in un contenitore `pointerEvents="box-none"` posizionato in
 * assoluto: il §18 chiede che il banner "non copra il contenuto", e il §15 che
 * il refresh non sostituisca la schermata. Sovrapporsi senza intercettare i
 * tocchi è il compromesso che soddisfa entrambi.
 *
 * Nessun indicatore rosso da prototipo (§28): l'unico colore d'accento è
 * `colors.accent`.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, shadows, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_END_OF_LIST,
  FEED_ERROR_BODY,
  FEED_ERROR_TITLE,
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_FOLLOWING_HINT,
  FEED_OFFLINE,
  FEED_PER_TE_EMPTY_BODY,
  FEED_PER_TE_EMPTY_TITLE,
  FEED_REFRESHING,
  FEED_RESUME,
  FEED_RETRY,
  newContentLabel,
} from "../../feed-labels";

/** §15: indicatore compatto, i contenuti sotto restano percepibili. */
export function FeedRefreshingPill() {
  return (
    <View style={[styles.pill, styles.pillNeutral]} testID="feed-refreshing">
      <AppText color="secondary" variant="caption">
        {FEED_REFRESHING}
      </AppText>
    </View>
  );
}

/** §19: al tap si torna in cima e si caricano i nuovi elementi. Mai da solo. */
export function FeedNewContentBanner({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.pill, styles.pillAccent]}
      testID="feed-new-content"
    >
      <Ionicons color={colors.inkInvert} name="arrow-up" size={14} />
      <AppText color="inverse" variant="caption">
        {newContentLabel(count)}
      </AppText>
    </Pressable>
  );
}

/** §18: piccolo, chiudibile, si dissolve da solo, non copre il contenuto. */
export function FeedResumeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={[styles.pill, styles.pillNeutral]} testID="feed-resume">
      <Ionicons color={colors.accent} name="bookmark" size={14} />
      <AppText color="secondary" variant="caption">
        {FEED_RESUME}
      </AppText>
      <Pressable
        accessibilityLabel="Chiudi"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onDismiss}
      >
        <Ionicons color={colors.textMuted} name="close" size={14} />
      </Pressable>
    </View>
  );
}

/** §24: avviso discreto, i contenuti in cache restano visibili. */
export function FeedOfflineNotice() {
  return (
    <View style={styles.notice} testID="feed-offline">
      <Ionicons color={colors.textMuted} name="cloud-offline-outline" size={14} />
      <AppText color="muted" style={styles.noticeText} variant="caption">
        {FEED_OFFLINE}
      </AppText>
    </View>
  );
}

/** §13: helper discreto, mostrato solo nei primi accessi. */
export function FeedFollowingHint() {
  return (
    <AppText align="center" color="muted" style={styles.hint} variant="caption">
      {FEED_FOLLOWING_HINT}
    </AppText>
  );
}

/**
 * §23: schermata d'errore, usata SOLO quando non c'è alcun contenuto da
 * mostrare. Con elementi in cache si tengono i contenuti e si mostra il retry
 * in fondo alla lista.
 *
 * `detail` riporta il messaggio dell'errore sottostante in forma discreta.
 * Senza, "Controlla la connessione" è l'unica informazione disponibile e una
 * causa diversa (RPC assente, permesso negato, payload inatteso) resta
 * indistinguibile da un problema di rete — sia per chi usa l'app sia per chi
 * deve correggerla.
 */
export function FeedErrorState({
  detail,
  onRetry,
}: {
  detail?: string | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.error} testID="feed-error">
      <AppText align="center" variant="titleMd">
        {FEED_ERROR_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="bodySm">
        {FEED_ERROR_BODY}
      </AppText>
      <Button label={FEED_RETRY} onPress={onRetry} />
      {detail ? (
        <AppText align="center" color="muted" variant="caption">
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Tab Per te senza alcun contenuto. Esiste per non lasciare mai la Home a
 * schermo bianco: prima di questo stato la lista vuota non diceva nulla.
 */
export function FeedPerTeEmpty({ onDiscover }: { onDiscover: () => void }) {
  return (
    <View style={styles.empty} testID="feed-per-te-empty">
      <AppText align="center" variant="titleMd">
        {FEED_PER_TE_EMPTY_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="bodySm">
        {FEED_PER_TE_EMPTY_BODY}
      </AppText>
      <Button label={FEED_FOLLOWING_EMPTY_CTA} onPress={onDiscover} />
    </View>
  );
}

/** §17: messaggio discreto, non una grande schermata finale. */
export function FeedEndOfList() {
  return (
    <AppText align="center" color="muted" style={styles.end} variant="caption">
      {FEED_END_OF_LIST}
    </AppText>
  );
}

/** Retry in coda alla lista: l'errore non cancella i contenuti già visibili. */
export function FeedInlineRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.inlineRetry} testID="feed-inline-retry">
      <AppText color="muted" variant="caption">
        {FEED_ERROR_BODY}
      </AppText>
      <Button label={FEED_RETRY} onPress={onRetry} size="sm" variant="link" />
    </View>
  );
}

const styles = StyleSheet.create({
  end: {
    paddingBottom: spacing[8],
    paddingTop: spacing[16],
  },
  empty: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[32],
  },
  error: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[32],
  },
  hint: {
    paddingBottom: spacing[4],
    paddingTop: spacing[12],
  },
  inlineRetry: {
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[16],
  },
  notice: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[6],
    marginTop: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  noticeText: {
    flex: 1,
  },
  pill: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
    ...shadows.card,
  },
  pillAccent: {
    backgroundColor: colors.accent,
  },
  pillNeutral: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
