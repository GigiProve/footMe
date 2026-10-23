import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";

export type ComposerOption = {
  disabled?: boolean;
  id: string;
  label: string;
  meta?: string | null;
};

type Props = {
  /** Riga non selezionabile mostrata sopra l'elenco: il Team principale
   *  come **contesto**, mai come checkbox modificabile (§15). */
  contextLabel?: string | null;
  contextValue?: string | null;
  /** §18: «Catalogo vuoto valido, nessuna opzione autorizzata ed errore di
   *  caricamento sono condizioni distinte.» */
  emptyMessage: string;
  error?: string | null;
  helper?: string | null;
  loading?: boolean;
  multiple?: boolean;
  onClose: () => void;
  /** Presente solo in multipla: §18 — «Le opzioni a selezione singola
   *  finale possono applicarsi immediatamente e chiudere.» */
  onConfirm?: () => void;
  onRetry?: () => void;
  onToggle: (id: string) => void;
  options: readonly ComposerOption[];
  selected: readonly string[];
  title: string;
  visible: boolean;
};

/**
 * Bottom sheet di scelta del composer (DAS-REV-16 §18, screen 02, 07).
 *
 * «I multi-select conservano uno stato provvisorio fino a Conferma
 * selezione, permettono rimozione completa e deduplicano tramite ID. La
 * spunta è un vero controllo accessibile; non usare chevron che suggeriscono
 * navigazione su opzioni finali.»
 *
 * Da qui le due forme: `radio` che applica e chiude, `checkbox` che
 * accumula e aspetta la conferma. Nessun chevron in nessuna delle due.
 *
 * «Mostra ricerca soltanto per cataloghi abbastanza estesi da giustificarla
 * … non per quattro profili»: questo componente non ha ricerca, e i
 * cataloghi che la meriterebbero non la chiedono ancora.
 */
export function ComposerOptionSheet({
  contextLabel,
  contextValue,
  emptyMessage,
  error,
  helper,
  loading = false,
  multiple = false,
  onClose,
  onConfirm,
  onRetry,
  onToggle,
  options,
  selected,
  title,
  visible,
}: Props) {
  const count = selected.length;

  return (
    <BottomSheet onClose={onClose} title={title} visible={visible}>
      {helper ? (
        <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
          {helper}
        </AppText>
      ) : null}

      {contextLabel && contextValue ? (
        <View style={styles.context}>
          <AppText color="neutralMuted" variant="meta">
            {contextLabel}
          </AppText>
          <AppText color="neutral" variant="titleSm">
            {contextValue}
          </AppText>
        </View>
      ) : null}

      {error ? (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            {error}
          </AppText>

          {onRetry ? (
            <Button label="Riprova" onPress={onRetry} variant="secondary" />
          ) : null}
        </View>
      ) : loading ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          Caricamento…
        </AppText>
      ) : options.length === 0 ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          {emptyMessage}
        </AppText>
      ) : (
        <ScrollView style={styles.list}>
          {options.map((option) => {
            const isSelected = selected.includes(option.id);

            return (
              <Pressable
                accessibilityLabel={option.meta ? `${option.label}, ${option.meta}` : option.label}
                accessibilityRole={multiple ? "checkbox" : "radio"}
                accessibilityState={{
                  checked: multiple ? isSelected : undefined,
                  disabled: option.disabled,
                  selected: isSelected,
                }}
                disabled={option.disabled}
                key={option.id}
                onPress={() => onToggle(option.id)}
                style={({ pressed }) => [
                  styles.option,
                  pressed ? styles.pressed : null,
                  option.disabled ? styles.disabled : null,
                ]}
                testID={`compose-option-${option.id}`}
              >
                <View style={styles.optionText}>
                  <AppText color="neutral" variant="bodyLg">
                    {option.label}
                  </AppText>

                  {option.meta ? (
                    <AppText color="neutralMuted" variant="meta">
                      {option.meta}
                    </AppText>
                  ) : null}
                </View>

                {multiple ? (
                  <View style={[styles.box, isSelected ? styles.boxOn : null]}>
                    {isSelected ? (
                      <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
                    ) : null}
                  </View>
                ) : (
                  <View style={[styles.radio, isSelected ? styles.radioOn : null]}>
                    {isSelected ? <View style={styles.dot} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {multiple && onConfirm ? (
        <View style={styles.confirm}>
          <AppText color="neutralMuted" variant="meta">
            {count === 1 ? "1 squadra selezionata" : `${count} squadre selezionate`}
          </AppText>

          <Button
            fullWidth
            label="Conferma selezione"
            onPress={onConfirm}
            testID="compose-confirm-selection"
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  confirm: {
    gap: spacing[10],
    paddingTop: spacing[12],
  },
  context: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingBottom: spacing[12],
  },
  disabled: {
    opacity: 0.45,
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  helper: {
    paddingBottom: spacing[12],
  },
  list: {
    maxHeight: 360,
  },
  option: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioOn: {
    borderColor: colors.accent,
  },
  state: {
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
});
