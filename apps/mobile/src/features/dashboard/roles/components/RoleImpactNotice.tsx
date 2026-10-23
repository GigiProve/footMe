import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { AREA_LEVEL_LABEL } from "../permission-catalog";
import { ROLES_COPY, levelTransition, roleImpactLabel } from "../roles-presentation";
import type { AreaLevelChange } from "../roles-types";

type Props = {
  adminsCount: number;
  changes: AreaLevelChange[];
};

export function RoleImpactNotice({ adminsCount, changes }: Props) {
  if (changes.length === 0 && adminsCount === 0) {
    return null;
  }

  const impact = roleImpactLabel(adminsCount);

  return (
    <View style={styles.box}>
      <Ionicons
        color={colors.textNeutralMuted}
        name="information-circle-outline"
        size={20}
      />
      <View style={styles.content}>
        <AppText color="neutral" variant="metaStrong">
          {ROLES_COPY.impactTitle}
        </AppText>
        {changes.map((change) => (
          <View key={change.areaId} style={styles.change}>
            <AppText color="neutral" variant="bodySm">
              {change.areaLabel}
            </AppText>
            {change.details.length > 0 ? (
              change.details.map((detail, index) => (
                <AppText
                  color="neutralMuted"
                  key={`${change.areaId}-${index}`}
                  variant="meta"
                >
                  {detail}
                </AppText>
              ))
            ) : (
              <AppText color="neutralMuted" variant="meta">
                {levelTransition(
                  change.previous,
                  change.next,
                  (level) => AREA_LEVEL_LABEL[level],
                )}
              </AppText>
            )}
          </View>
        ))}
        {impact ? (
          <AppText color="neutralMuted" variant="meta">
            {impact}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceNeutral,
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[12],
  },
  content: {
    flex: 1,
    gap: spacing[6],
  },
  change: {
    gap: spacing[4],
  },
});
