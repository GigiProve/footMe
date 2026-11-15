/**
 * Riga azioni del Post (HOM-02 §47–63, §103–108; HOM-07 §22–§39).
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
 * Nessun segnalibro: Salva sta solo nel menu ••• (§62). HOM-03 §52–59: Articolo
 * e Video editoriale usano QUESTA riga, identica; il segnalibro sta nell'header
 * (`EditorialHeader`), mai come quarta azione.
 *
 * HOM-07 — Mi piace (§22–§31). Una sola cella, due comportamenti:
 *  • icona (e tutta l'area che non è il numero) → mette o toglie Mi piace;
 *  • numero → apre la lista di chi ha messo Mi piace (§24), con un'area propria
 *    di almeno 44pt che non ha forma di bottone (§27, §29);
 *  • a zero niente numero e niente lista: tutta la cella è il toggle (§26).
 * La cella non cambia larghezza (§28). Per lo screen reader resta UN elemento:
 * «146 Mi piace», con le azioni «Metti Mi piace» e «Visualizza chi ha messo Mi
 * piace» (§30–§31), e lo stato attivo detto a voce oltre che col cuore pieno e
 * l'accent (§8, §177). Lo stato arriva dallo store (`useLikeView`): un toggle
 * rirenderizza questa cella e non il Feed (§136).
 * Commenta: l'intera cella è un solo entry point (§33–§36).
 *
 * HOM-08 §210–§214: il conteggio dei commenti viene dallo store dedicato
 * (`comment-count-store`, stessa chiave dei Mi piace), con il payload come
 * fallback prima del seed: pubblicare o eliminare un commento nel dettaglio
 * aggiorna questa cella senza toccare le pagine del Feed. `LikeAction` ha la
 * variante `compact` (larghezza naturale, identica logica) per la riga del
 * commento (§68–§73), che non ha tre aree uguali.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { useCommentsCount } from "../../../comments/comment-count-store";
import type { LikeSnapshot } from "../../../interactions/interaction-types";
import { likeItemKey, useLikeView } from "../../../interactions/like-store";
import { buildPostActionModel } from "../../feed-post-presentation";

/** Il contenuto a cui il Mi piace appartiene, con lo stato del payload che l'ha mostrato. */
export type PostLikeSource = {
  contentType: string;
  postId: string;
  seed: LikeSnapshot;
};

