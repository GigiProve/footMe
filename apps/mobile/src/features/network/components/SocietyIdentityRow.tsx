import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import type { SocietySummary } from "../network-types";

type Props = {
  /** "Società", "Società destinataria", "Cantù, CO". */
  subtitle?: string | null;
  society: SocietySummary;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Identità di una Società: stemma, nome, verifica reale, riga di contesto.
 *
 * §8: «Ogni Society usa il proprio stemma. Non applicare l'eredità dello
 * stemma Team→club tra Society diverse. Se assente, omettere l'immagine
 * mantenendo un allineamento leggibile; niente scudo generico o verifica
 * inventata.» `Avatar` senza `uri` disegna le iniziali del nome, che è
 * esattamente «omettere l'immagine» senza rompere l'allineamento.
 *
 * Il check compare solo quando la verifica è reale, e il blu che lo colora è
 * un accento funzionale previsto da §3 — non una decorazione.
 */
export function SocietyIdentityRow({ society, style, subtitle, testID }: Props) {
  return (
    <View style={[styles.row, style]} testID={testID}>
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
            variant="titleMd"
          >
            {society.name}
          </AppText>

          {society.isVerified ? (
            <Ionicons
              accessibilityLabel="Società verificata"
              color={colors.accent}
              name="checkmark-circle"
              size={16}
            />
          ) : null}
        </View>

        {subtitle ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
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
});
