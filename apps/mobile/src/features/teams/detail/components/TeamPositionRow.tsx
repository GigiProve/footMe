import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { positionRoleLabel } from "../team-detail-presentation";
import type { TeamPositionPreview } from "../team-detail-service";

/**
 * Riga di anteprima di una Posizione (§13).
 *
 * Quattro elementi e non uno di più: icona documento lineare, titolo scuro,
 * tipo di profilo grigio, chevron. §13 elenca ciò che **non** deve
 * comparire — scadenza, descrizione, requisiti, compensi, score, analytics,
 * conteggio delle candidature, badge verde "Aperta" — perché ognuno di
 * questi trasformerebbe l'anteprima in un secondo dettaglio.
 *
 * L'icona è neutra, non blu: §5 riserva l'accento ai link funzionali, alla
 * verifica reale, al retry e alla navigazione selezionata.
 *
 * Senza destinazione autorizzata la riga non è un pulsante e il chevron non
 * viene disegnato: una freccia inerte è una promessa non mantenuta (§35).
 */
export function TeamPositionRow({
  onPress,
  position,
  showDivider = false,
}: {
  onPress: (() => void) | null;
  position: TeamPositionPreview;
  showDivider?: boolean;
}) {
  const role = positionRoleLabel(position.targetRole);

  const body = (
    <>
      <Ionicons
        color={colors.textSecondary}
        name="document-text-outline"
        size={22}
      />

      <View style={styles.body}>
        <AppText numberOfLines={2} variant="titleMd">
          {position.title}
        </AppText>

        {role ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {role}
          </AppText>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  const label = [position.title, role].filter(Boolean).join(", ");

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      {onPress ? (
        <Pressable
          accessibilityLabel={`Apri posizione ${label}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          testID={`team-position-${position.id}`}
        >
          {body}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={label}
          style={styles.row}
          testID={`team-position-${position.id}`}
        >
          {body}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
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
