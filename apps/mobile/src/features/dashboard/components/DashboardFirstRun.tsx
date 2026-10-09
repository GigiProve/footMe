import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

export type FirstRunProposal = {
  actionLabel: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  onPress: () => void;
  title: string;
};

type Props = {
  /** Al massimo due, già filtrate per capability e disponibilità (§18). */
  proposals: FirstRunProposal[];
};

/**
 * Primo utilizzo della Dashboard Società (DAS-REV-07 §18, master 04).
 *
 * Non è il Global Empty: lì la Dashboard dice che non c'è nulla da mostrare,
 * qui propone le due prime azioni sensate di un club appena attivato. §18
 * vieta esplicitamente l'alternativa facile — «riepiloghi pieni di zeri, Da
 * gestire vuoto, progress bar, percentuali di completezza, tutorial
 * obbligatori o CTA rapide duplicate».
 *
 * Le proposte **sono** le azioni rapide di questo stato: §11 chiede di non
 * ripetere le stesse CTA in una sezione "Azioni rapide" sopra o sotto.
 *
 * Con una sola proposta autorizzata se ne mostra una: la seconda non diventa
 * un pulsante disabilitato che pubblicizza un permesso mancante.
 */
export function DashboardFirstRun({ proposals }: Props) {
  if (proposals.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <AppText accessibilityRole="header" variant="headingSm">
        Inizia da qui
      </AppText>

      <View style={styles.list}>
        {proposals.slice(0, 2).map((proposal) => (
          <View key={proposal.id} style={styles.card}>
            <View style={styles.headingRow}>
              <Ionicons
                color={colors.textPrimary}
                name={proposal.icon}
                size={22}
              />
              <AppText style={styles.title} variant="titleMd">
                {proposal.title}
              </AppText>
            </View>

            <AppText color="secondary" variant="bodySm">
              {proposal.body}
            </AppText>

            <Button
              label={proposal.actionLabel}
              onPress={proposal.onPress}
              size="md"
              style={styles.action}
              variant="primary"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[12],
  },
  list: {
    gap: spacing[12],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
  },
  title: {
    flexShrink: 1,
  },
  // Il pulsante non occupa la riga intera: resta una proposta, non un passo
  // obbligatorio di un wizard.
  action: {
    alignSelf: "flex-start",
    marginTop: spacing[4],
  },
});
