import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type Props = {
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  /** "Ambito: Primavera". Informazione, non filtro (§5, §11). */
  scopeLabel: string | null;
  seasonLabel: string | null;
};

/**
 * Contesto della Società nel Centro Squadre (§5).
 *
 * «La Società resta l'identità operativa … Mostrare il contesto parent con
 * nome e logo reali. Il check di verifica appartiene alla Società, non viene
 * ereditato dai Team.» Il badge sta quindi qui e in nessuna riga.
 *
 * `Ambito:` e la stagione sono due bande informative, non tappabili e non
 * selezionabili: §4 vieta «un filtro squadra sopra l'intera sezione», e un
 * picker di stagione (§7).
 */
export function TeamsContextHeader({
  isVerified,
  logoUrl,
  name,
  scopeLabel,
  seasonLabel,
}: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.identity}>
        <Avatar name={name} size="md" square tone="ink" uri={logoUrl ?? undefined} />

        <View style={styles.identityBody}>
          <View style={styles.nameRow}>
            <AppText numberOfLines={1} style={styles.name} variant="titleMd">
              {name}
            </AppText>

            {isVerified ? (
              <Ionicons
                accessibilityLabel="Società verificata"
                color={colors.accent}
                name="checkmark-circle"
                size={16}
              />
            ) : null}
          </View>

          <AppText color="secondary" variant="meta">
            Società
          </AppText>
        </View>
      </View>

      {scopeLabel ? (
        <View style={styles.band} testID="teams-scope-band">
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {`Ambito: ${scopeLabel}`}
          </AppText>
        </View>
      ) : null}

      {seasonLabel ? (
        <View style={styles.band} testID="teams-season-band">
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {`Stagione ${seasonLabel}`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  identityBody: {
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
  band: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
});
