/**
 * Riga «Pubblicazione · Ora ›» del composer Post e dell'editor Articolo
 * (HOM-06.2 §81, §84–§85, §91; mockup 2–3). Compare solo con
 * can_schedule_content (§84–§85): senza, il chiamante non la monta e la CTA
 * resta «Pubblica».
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import { formatScheduleAccessible, publicationRowLabel } from "../publishing-presentation";
import type { Publication } from "../publishing-types";

type Props = {
  publication: Publication;
  onPress: () => void;
  disabled?: boolean;
  /** Nota sotto la riga, es. «Preparazione del video in corso» (§108). */
  note?: string | null;
};

export function PublicationRow({ publication, onPress, disabled = false, note = null }: Props) {
  const scheduled = publication.mode === "scheduled";
  return (
    <View>
      <Pressable
        accessibilityHint="Scegli quando pubblicare"
        accessibilityLabel={scheduled ? formatScheduleAccessible(publication.scheduledAt) : "Pubblicazione: ora"}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID="publication-row"
      >
        <Ionicons color={colors.textPrimary} name={scheduled ? "calendar-outline" : "time-outline"} size={20} />
        <AppText style={styles.label} variant="bodySm">
          {publicationRowLabel(publication)}
        </AppText>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </Pressable>
      {note ? (
        <AppText color="muted" style={styles.note} variant="caption">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  note: {
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[16],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
