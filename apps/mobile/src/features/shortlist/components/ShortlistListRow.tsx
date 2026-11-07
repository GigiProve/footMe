import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Badge, ListItem } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import { type ClubShortlist } from "../shortlist-service";
import { formatListSubtitle } from "../shortlist-display-helpers";

type ShortlistListRowProps = {
  list: ClubShortlist;
};

export function ShortlistListRow({ list }: ShortlistListRowProps) {
  const router = useRouter();

  return (
    <ListItem
      onPress={() => router.push(`/shortlist/${list.id}` as never)}
      right={
        <View style={styles.right}>
          {/* DAS-REV-24 §22: l'etichetta la risolve il server da `team_id`, con
              il valore storico come fallback. `getScopeLabel` leggeva i
              cinque token del 2026-07, che non descrivono più il
              perimetro reale. */}
          <Badge label={list.scope_label} variant="accent" />
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        </View>
      }
      subtitle={formatListSubtitle(list)}
      title={list.name}
    />
  );
}

const styles = StyleSheet.create({
  right: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
});
