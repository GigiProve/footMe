/**
 * Riga interazioni di un elemento del Feed (HOM-01.1 §10, §17).
 *
 * Da HOM-02 il Post NON usa più questa riga (ha `PostActionRow`: tre aree
 * uguali, conteggi integrati, nessun segnalibro, §62). Resta per gli elementi
 * editoriali, il cui segnalibro visibile appartiene a HOM-03 (§63).
 *
 * Icone sole, azioni a sinistra e salva a destra, rail fisso a 44px. Il
 * visual master mostra numeri accanto alle icone, ma il Feed non ha contatori
 * di interazione e Mi piace / Commenti / Repost / Condivisione sono fuori
 * scope (§80): un mockup non introduce un contatore, quindi qui non ce ne
 * sono.
 *
 * Senza hairline sopra: nel visual master la riga chiude il post e la linea
 * che segue è il divider fra elementi (§10, §63) — due hairline a 44px di
 * distanza disegnerebbero di nuovo una card.
 *
 * I tre controlli "in arrivo" restano attivi e rispondono con un messaggio
 * esplicito, come in HOM-01: nessun tap morto, nessuna scrittura. Il
 * segnalibro funziona davvero e si colora di accent quando è attivo.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { useToast } from "../../../../ui";
import {
  FEED_ACTION_COMMENT,
  FEED_ACTION_LIKE,
  FEED_ACTION_SHARE,
  FEED_SOON_MESSAGES,
} from "../../feed-labels";

type FeedItemActionRowProps = {
  isSaved: boolean;
  onToggleSaved: () => void;
};

export function FeedItemActionRow({ isSaved, onToggleSaved }: FeedItemActionRowProps) {
  const { showToast } = useToast();

  return (
    <View style={styles.row}>
      <Action
        icon="heart-outline"
        label={FEED_ACTION_LIKE}
        onPress={() => showToast({ message: FEED_SOON_MESSAGES.like })}
      />
      <Action
        icon="chatbubble-outline"
        label={FEED_ACTION_COMMENT}
        onPress={() => showToast({ message: FEED_SOON_MESSAGES.comment })}
      />
      <Action
        icon="arrow-redo-outline"
        label={FEED_ACTION_SHARE}
        onPress={() => showToast({ message: FEED_SOON_MESSAGES.share })}
      />

      <Pressable
        accessibilityLabel={isSaved ? "Rimuovi dai salvati" : "Salva contenuto"}
        accessibilityRole="button"
        accessibilityState={{ selected: isSaved }}
        onPress={onToggleSaved}
        style={[styles.action, styles.bookmark]}
      >
        <Ionicons
          color={isSaved ? colors.accent : colors.textSecondary}
          name={isSaved ? "bookmark" : "bookmark-outline"}
          size={20}
        />
      </Pressable>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Ogni icona ha un'area di tocco 44×44 (§67), anche se ne disegna 20.
  action: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  bookmark: {
    marginLeft: "auto",
  },
  pressed: {
    opacity: 0.6,
  },
  // L'area di tocco sporge di 12px oltre l'icona: il margine negativo
  // riallinea la prima e l'ultima icona al bordo del testo.
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
    height: sizes.actionRail,
    marginHorizontal: -12,
    marginTop: spacing[4],
  },
});
