import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";

type Props = {
  /** Terza riga: "Conclusa", "Squadra non attiva". Stato testuale neutro (§4). */
  statusLabel?: string | null;
  /** Il check appartiene alla Società, mai alla squadra (§10). */
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  subtitle: string;
};

/**
 * Identità in testa a ogni schermata di Stagioni e storico.
 *
 * Una sola forma per le dieci: stemma, nome, riga di contesto, stato. Il
 * check di verifica compare **solo** accanto alla Società (§10: «La verifica
 * appartiene soltanto alla Società»), quindi nel contesto squadra sta sulla
 * parola "AC Como" della riga sotto, dove il mockup lo disegna.
 *
 * Testo nero neutro e metadati grigi neutri (§4): questa è la superficie in
 * cui il vincolo cromatico si vede per primo, perché è l'unica ripetuta in
 * tutte le schermate.
 */
export function SeasonsIdentityHeader({
  isVerified,
  logoUrl,
  name,
  statusLabel,
  subtitle,
}: Props) {
  return (
    <View style={styles.row}>
      <Avatar name={name} size="md" square tone="ink" uri={logoUrl ?? undefined} />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText
            color="neutral"
            numberOfLines={1}
            style={styles.name}
            variant="titleMd"
          >
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

        <AppText color="neutralMuted" numberOfLines={1} variant="meta">
          {subtitle}
        </AppText>

        {statusLabel ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {statusLabel}
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
});
