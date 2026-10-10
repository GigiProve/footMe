import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

/**
 * Riga del Gruppo squadra (§17).
 *
 * **L'intera riga apre il Gruppo**: nel mockup non esiste un secondo
 * pulsante "Apri gruppo" e §17 vieta di aggiungerlo. Il testo visibile è il
 * solo nome, quindi la label accessibile esplicita l'azione — «Apri gruppo
 * Comashi».
 *
 * Non compaiono ultimo messaggio, unread, anteprime testuali o elenco dei
 * partecipanti: il dettaglio non incorpora una conversazione e non duplica i
 * badge di Messaggi o del Centro Notifiche.
 *
 * Il conteggio dei membri proviene dal Gruppo ed è facoltativo: non si
 * calcola sommando calciatori e staff, perché le due popolazioni possono
 * differire.
 */
export function TeamGroupRow({
  memberCount,
  onPress,
  title,
}: {
  memberCount: number | null;
  /** `null` quando la conversazione non è consultabile dall'actor (§17). */
  onPress: (() => void) | null;
  title: string;
}) {
  const members =
    memberCount === null
      ? null
      : `${memberCount} ${memberCount === 1 ? "membro" : "membri"}`;

  const body = (
    <>
      <Ionicons color={colors.textSecondary} name="people-outline" size={22} />

      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleMd">
          {title}
        </AppText>

        {members ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {members}
          </AppText>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={title} style={styles.row} testID="team-group-row">
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`Apri gruppo ${title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID="team-group-row"
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
    paddingVertical: spacing[8],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
});
