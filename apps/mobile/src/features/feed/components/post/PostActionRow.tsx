/**
 * Riga azioni del Post (HOM-02 §47–63, §103–108).
 *
 * Esattamente tre controlli — Mi piace, Commenta, Condividi — ciascuno una sola
 * volta: il conteggio fa parte del controllo, non esiste una seconda riga di
 * social proof né uno stack di avatar (§47–48, §57). A zero si vede la label
 * ("Mi piace", "Commenta"), da uno in su il solo numero ("146", "18") con
 * l'etichetta parlata completa (§107). Condividi non ha mai un conteggio (§58).
 *
 * Tre aree uguali (`flex: 1`) su tutta la larghezza (§59–60, §103): stessa
 * distanza fra Mi piace e Commenta e fra Commenta e Condividi, nessun controllo
 * spinto al bordo. Visivamente restano icona + testo, senza bordo né fondo
 * (§61); le aree sono alte almeno 44pt. Il font non si riduce sugli schermi
 * stretti (§104): con Dynamic Type grande è l'area a crescere in altezza.
 *
 * Nessun segnalibro: Salva sta solo nel menu ••• (§62). Mi piace attivo =
 * stesso controllo con icona piena, accent e `selected` (§52). Il tap chiama
 * sempre l'handler: se il Like non è disponibile se ne occupa chi lo riceve.
 * Gli elementi editoriali (HOM-03, §63) usano `FeedItemActionRow` col segnalibro.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { buildPostActionModel } from "../../feed-post-presentation";

type PostActionRowProps = {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
};

type ActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  accessibilityLabel: string;
  /** Solo Mi piace ha uno stato; per gli altri due resta indefinito. */
  active?: boolean;
  onPress: () => void;
  testID: string;
};

function Action({ icon, text, accessibilityLabel, active, onPress, testID }: ActionProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <Ionicons
        color={active ? colors.accent : colors.textSecondary}
        name={icon}
        size={20}
      />
      <AppText
        color={active ? "accent" : "secondary"}
        numberOfLines={1}
        style={styles.label}
        variant="feedMeta"
      >
        {text}
      </AppText>
    </Pressable>
  );
}

export function PostActionRow({
  likesCount,
  commentsCount,
  isLiked,
  onLike,
  onComment,
  onShare,
}: PostActionRowProps) {
  const model = buildPostActionModel({ commentsCount, isLiked, likesCount });

  return (
    <View style={styles.row}>
      <Action
        accessibilityLabel={model.like.accessibilityLabel}
        active={model.like.selected}
        icon={model.like.selected ? "thumbs-up" : "thumbs-up-outline"}
        onPress={onLike}
        testID="feed-post-action-like"
        text={model.like.text}
      />
      <Action
        accessibilityLabel={model.comment.accessibilityLabel}
        icon="chatbubble-outline"
        onPress={onComment}
        testID="feed-post-action-comment"
        text={model.comment.text}
      />
      <Action
        accessibilityLabel={model.share.accessibilityLabel}
        icon="arrow-redo-outline"
        onPress={onShare}
        testID="feed-post-action-share"
        text={model.share.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[6],
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  // §104: il font non si riduce; con Dynamic Type alto su schermo stretto la
  // label si accorcia dentro la sua area invece di sconfinare (QA HOM-02).
  label: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: "row",
    marginTop: spacing[4],
  },
});
