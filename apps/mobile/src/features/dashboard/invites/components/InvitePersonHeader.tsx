import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";

type Props = {
  avatarUrl: string | null;
  name: string;
  /** Contesto professionale. Omesso dove ripeterebbe il Collegamento (§23). */
  subtitle?: string | null;
};

/**
 * Riga identità della persona nel composer e nel dettaglio (§19, §23).
 *
 * §23: «Il ruolo è già presente nel Collegamento: non ripeterlo inutilmente
 * nel riepilogo Persona.» Il sottotitolo è quindi opzionale, e il riepilogo
 * lo omette.
 */
export function InvitePersonHeader({ avatarUrl, name, subtitle }: Props) {
  return (
    <View accessible accessibilityLabel={[name, subtitle].filter(Boolean).join(", ")} style={styles.row}>
      <Avatar name={name} size="md" uri={avatarUrl ?? undefined} />

      <View style={styles.body}>
        <AppText color="neutral" numberOfLines={1} style={styles.name} variant="titleSm">
          {name}
        </AppText>

        {subtitle ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="bodySm">
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
    paddingVertical: spacing[8],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  name: {
    fontWeight: "600",
  },
});
