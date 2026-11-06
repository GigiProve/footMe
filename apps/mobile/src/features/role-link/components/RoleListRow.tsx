import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  /** `null` quando la riga non è tappabile per i permessi dell'actor. */
  onPress?: (() => void) | null;
  showDivider?: boolean;
  subtitle: string | null;
  testID?: string;
  title: string;
};

/**
 * Riga di un incarico corrente (§27, screen 14, 18, 21).
 *
 * «Ogni riga identifica chiaramente categoria/ruolo specifico e squadra
 * oppure Intera società, con tap verso il singolo dettaglio.»
 *
 * §27: «Le righe possono crescere per label lunghe; il contesto non deve
 * essere perso con ellissi che rendono identiche due squadre.» Il
 * sottotitolo va quindi a capo invece di troncare: "Under 17 Regionale" e
 * "Under 17 Provinciale" non devono diventare la stessa riga.
 */
export function RoleListRow({
  onPress,
  showDivider = false,
  subtitle,
  testID,
  title,
}: Props) {
  const content = (
    <View style={styles.row}>
      <View style={styles.body}>
        <AppText color="neutral" variant="bodyLg">
          {title}
        </AppText>

        {subtitle ? (
          <AppText color="neutralMuted" variant="meta">
            {subtitle}
          </AppText>
        ) : null}
      </View>

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
    <View style={showDivider ? styles.divided : null}>
      {onPress ? (
        <Pressable
          accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID={testID}
        >
          {content}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}
          testID={testID}
        >
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
