import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText, BottomSheet, Button, SearchField } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

export type SelectorOption<T extends string> = {
  value: T;
  label: string;
  /** Riga di dettaglio sotto l'etichetta. Una riga, non un paragrafo. */
  description?: string;
};

type CommonProps<T extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SelectorOption<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Messaggio mostrato quando il caricamento remoto delle opzioni fallisce. */
  errorMessage?: string;
  onRetry?: () => void;
  loading?: boolean;
};

type SingleProps<T extends string> = CommonProps<T> & {
  mode: "single";
  value: T | "";
  onChange: (value: T | "") => void;
  allowClear?: boolean;
  clearLabel?: string;
};

type MultiProps<T extends string> = CommonProps<T> & {
  mode: "multi";
  values: T[];
  onConfirm: (values: T[]) => void;
  confirmLabel?: string;
  maxSelection?: number;
};

type BottomSheetSelectorProps<T extends string> = SingleProps<T> | MultiProps<T>;

const MAX_LIST_HEIGHT = 380;

/**
 * Selector condiviso a bottom sheet (§X). È l'unico modo in cui l'onboarding
 * presenta liste lunghe: nessun ruolo apre una lista con una UI propria.
 *
 * In `single` la scelta chiude subito lo sheet; in `multi` la selezione viene
 * confermata con la CTA, così l'utente può cambiare idea prima di uscire.
 */
export function BottomSheetSelector<T extends string>(
  props: BottomSheetSelectorProps<T>,
) {
  const {
    errorMessage,
    loading = false,
    onClose,
    onRetry,
    options,
    searchable = false,
    searchPlaceholder = "Cerca",
    title,
    visible,
  } = props;

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<T[]>(
    props.mode === "multi" ? props.values : [],
  );

  const confirmedKey = props.mode === "multi" ? props.values.join("|") : "";

  // Riaprendo lo sheet la bozza riparte dalla selezione confermata: chiudere
  // senza confermare non deve lasciare residui (§BC.7).
  useEffect(() => {
    if (!visible) {
      setQuery("");
      return;
    }

    if (props.mode === "multi") {
      setDraft(props.values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, confirmedKey, props.mode]);

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!searchable || !trimmed) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed),
    );
  }, [options, query, searchable]);

  function isSelected(value: T) {
    if (props.mode === "single") {
      return props.value === value;
    }

    return draft.includes(value);
  }

  function handleSelect(value: T) {
    if (props.mode === "single") {
      props.onChange(value);
      onClose();
      return;
    }

    setDraft((current) => {
      if (current.includes(value)) {
        return current.filter((entry) => entry !== value);
      }

      if (
        typeof props.maxSelection === "number" &&
        current.length >= props.maxSelection
      ) {
        return current;
      }

      return [...current, value];
    });
  }

  const isMulti = props.mode === "multi";

  return (
    <BottomSheet onClose={onClose} visible={visible}>
      <View accessibilityViewIsModal style={styles.container}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <AppText numberOfLines={2} style={styles.title} variant="headingSm">
            {title}
          </AppText>
          <Pressable
            accessibilityLabel="Chiudi"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons color={colors.textSecondary} name="close" size={20} />
          </Pressable>
        </View>

        {searchable ? (
          <SearchField
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            value={query}
          />
        ) : null}

        {errorMessage ? (
          <View style={styles.stateBlock}>
            <AppText align="center" color="secondary" variant="bodyLg">
              {errorMessage}
            </AppText>
            {onRetry ? (
              <Button
                label="Riprova"
                onPress={onRetry}
                size="sm"
                variant="secondary"
              />
            ) : null}
          </View>
        ) : loading ? (
          <View style={styles.stateBlock}>
            <AppText align="center" color="muted" variant="bodyLg">
              Caricamento in corso
            </AppText>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.list}
          >
            {props.mode === "single" && props.allowClear ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  props.onChange("");
                  onClose();
                }}
                style={styles.row}
              >
                <AppText color="accent" variant="titleSm">
                  {props.clearLabel ?? "Svuota selezione"}
                </AppText>
              </Pressable>
            ) : null}

            {filteredOptions.length === 0 ? (
              <View style={styles.stateBlock}>
                <AppText align="center" color="muted" variant="bodyLg">
                  Nessun risultato.
                </AppText>
              </View>
            ) : null}

            {filteredOptions.map((option) => {
              const selected = isSelected(option.value);

              return (
                <Pressable
                  accessibilityRole={isMulti ? "checkbox" : "radio"}
                  accessibilityState={{ checked: selected, selected }}
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed ? styles.rowPressed : null,
                  ]}
                >
                  <View style={styles.rowText}>
                    <AppText variant="titleSm">{option.label}</AppText>
                    {option.description ? (
                      <AppText color="secondary" variant="meta">
                        {option.description}
                      </AppText>
                    ) : null}
                  </View>

                  {isMulti ? (
                    <View
                      style={[
                        styles.checkbox,
                        selected ? styles.checkboxOn : null,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          color={colors.inkInvert}
                          name="checkmark"
                          size={14}
                        />
                      ) : null}
                    </View>
                  ) : selected ? (
                    <Ionicons color={colors.accent} name="checkmark" size={20} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {isMulti ? (
          <View style={styles.footer}>
            <AppText color="secondary" variant="meta">
              {draft.length === 0
                ? "Nessuna selezione"
                : `${draft.length} selezionate`}
            </AppText>
            <Button
              fullWidth
              label={props.confirmLabel ?? "Conferma"}
              onPress={() => {
                props.onConfirm(draft);
                onClose();
              }}
              size="lg"
              variant="primary"
            />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.m - 4,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: onboardingRadius.pill,
    height: 4,
    marginBottom: onboardingSpacing.xs,
    width: 36,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: onboardingSpacing.s,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    alignItems: "center",
    height: onboardingLayout.touchTarget - 8,
    justifyContent: "center",
    width: onboardingLayout.touchTarget - 8,
  },
  list: {
    maxHeight: MAX_LIST_HEIGHT,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    minHeight: onboardingLayout.rowMinHeight,
    paddingVertical: onboardingSpacing.s + 2,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: onboardingRadius.checkbox,
    borderWidth: onboardingBorderWidth.selected,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stateBlock: {
    alignItems: "center",
    gap: onboardingSpacing.s + 4,
    paddingVertical: onboardingSpacing.l,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: onboardingSpacing.s,
    paddingTop: onboardingSpacing.m - 4,
  },
});
