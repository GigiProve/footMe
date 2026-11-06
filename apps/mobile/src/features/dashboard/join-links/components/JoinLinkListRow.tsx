/**
 * Riga del Centro Link di invito (§5, §10).
 *
 * Squadra, audience e stato sobrio: nessun URL, nessun contatore di
 * aperture, nessuna CTR, nessuna progress bar, nessun badge colorato.
 * L'intera riga è il target di tocco.
 */
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import { audienceSummary, rowStateLine } from "../join-links-presentation";
import type { JoinLinkRow } from "../join-links-types";

type JoinLinkListRowProps = {
  onPress: () => void;
  row: JoinLinkRow;
  showDivider?: boolean;
};

export function JoinLinkListRow({ onPress, row, showDivider = true }: JoinLinkListRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.container, showDivider ? styles.divider : null]}
      testID={`join-link-row-${row.id}`}
    >
      <View style={styles.text}>
        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {row.teamName}
        </AppText>
        <AppText color="neutralMuted" numberOfLines={1} style={styles.spaced} variant="bodySm">
          {audienceSummary(row.allowedProfileTypes)}
        </AppText>
        <AppText color="neutralSoft" numberOfLines={1} style={styles.spaced} variant="meta">
          {rowStateLine(row)}
        </AppText>
      </View>
      <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing[14],
  },
  divider: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    paddingRight: spacing[12],
  },
  spaced: {
    marginTop: spacing[4],
  },
});
