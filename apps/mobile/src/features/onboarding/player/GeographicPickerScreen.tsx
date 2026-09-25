import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import { AppText, SearchField } from "../../../ui";
import { OnboardingPage, SelectionRow } from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import { buildSelectionCountLabel } from "./geographic-availability";

type GeographicPickerScreenProps = {
  title: string;
  subtitle: string;
  /** Elenco completo, nell'ordine ufficiale. Il filtro non lo riordina. */
  options: { label: string; value: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  searchPlaceholder: string;
  emptyStateMessage: string;
  unit: "regione" | "provincia";
  currentStep?: number;
  totalSteps?: number;
  stepLabel?: string;
  testID?: string;
};

/**
 * Selezione multipla di regioni o province (§U–§W).
 *
 * La ricerca filtra ma non tocca le selezioni: cambiare query non fa perdere
 * nulla, perché le voci scelte vivono nello stato e non nella lista visibile.
 */
export function GeographicPickerScreen({
  currentStep,
  emptyStateMessage,
  onBack,
  onChange,
  onConfirm,
  options,
  searchPlaceholder,
  stepLabel,
  subtitle,
  testID,
  title,
  totalSteps,
  unit,
  values,
}: GeographicPickerScreenProps) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed),
    );
  }, [options, query]);

  const selectedLabels = useMemo(
    () =>
      options
        .filter((option) => values.includes(option.value))
        .map((option) => option.label),
    [options, values],
  );

  function handleToggle(value: string) {
    onChange(
      values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value],
    );
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onConfirm,
        primaryDisabled: values.length === 0,
        primaryLabel: "Continua",
        primaryTestID: testID ? `${testID}-continue` : undefined,
      }}
      onBack={onBack}
      scrollable={false}
      stepLabel={stepLabel}
      subtitle={subtitle}
      testID={testID}
      title={title}
      totalSteps={totalSteps}
    >
      <SearchField
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        value={query}
      />

      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredOptions}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.value}
        ListEmptyComponent={
          <AppText align="center" color="muted" style={styles.empty} variant="bodyLg">
            {emptyStateMessage}
          </AppText>
        }
        renderItem={({ item }) => (
          <SelectionRow
            label={item.label}
            onPress={() => handleToggle(item.value)}
            selected={values.includes(item.value)}
            testID={`${testID ?? "geo"}-option-${item.value}`}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />

      {selectedLabels.length > 0 ? (
        <View style={styles.summary}>
          <AppText color="secondary" variant="metaStrong">
            {buildSelectionCountLabel(selectedLabels.length, unit)}
          </AppText>
          <AppText color="accent" numberOfLines={2} variant="metaStrong">
            {selectedLabels.join(", ")}
          </AppText>
        </View>
      ) : null}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    marginTop: onboardingSpacing.m,
  },
  listContent: {
    gap: onboardingSpacing.s,
    paddingBottom: onboardingSpacing.m,
  },
  empty: {
    paddingVertical: onboardingSpacing.l,
  },
  summary: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    gap: 2,
    marginBottom: onboardingSpacing.m,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s + 2,
  },
});
