import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type Props = {
  isVerified: boolean;
  /** "Società" nel contesto gestionale, "Società invitante" sulla ricezione. */
  kindLabel?: string;
  logoUrl: string | null;
  name: string;
  /** "Ambito: Primavera". Informazione, non un controllo. */
  scopeLabel?: string | null;
  testID?: string;
};

/**
 * Identità compatta della Società in testa a una pagina gestionale.
 *
 * Nasce inline nell'hub Struttura societaria (DAS-REV-12 §6) ed è estratta
 * qui perché DAS-REV-13 la ripete su cinque schermate — centro, ricerca,
 * composer, invito esterno, ricezione. DAS-REV-13 §6 chiede che la Society
 * sia «la stessa Society canonica» ovunque: una sola riga la rende tale
 * anche visivamente.
 *
 * `kindLabel` esiste perché la ricezione non è il contesto gestionale: §6
 * vieta di «selezionare implicitamente AC Como come identità amministrativa
 * del destinatario prima dell'accettazione», e lì la label è «Società
 * invitante».
 */
export function SocietyIdentityHeader({
  isVerified,
  kindLabel = "Società",
  logoUrl,
  name,
  scopeLabel,
  testID,
}: Props) {
  return (
    <View>
      <View style={styles.identity} testID={testID}>
        <Avatar
          name={name}
          size="md"
          square
          tone="ink"
          uri={logoUrl ?? undefined}
        />

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText
              color="neutral"
              numberOfLines={2}
              style={styles.name}
              variant="titleMd"
            >
              {name}
            </AppText>

            {/* Il check compare solo per una verifica reale (§4). */}
            {isVerified ? (
              <Ionicons
                accessibilityLabel="Società verificata"
                color={colors.accent}
                name="checkmark-circle"
                size={16}
              />
            ) : null}
          </View>

          <AppText color="neutralMuted" variant="meta">
            {kindLabel}
          </AppText>
        </View>
      </View>

      {scopeLabel ? (
        <AppText color="neutralMuted" style={styles.scope} variant="meta">
          {`Ambito: ${scopeLabel}`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
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
  scope: {
    marginTop: spacing[8],
  },
});
