import { StyleSheet, View } from "react-native";

import { DateSelector } from "./DateSelector";
import type { DateSelectorMode } from "./date-selector-utils";
import { ToggleRow } from "./ToggleRow";
import { onboardingLayout } from "./onboarding-tokens";

type PeriodFieldProps = {
  startLabel?: string;
  endLabel?: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  mode?: DateSelectorMode;
  /**
   * Stato "In corso": quando è attivo la data di fine non viene chiesta.
   * Il Master fornisce il pattern; quando sia ammesso lo decide il flusso (§Z).
   */
  isCurrent?: boolean;
  onCurrentChange?: (value: boolean) => void;
  currentLabel?: string;
  startErrorMessage?: string;
  endErrorMessage?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  startTestID?: string;
  endTestID?: string;
};

/**
 * Coppia inizio/fine di un periodo (§Y, §Z). Due righe, non quattro campi
 * separati per mese e anno.
 */
export function PeriodField({
  currentLabel = "In corso",
  endErrorMessage,
  endLabel = "Fine",
  endPlaceholder,
  endTestID,
  endValue,
  isCurrent = false,
  mode = "monthYear",
  onCurrentChange,
  onEndChange,
  onStartChange,
  startErrorMessage,
  startLabel = "Inizio",
  startPlaceholder,
  startTestID,
  startValue,
}: PeriodFieldProps) {
  return (
    <View style={styles.container}>
      <DateSelector
        errorMessage={startErrorMessage}
        label={startLabel}
        mode={mode}
        onChange={onStartChange}
        placeholder={startPlaceholder}
        sheetTitle={startLabel}
        testID={startTestID}
        value={startValue}
      />

      {onCurrentChange ? (
        <ToggleRow
          label={currentLabel}
          onValueChange={onCurrentChange}
          value={isCurrent}
        />
      ) : null}

      {isCurrent ? null : (
        <DateSelector
          errorMessage={endErrorMessage}
          label={endLabel}
          mode={mode}
          onChange={onEndChange}
          placeholder={endPlaceholder}
          sheetTitle={endLabel}
          testID={endTestID}
          value={endValue}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingLayout.fieldGap,
  },
});
