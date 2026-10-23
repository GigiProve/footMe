import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";
import {
  contextSummary,
  listNames,
  readinessActionLabel,
  readinessLabel,
  readinessOf,
} from "../compose-presentation";
import type { PositionDraft } from "../compose-types";

type Props = {
  draft: PositionDraft;
  onAction: () => void;
};

/**
 * Riga dell'hub «Configura le posizioni» (DAS-REV-16 §11, §12).
 *
 * Nessun conteggio di candidature qui: §11 riserva quel dato alle Position
 * già pubblicate, non a una bozza in composizione.
 */
export function DraftHubRow({ draft, onAction }: Props) {
  const readiness = readinessOf(draft);
  const title = draft.title ?? "Posizione senza titolo";
  const secondaryNames = draft.secondaryTeams.map((team) => team.name);

  return (
    <View style={styles.row}>
      <AppText color="neutral" variant="titleSm">
        {title}
      </AppText>

      <AppText color="neutralMuted" variant="bodySm">
        {contextSummary(draft)}
      </AppText>

      {secondaryNames.length > 0 ? (
        <AppText color="neutralMuted" variant="meta">
          {`Incarico: anche ${listNames(secondaryNames)}`}
        </AppText>
      ) : null}

      <View style={styles.statusRow}>
        {readiness !== "incomplete" ? (
          /* Il check è decorativo: §12/§34 vietano di esporre "Pronta" come
             controllo spuntabile. L'informazione completa sta nel testo. */
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.checkWrap}
          >
            <Ionicons color={colors.textNeutral} name="checkmark" size={14} />
          </View>
        ) : null}

        <AppText color="neutralMuted" variant="meta">
          {readinessLabel(readiness)}
        </AppText>
      </View>

      <Pressable
        accessibilityLabel={`${readinessActionLabel(readiness, draft.hasDetails)}: ${title}`}
        accessibilityRole="button"
        hitSlop={spacing[8]}
        onPress={onAction}
        style={styles.action}
      >
        <AppText color="accent" variant="actionLabel">
          {readinessActionLabel(readiness, draft.hasDetails)}
        </AppText>
        <Ionicons color={colors.accent} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  checkWrap: {
    marginRight: spacing[4],
  },
  row: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingVertical: spacing[14],
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
