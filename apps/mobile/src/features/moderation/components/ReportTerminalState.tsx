/**
 * Gli stati terminali del flow Segnala (HOM-11 §114–§122, §127, §159–§160, §204,
 * §215–§216, mockup 7): segnalazione inviata, già segnalato, contenuto non più
 * disponibile, segnalazione non ammessa.
 *
 * Calmo e professionale (§215): un'icona sobria — per il successo un segno di spunta
 * in un cerchio a velatura, non un verde saturo (§216) —, un titolo, e una sola CTA
 * «Fine» che riporta all'origine senza forzare la Home (§116–§117). Il copy non
 * promette alcun provvedimento (§120–§121) e non c'è nessun Annulla (§122): una
 * segnalazione non si ritira da qui.
 *
 * L'esito si annuncia da solo (§204) e la CTA sta a 44pt (§206).
 */

import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  REPORT_DONE,
  REPORT_SUCCESS_BODY,
  phaseAnnouncement,
  terminalTitle,
} from "../moderation-presentation";
import type { ReportPhase, ReportTargetType } from "../moderation-types";

type ReportTerminalStateProps = {
  phase: ReportPhase;
  targetType: ReportTargetType;
  onDone: () => void;
};

export function ReportTerminalState({ onDone, phase, targetType }: ReportTerminalStateProps) {
  const title = terminalTitle(phase, targetType);
  const isSuccess = phase === "success";

  useEffect(() => {
    const announcement = phaseAnnouncement(phase, targetType);
    if (announcement) {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [phase, targetType]);

  if (!title) {
    return null;
  }

  return (
    <View style={styles.root} testID={`report-terminal-${phase}`}>
      <View style={styles.center}>
        {isSuccess ? (
          <View style={styles.successCircle}>
            <Ionicons color={colors.successForeground} name="checkmark" size={36} />
          </View>
        ) : (
          <Ionicons color={colors.textSecondary} name="information-circle-outline" size={48} />
        )}
        <AppText accessibilityRole="header" align="center" variant="headingMd">
          {title}
        </AppText>
        {isSuccess ? (
          <AppText align="center" color="secondary" variant="bodyLg">
            {REPORT_SUCCESS_BODY}
          </AppText>
        ) : null}
      </View>

      <Button fullWidth label={REPORT_DONE} onPress={onDone} size="lg" testID="report-done" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    paddingHorizontal: spacing[16],
  },
  root: {
    flex: 1,
    gap: spacing[16],
    minHeight: sizes.touchTarget,
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[20],
  },
  successCircle: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: radius.full,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
});
