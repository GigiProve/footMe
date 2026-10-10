import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import type { SocietySummary } from "../network-types";

type Props = {
  disabled?: boolean;
  /** Terza riga: "Affiliata ad AC Como", "Partnership · In attesa". */
  detail?: string | null;
  onPress?: () => void;
  /** "Cantù, CO" */
  location?: string | null;
  showChevron?: boolean;
  society: SocietySummary;
  testID?: string;
};

/**
 * Riga di elenco di una Società (screen 01, 02, 03, 10).
 *
 * Una sola forma per le quattro superfici. §8 descrive «stemma effettivo
 * della controparte, nome, eventuale verifica reale, località sintetica,
 * relazione in secondo piano e chevron»: `detail` è quella relazione, e
 * arriva già composta dal backend — il renderer non la deduce.
 *
 * La riga legge per intero a VoiceOver: §32 chiede che «le righe devono
 * leggere nome, località, relazione/stato e azione».
 */
export function SocietyListRow({
  detail,
  disabled = false,
  location,
  onPress,
  showChevron = true,
  society,
  testID,
}: Props) {
  const label = [society.name, location, detail]
    .filter((part): part is string => !!part)
    .join(". ");

  const content = (
    <>
      <Avatar
        name={society.name}
        size="md"
        square
        tone="ink"
        uri={society.logoUrl ?? undefined}
      />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText
            color="neutral"
            numberOfLines={1}
            style={styles.name}
            variant="titleSm"
          >
            {society.name}
          </AppText>

          {society.isVerified ? (
            <Ionicons
              accessibilityLabel="Società verificata"
              color={colors.accent}
              name="checkmark-circle"
              size={15}
            />
          ) : null}
        </View>

        {location ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {location}
          </AppText>
        ) : null}

        {detail ? (
          <AppText color="neutralSoft" numberOfLines={2} variant="meta">
            {detail}
          </AppText>
        ) : null}
      </View>

      {showChevron && onPress ? (
        <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  if (!onPress || disabled) {
    return (
      <View accessibilityLabel={label} style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  name: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