type PostActionRowProps = {
  like: PostLikeSource;
  commentsCount: number;
  onLike: () => void;
  /** Apre la lista Mi piace (HOM-07 §24). Assente = il numero non è un'area a sé. */
  onOpenLikes?: () => void;
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

export function PostActionButton({
  icon,
  text,
  accessibilityLabel,
  active,
  onPress,
  testID,
}: ActionProps) {
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

/** Allarga il tocco del numero verso i lati liberi della cella, mai oltre (§29). */
// §27, §29: anche «1» deve avere un'area di tocco vicina ai 44pt; a destra la
// cella ha spazio libero, a sinistra il cuore resta suo.
const COUNT_HIT_SLOP = { bottom: 0, left: spacing[6], right: spacing[24], top: 0 };

/**
 * HOM-08 §236: nella variante `compact` il cuore ha il suo spazio (12 + 20 + 12
 * = 44pt di larghezza, vedi `actionCompact`), quindi il numero non si allarga
 * verso sinistra: le due aree non si sovrappongono. A destra il tocco arriva a
 * ~44pt con lo slop, senza uscire dalla riga del commento.
 */
const COMPACT_COUNT_HIT_SLOP = { bottom: 0, left: 0, right: spacing[28], top: 0 };

type LikeActionProps = PostLikeSource & {
  onToggle: () => void;
  onOpenLikes?: () => void;
  testID: string;
  /** Fuori dal prefisso `feed-post-action-`, che nei test conta le tre azioni. */
  countTestID?: string;
  /** HOM-08 §68–§73: larghezza naturale (riga commento), invece di `flex: 1`. */
  compact?: boolean;
};

/**
 * La cella Mi piace, collegata allo store. Esportata anche per la riga azioni
 * dei commenti (HOM-08 §74, variante `compact`).
 */
export function LikeAction({
  contentType,
  postId,
  seed,
  onToggle,
  onOpenLikes,
  testID,
  countTestID = "feed-post-likes-count",
  compact = false,
}: LikeActionProps) {
  const view = useLikeView(likeItemKey(contentType, postId), seed);
  const { like } = buildPostActionModel({
    commentsCount: 0,
    isLiked: view.isLiked,
    likesCount: view.likesCount,
  });
  const color = like.selected ? "accent" : "secondary";
  const listAction = like.countText !== null && onOpenLikes ? onOpenLikes : null;

  const actions = [{ label: like.toggleActionLabel, name: "toggleLike" }];
  if (listAction && like.listActionLabel) {
    actions.push({ label: like.listActionLabel, name: "openLikes" });
  }

  return (
    <Pressable
      accessibilityActions={actions}
      accessibilityLabel={like.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: like.selected }}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "openLikes") {
          listAction?.();
        } else if (event.nativeEvent.actionName === "toggleLike") {
          onToggle();
        }
      }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.action,
        compact ? styles.actionCompact : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <Ionicons
        color={like.selected ? colors.accent : colors.textSecondary}
        name={like.selected ? "heart" : "heart-outline"}
        size={20}
      />
      {listAction && like.countText ? (
        // Area propria del numero, ≥44pt, senza fondo né bordo: non è un secondo
        // bottone. Fuori dall'albero accessibile: la cella parla per intero.
        <Pressable
          accessible={false}
          hitSlop={compact ? COMPACT_COUNT_HIT_SLOP : COUNT_HIT_SLOP}
          importantForAccessibility="no-hide-descendants"
          onPress={listAction}
          style={styles.count}
          testID={countTestID}
        >
          <AppText color={color} numberOfLines={1} variant="feedMeta">
            {like.countText}
          </AppText>
        </Pressable>
      ) : (
        <AppText color={color} numberOfLines={1} style={styles.label} variant="feedMeta">
          {like.text}
        </AppText>
      )}
    </Pressable>
  );
}

export function PostActionRow({
  like,
  commentsCount,
  onLike,
  onOpenLikes,
  onComment,
  onShare,
}: PostActionRowProps) {
  const liveCommentsCount = useCommentsCount(
    likeItemKey(like.contentType, like.postId),
    commentsCount,
  );
  const model = buildPostActionModel({
    commentsCount: liveCommentsCount,
    isLiked: false,
    likesCount: 0,
    contentType: like.contentType,
  });

  return (
    <View style={styles.row}>
      <LikeAction
        {...like}
        onOpenLikes={onOpenLikes}
        onToggle={onLike}
        testID="feed-post-action-like"
      />
      <PostActionButton
        accessibilityLabel={model.comment.accessibilityLabel}
        icon="chatbubble-outline"
        onPress={onComment}
        testID="feed-post-action-comment"
        text={model.comment.text}
      />
      {model.showShare ? (
        <PostActionButton
          accessibilityLabel={model.share.accessibilityLabel}
          icon="arrow-redo-outline"
          onPress={onShare}
          testID="feed-post-action-share"
          text={model.share.text}
        />
      ) : null}
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
  // §236: area del cuore ≥ 44×44 (paddingLeft 12 + icona 20 + gap 12 = 44).
  actionCompact: {
    flex: 0,
    gap: spacing[12],
    justifyContent: "flex-start",
    // Il margine negativo riporta il cuore sul filo del testo del commento
    // (mockup 1) senza rinunciare ai 44pt di tocco a sinistra.
    marginLeft: -spacing[12],
    minWidth: sizes.touchTarget,
    paddingLeft: spacing[12],
  },
  // Il numero: alto quanto la cella; la larghezza di tocco la dà `hitSlop`, così
  // il layout resta quello di HOM-02 (§28) e il numero resta vicino al cuore.
  count: {
    alignItems: "center",
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
