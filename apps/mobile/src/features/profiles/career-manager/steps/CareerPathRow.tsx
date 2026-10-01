/**
 * Riga di un percorso professionale aggiuntivo (REV-PROF-07, schermate 1 e 8).
 *
 * L'intera superficie è interattiva, il conteggio è dinamico e "Facoltativa"
 * resta un badge e non una riga di testo: è la stessa riga nell'hub e nella
 * schermata Percorsi aggiuntivi, con o senza titolo sopra al conteggio.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Badge } from "../../../../ui";
import type { CareerPathCopy } from "../career-manager-config";

type CareerPathRowProps = {
  /** Vedi `CareerPathCopy["icon"]`: la tassonomia delle icone vive lì. */
  icon: CareerPathCopy["icon"];
  onPress: () => void;
  /** Mostrato sotto al titolo quando c'è, al suo posto quando manca. */
  summary: string;
  /** Badge "Facoltativa": assente nella schermata che lo dichiara una volta sola. */
  showOptionalBadge?: boolean;
  testID?: string;
  title?: string;
};

export function CareerPathRow({
  icon,
  onPress,
  summary,
  showOptionalBadge = true,
  testID,
  title,
}: CareerPathRowProps) {
  const label = [title, summary, showOptionalBadge ? "facoltativa" : null]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityHint="Apre la gestione di questo percorso"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      testID={testID}
    >
      <View style={styles.icon}>
        <Ionicons color={colors.textSecondary} name={icon} size={20} />
      </View>

      <View style={styles.text}>
        {title ? <AppText variant="titleSm">{title}</AppText> : null}
        {title ? (
          <AppText color="secondary" variant="bodySm">
            {summary}
          </AppText>
        ) : (
          <AppText variant="titleSm">{summary}</AppText>
        )}
        {showOptionalBadge ? (
          <Badge label="Facoltativa" size="sm" variant="default" />
        ) : null}
      </View>

      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    alignItems: "center",
    width: 28,
  },
  text: {
    alignItems: "flex-start",
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
