import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";

type Props = {
  avatarUrl?: string | null;
  /** "Dirigente", "Direttore sportivo": il ruolo, mai un id. */
  meta?: string | null;
  /** "Intera società", "Ambito: Under 18": il perimetro, su riga propria. */
  note?: string | null;
  onPress?: () => void;
  showDivider?: boolean;
  /** "Già amministratore", "Invito inviato": testo, non badge (§8). */
  status?: string | null;
  testID?: string;
  title: string;
};

/**
 * Riga persona del Centro Amministratori e della ricerca.
 *
 * Non riusa `DashboardEntityRow`: quella mette lo stato in colonna destra
 * insieme a una data e prevede un bookmark, e qui §4 vieta sia la seconda
 * azione sia qualunque pastiglia colorata per i pending.
 *
 * Senza `onPress` la riga non è un pulsante e non ha chevron: §31 chiede che
 * «elementi non selezionabili» siano annunciati correttamente, «senza finti
 * link». È il caso di "Già amministratore" e "Invito già inviato".
 */
export function AdminPersonRow({
  avatarUrl,
  meta,
  note,
  onPress,
  showDivider = false,
  status,
  testID,
  title,
}: Props) {
  const body = (
    <View style={styles.row}>
      <Avatar name={title} size="sm" uri={avatarUrl ?? undefined} />

      <View style={styles.main}>
        <AppText color="neutral" numberOfLines={2} variant="bodyLg">
          {title}
        </AppText>

        {meta ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="meta">
            {meta}
          </AppText>
        ) : null}

        {note ? (
          <AppText color="neutralSoft" numberOfLines={2} variant="meta">
            {note}
          </AppText>
        ) : null}
      </View>

      {status ? (
        <AppText
          color="neutralMuted"
          numberOfLines={2}
          style={styles.status}
          variant="meta"
        >
          {status}
        </AppText>
      ) : null}

      {onPress ? (
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      ) : null}
    </View>
  );

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      {onPress ? (
        <Pressable
          accessibilityLabel={[title, meta, note, status]
            .filter(Boolean)
            .join(". ")}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID={testID}
        >
          {body}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={[title, meta, note, status]
            .filter(Boolean)
            .join(". ")}
          accessible
          testID={testID}
        >
          {body}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[8],
  },
  main: {
    flex: 1,
    gap: spacing[4],
  },
  status: {
    flexShrink: 0,
    maxWidth: 140,
    textAlign: "right",
  },
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
