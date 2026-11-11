/**
 * Avvisi del Feed: pill "Nuovi contenuti", offline, errore, stato vuoto Per
 * te, fine lista e retry in coda.
 *
 * HOM-01.1 ha tolto da qui tre elementi di HOM-01, e non vanno reintrodotti:
 *  • la pill "Aggiornamento Feed…" (§43): il pull-to-refresh usa solo
 *    l'indicatore nativo e il Feed resta visibile;
 *  • il banner "Riprendi da dove eri" (§45–47): se il ripristino funziona
 *    deve essere invisibile. La logica di restore resta intatta;
 *  • l'helper "Solo contenuti dei profili e delle società che segui" sotto le
 *    tab (§24): la label "Seguiti" basta.
 */

import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, shadows, spacing, typography } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_END_OF_LIST,
  FEED_ERROR_BODY,
  FEED_ERROR_TITLE,
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_NEW_CONTENT,
  FEED_OFFLINE,
  FEED_PER_TE_EMPTY_BODY,
  FEED_PER_TE_EMPTY_TITLE,
  FEED_RETRY,
} from "../../feed-labels";

/**
 * HOM-01.1 §40–§41: piccola pill sotto le tab, mai uno scroll automatico. Al
 * tap chi la usa porta la lista in cima e carica i nuovi elementi.
 *
 * Bianca con testo accent e nessun numero: discreta, non una CTA piena. È
 * l'unico elemento davvero sovrapposto al Feed, quindi è l'unico a usare
 * `shadows.overlay`. Annunciata agli screen reader quando compare (§67): una
 * sola volta, con `announceForAccessibility` e senza live region, che su
 * Android la farebbe leggere due volte. Chi la usa la monta solo nella tab
 * attiva, così non si annuncia una tab che l'utente non sta guardando.
 */
export function NewContentPill({ onPress }: { onPress: () => void }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${FEED_NEW_CONTENT} disponibili`);
  }, []);

  return (
    <Pressable
      accessibilityHint="Torna all'inizio del Feed e mostra i nuovi contenuti"
      accessibilityLabel={FEED_NEW_CONTENT}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed ? styles.pillPressed : null]}
      testID="feed-new-content"
    >
      <Ionicons color={colors.accent} name="arrow-up" size={15} />
      <AppText color="accent" style={styles.pillLabel} variant="feedMeta">
        {FEED_NEW_CONTENT}
      </AppText>
    </Pressable>
  );
}

/** §58: avviso discreto in testa al Feed, i contenuti in cache restano. */
export function FeedOfflineNotice() {
  return (
    <View accessibilityRole="alert" style={styles.notice} testID="feed-offline">
      <Ionicons color={colors.textMuted} name="cloud-offline-outline" size={15} />
      <AppText color="muted" style={styles.noticeText} variant="feedMeta">
        {FEED_OFFLINE}
      </AppText>
    </View>
  );
}

/**
 * §56: schermata d'errore, usata SOLO quando non c'è alcun contenuto da
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
    <View style={styles.centered} testID="feed-error">
      <AppText align="center" variant="headingSm">
        {FEED_ERROR_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="feedMeta">
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
    <View style={styles.centered} testID="feed-per-te-empty">
      <AppText align="center" variant="headingSm">
        {FEED_PER_TE_EMPTY_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="feedMeta">
        {FEED_PER_TE_EMPTY_BODY}
      </AppText>
      <Button label={FEED_FOLLOWING_EMPTY_CTA} onPress={onDiscover} />
    </View>
  );
}

/** §51: solo testo discreto, nessuna card, icona o illustrazione. */
export function FeedEndOfList() {
  return (
    <AppText align="center" color="muted" style={styles.end} variant="feedMeta">
      {FEED_END_OF_LIST}
    </AppText>
  );
}

/** Retry in coda alla lista: l'errore non cancella i contenuti già visibili. */
export function FeedInlineRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.inlineRetry} testID="feed-inline-retry">
      <AppText color="muted" variant="feedMeta">
        {FEED_ERROR_BODY}
      </AppText>
      <Button hitSlop={6} label={FEED_RETRY} onPress={onRetry} size="sm" variant="link" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[32],
  },
  end: {
    paddingBottom: spacing[8],
    paddingTop: spacing[20],
  },
  inlineRetry: {
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[16],
  },
  notice: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingVertical: spacing[10],
  },
  noticeText: {
    flex: 1,
  },
  pill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 36,
    paddingHorizontal: spacing[16],
    ...shadows.overlay,
  },
  pillLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
  pillPressed: {
    backgroundColor: colors.accentSoft,
  },
});
