import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  /** Label completa per lo screen reader: "4 amministratori attivi". */
  accessibilityLabel?: string;
  children?: ReactNode;
  /** Conteggio compatto a destra del titolo. `null` = non leggibile (§7.3). */
  count?: string | null;
  title: string;
};

/**
 * Sezione del Centro Amministratori (§7).
 *
 * Il master mette il conteggio **a destra del titolo**, non sotto: è la sola
 * differenza rispetto a `StructureSection`, e basta a renderla un componente
 * proprio invece di un parametro in più su quello dell'hub.
 *
 * Titolo e count sono un unico nodo accessibile: §31 chiede che lo stato sia
 * annunciato insieme alla sezione a cui appartiene, non come numero isolato.
 */
export function AdminSection({
  accessibilityLabel,
  children,
  count,
  title,
}: Props) {
  return (
    <View style={styles.block}>
      <View
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="header"
        style={styles.header}
      >
        <AppText color="neutral" style={styles.title} variant="headingSm">
          {title}
        </AppText>

        {count !== null && count !== undefined ? (
          <AppText color="neutralMuted" variant="meta">
            {count}
          </AppText>
        ) : null}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[4],
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
  title: {
    flex: 1,
  },
});
