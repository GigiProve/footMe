import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import {
  IDENTITY_KIND_LABELS,
  type DashboardIdentity,
} from "../dashboard-types";

type Props = {
  identity: DashboardIdentity;
  /** true quando esistono più identità eleggibili: la riga apre il selector. */
  selectable: boolean;
  onPress?: () => void;
};

/**
 * Contesto identità sotto il titolo "Dashboard" (master 02 e 03).
 *
 * La riga è statica o selezionabile in base al **numero di identità
 * eleggibili**, non al ruolo dell'actor: nel master 03 AC Como non ha chevron
 * perché quell'actor ha una sola Dashboard, non perché si occupi di contenuti.
 *
 * Il check di verifica sta accanto al nome ed è un'informazione sull'identità.
 * Non va confuso con il check di selezione del selector, che sta a destra e
 * parla dello stato della lista.
 */
export function DashboardIdentityRow({ identity, selectable, onPress }: Props) {
  const typeLabel = IDENTITY_KIND_LABELS[identity.kind];

  const content = (
    <>
      <Avatar
        name={identity.name}
        size="md"
        square={identity.kind !== "person"}
        uri={identity.avatarUrl ?? undefined}
      />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText numberOfLines={1} style={styles.name} variant="titleMd">
            {identity.name}
          </AppText>
          {identity.isVerified ? (
            <Ionicons
              accessibilityLabel="Identità verificata"
              color={colors.accent}
              name="checkmark-circle"
              size={16}
            />
          ) : null}
        </View>

        <AppText color="secondary" numberOfLines={1} variant="meta">
          {typeLabel}
        </AppText>

        {identity.scopeLabel ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {`Ambito: ${identity.scopeLabel}`}
          </AppText>
        ) : null}
      </View>

      {selectable ? (
        <Ionicons color={colors.textSecondary} name="chevron-down" size={20} />
      ) : null}
    </>
  );

  if (!selectable) {
    // Senza alternative la riga non è interattiva: niente ripple, niente
    // ruolo button, niente promessa di un'azione che non esiste.
    return (
      <View accessibilityRole="header" style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint="Apre l'elenco delle Dashboard disponibili"
      accessibilityLabel={`Dashboard di ${identity.name}, ${typeLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
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
