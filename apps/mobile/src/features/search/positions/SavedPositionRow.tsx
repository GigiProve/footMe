import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing, typography } from "../../../theme/tokens";
import { Avatar, AppText } from "../../../ui";
import { getPlayerPositionLabel } from "../../profiles/player-sports";
import {
  formatSavedAtLabel,
  formatUnavailableLabel,
  NO_DETAIL_LABEL,
} from "../../dashboard/personal/saved-positions-presentation";
import type { SavedPositionRow as SavedPosition } from "./saved-positions-service";

type SavedPositionRowProps = {
  /** `null` quando il dettaglio non esiste o non è accessibile (§16). */
  onPress: (() => void) | null;
  onToggleSaved: () => void;
  row: SavedPosition;
};

/**
 * Riga della lista Salvate (DAS-REV-05 §16).
 *
 * Una riga sola per i due gruppi: cambiano i metadati, non il trattamento.
 * §16 vieta testo barrato, opacità generale, rosso dominante, icona cestino e
 * grandi pill per lo storico — una posizione chiusa resta leggibile come le
 * altre.
 *
 * Quando il dettaglio non è accessibile la riga **non** è un link: niente
 * chevron, niente `accessibilityRole="button"` sul corpo, e il bookmark resta
 * un controllo attivo e raggiungibile.
 */
export function SavedPositionRow({
  onPress,
  onToggleSaved,
  row,
}: SavedPositionRowProps) {
  const meta = [row.clubName, row.teamName, row.category]
    .map((part) => part?.trim())
    .filter((part, index, parts) =>
      Boolean(part) && parts.indexOf(part) === index,
    )
    .join(" · ");

  // §17: la data di chiusura quando è affidabile; altrimenti la data di
  // salvataggio con la propria label, mai travestita da data di chiusura.
  const unavailableLine =
    row.group === "unavailable"
      ? row.unavailableAt
        ? formatUnavailableLabel(row.unavailableAt)
        : [formatUnavailableLabel(null), formatSavedAtLabel(row.savedAt)]
            .filter(Boolean)
            .join(" · ")
      : null;

  const body = (
    <>
      <Avatar name={row.clubName} size="md" square uri={row.clubLogoUrl} />

      <View style={styles.body}>
        <AppText numberOfLines={2} style={styles.role} variant="titleSm">
          {getPlayerPositionLabel(row.role, row.role)}
        </AppText>

        {meta ? (
          <AppText color="secondary" numberOfLines={2} variant="bodySm">
            {meta}
          </AppText>
        ) : null}

        {row.location ? (
          <AppText color="muted" numberOfLines={2} variant="bodySm">
            {row.location}
          </AppText>
        ) : null}

        {unavailableLine ? (
          <AppText color="muted" numberOfLines={2} variant="caption">
            {unavailableLine}
          </AppText>
        ) : null}

        {/* §11: metadato secondario della lista completa. Non è uno stato
            Position e non sposta la row fra i gruppi. */}
        {row.group === "available" && row.hasApplied ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            Candidatura inviata
          </AppText>
        ) : null}

        {/* §16: la row senza destinazione lo dichiara, invece di aprire un
            errore. Il bookmark resta utilizzabile. */}
        {onPress ? null : (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {NO_DETAIL_LABEL}
          </AppText>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.main}>{body}</View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Rimuovi dai salvati: ${getPlayerPositionLabel(
            row.role,
            row.role,
          )}`}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onToggleSaved}
          style={styles.bookmark}
        >
          {/* §10: la risorsa è nei Salvati, quindi il controllo è nello stato
              salvato. Un'icona che sembri non selezionata mentirebbe. */}
          <Ionicons color={colors.accent} name="bookmark" size={20} />
        </Pressable>

        {onPress ? (
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  bookmark: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
  },
  role: {
    fontWeight: typography.fontWeight.semibold,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
  },
});
