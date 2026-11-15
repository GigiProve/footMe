/**
 * Recenti del pannello «Invia su PROLINK» (HOM-09 §24–§33, §77–§81).
 *
 * Poche destinazioni Messaggi — DIRECT e GROUP — in una riga che scorre in
 * orizzontale (§25, §31–§32), chiusa da «Altro» con icona semplice (§33). Mai
 * app esterne nella stessa riga (§34).
 *
 * Tre stati senza bloccare il resto del pannello (§80–§81):
 *  • caricamento: pochi skeleton piccoli;
 *  • nessuna conversazione recente (o lettura fallita): niente avatar segnaposto
 *    (§77), la riga «Cerca persone, società o conversazioni» che apre «Invia a»
 *    (§78);
 *  • risultati: avatar + nome, e «Altro».
 * Tap su un recente NON invia (§40): passa al passo «Condividi».
 */

import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, SearchField, Skeleton } from "../../../ui";
import { recipientAccessibilityLabel, SHARE_COPY } from "../share-presentation";
import type { ShareRecipient } from "../share-types";
import { RecipientAvatar } from "./RecipientAvatar";

type ShareRecentsRowProps = {
  isLoading: boolean;
  recipients: ShareRecipient[];
  onMore: () => void;
  onSelect: (recipient: ShareRecipient, position: number) => void;
};

const SKELETON_COUNT = 5;
/** Avatar da 44 più il nome su due righe: nessun token per questa larghezza di colonna. */
const RECENT_ITEM_WIDTH = sizes.touchTarget + spacing[32];
/** Con Dynamic Type oltre 1,3× la parola più lunga non starebbe più nella colonna. */
const RECENT_NAME_MAX_FONT_SCALE = 1.3;

export function ShareRecentsRow({ isLoading, recipients, onMore, onSelect }: ShareRecentsRowProps) {
  if (isLoading) {
    return (
      <View
        accessibilityLabel="Caricamento conversazioni recenti"
        style={styles.skeletonRow}
        testID="share-recents-loading"
      >
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <View key={index} style={styles.skeletonItem}>
            <Skeleton.Circle style={[styles.skeletonBlock, styles.skeletonCircle]} />
            <Skeleton.Row style={[styles.skeletonBlock, styles.skeletonLabel]} />
          </View>
        ))}
      </View>
    );
  }

  if (recipients.length === 0) {
    return (
      <SearchField
        onPress={onMore}
        placeholder={SHARE_COPY.searchPlaceholder}
        testID="share-recents-search-entry"
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="share-recents-list"
    >
      {recipients.map((recipient, index) => (
        <Pressable
          accessibilityLabel={recipientAccessibilityLabel(recipient, null)}
          accessibilityRole="button"
          key={recipient.key}
          onPress={() => onSelect(recipient, index)}
          style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          testID={`share-recent-${recipient.key}`}
        >
          <RecipientAvatar recipient={recipient} />
          {/* Il nome va a capo tra le parole (due righe, ellissi): con Dynamic Type
              molto alto il moltiplicatore è limitato, così la colonna non costringe
              a spezzare «Bianchi» a metà. */}
          <AppText
            align="center"
            color="secondary"
            ellipsizeMode="tail"
            maxFontSizeMultiplier={RECENT_NAME_MAX_FONT_SCALE}
            numberOfLines={2}
            variant="caption"
          >
            {recipient.displayName}
          </AppText>
        </Pressable>
      ))}
      <Pressable
        accessibilityLabel={SHARE_COPY.moreAccessibility}
        accessibilityRole="button"
        onPress={onMore}
        style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
        testID="share-recents-more"
      >
        <View style={styles.moreCircle}>
          <Ionicons color={colors.textSecondary} name="ellipsis-horizontal" size={20} />
        </View>
        <AppText align="center" color="secondary" numberOfLines={1} variant="caption">
          {SHARE_COPY.more}
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    gap: spacing[6],
    minHeight: sizes.touchTarget,
    width: RECENT_ITEM_WIDTH,
  },
  moreCircle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.7,
  },
  scroll: {
    alignItems: "flex-start",
    gap: spacing[4],
  },
  // `Skeleton` è `surfaceMuted`, identico al fondo del foglio: su `background`
  // sparirebbe. Il segnaposto dei media (`surfacePlaceholder`) si distingue.
  skeletonBlock: {
    backgroundColor: colors.surfacePlaceholder,
  },
  skeletonCircle: {
    height: sizes.touchTarget,
    width: sizes.touchTarget,
  },
  skeletonItem: {
    alignItems: "center",
    gap: spacing[6],
    width: RECENT_ITEM_WIDTH,
  },
  skeletonLabel: {
    height: 10,
    marginBottom: 0,
    width: 40,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: spacing[4],
  },
});
