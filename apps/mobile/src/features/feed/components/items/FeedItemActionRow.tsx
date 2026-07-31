/**
 * Riga azioni del post (§10): Mi piace · Commenta · Condividi, più il
 * segnalibro.
 *
 * Il §29 esclude da questo blocco il sistema Mi piace, i commenti e la
 * condivisione, ma il §10 chiede che la riga sia presente e leggibile. La
 * soluzione: controlli pienamente visibili e attivi, il cui tap risponde con un
 * messaggio esplicito ("I commenti arriveranno presto."). Niente contatori,
 * niente reaction picker, niente share sheet, nessuna scrittura.
 *
 * Il segnalibro nella stessa riga FUNZIONA davvero e si colora di accent quando
 * è attivo, così la riga ha almeno un'azione reale e la differenza tra "in
 * arrivo" e "operativo" è visibile.
 *
 * Scartate: disabilitare i controlli con opacità ridotta (in QA si legge come un
 * difetto) e navigare al dettaglio (il tap farebbe una cosa diversa
 * dall'etichetta).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, useToast } from "../../../../ui";
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
        icon="thumbs-up-outline"
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
        hitSlop={10}
        onPress={onToggleSaved}
        style={styles.bookmark}
      >
        <Ionicons
          color={isSaved ? colors.accent : colors.textMuted}
          name={isSaved ? "bookmark" : "bookmark-outline"}
          size={18}
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
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={16} />
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    paddingVertical: spacing[6],
  },
  bookmark: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
    paddingVertical: spacing[6],
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[18],
    marginTop: spacing[10],
    paddingTop: spacing[6],
  },
});
