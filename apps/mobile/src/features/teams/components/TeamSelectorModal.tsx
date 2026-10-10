import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Radio, SearchField } from "../../../ui";

export type SelectorItem = {
  id: string;
  label: string;
  /** Voce dismessa ancora in uso su questa squadra (§15). */
  isRetired?: boolean;
};

type Props = {
  /** Riga di contesto sotto il titolo: "Under 18 · Stagione 2026/27" (§16). */
  contextLine?: string | null;
  errorMessage?: string | null;
  /** Blocco di aiuto in coda alla lista (master 04). */
  footer?: ReactNode;
  isLoading?: boolean;
  items: SelectorItem[];
  onClose: () => void;
  onRetry?: () => void;
  onSearchChange?: (value: string) => void;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  /** "Rimuovi selezione": pattern secondario condiviso (§16). */
  onClear?: () => void;
  /**
   * `neutral` applica il vincolo cromatico di DAS-REV-10 §4, che vale
   * «anche per sheet, form, selector e stati non rappresentati». Il selector
   * è condiviso e aperto da due pack con due palette: il tono è un parametro
   * e non una seconda copia del componente.
   */
  tone?: "brand" | "neutral";
  title: string;
  value: string | null;
  visible: boolean;
};

/**
 * Selector full-screen di Tipo e Livello (master 03, 04).
 *
 * §16 è preciso su cosa **non** deve esserci: niente chevron sulle opzioni
 * finali, niente check duplicati accanto al radio, nessun pulsante Conferma
 * superfluo. Il tap seleziona e torna al form, e il back senza scelta
 * conserva il valore precedente — qui per costruzione, perché la selezione
 * risale solo da `onSelect`.
 *
 * È un `Modal` e non una route: il draft del form resta montato sotto, che è
 * esattamente ciò che §23 chiede («Il passaggio a selector, crop e subview
 * conserva il draft»).
 */
export function TeamSelectorModal({
  contextLine,
  errorMessage,
  footer,
  isLoading = false,
  items,
  onClear,
  onClose,
  onRetry,
  onSearchChange,
  onSelect,
  searchPlaceholder,
  searchValue,
  title,
  tone = "brand",
  value,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const neutral = tone === "neutral";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <View
        style={[
          styles.root,
          neutral ? styles.rootNeutral : null,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.navBar}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.backButton}
            testID="team-selector-back"
          >
            <Ionicons
              color={neutral ? colors.textNeutral : colors.textPrimary}
              name="chevron-back"
              size={24}
            />
          </Pressable>

          <AppText
            color={neutral ? "neutral" : "primary"}
            numberOfLines={1}
            style={styles.navTitle}
            variant="titleMd"
          >
            {title}
          </AppText>

          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing[32] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {contextLine ? (
            <AppText color={neutral ? "neutralMuted" : "secondary"} variant="meta">
              {contextLine}
            </AppText>
          ) : null}

          {onSearchChange ? (
            <SearchField
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder ?? "Cerca"}
              value={searchValue ?? ""}
            />
          ) : null}

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator
                color={neutral ? colors.textNeutralMuted : colors.accent}
              />
            </View>
          ) : errorMessage ? (
            // §16: «Distinguere nessun risultato da errore di caricamento.»
            <View accessibilityRole="alert" style={styles.errorBox}>
              <AppText color={neutral ? "neutralMuted" : "secondary"} variant="bodySm">
                {errorMessage}
              </AppText>

              {onRetry ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onRetry}
                  style={styles.retry}
                >
                  <AppText color="accent" variant="actionLabel">
                    Riprova
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : items.length === 0 ? (
            <AppText color={neutral ? "neutralMuted" : "secondary"} variant="bodySm">
              Nessun risultato.
            </AppText>
          ) : (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.option,
                    item.id === value ? styles.optionSelected : null,
                    item.id === value && neutral ? styles.optionSelectedNeutral : null,
                  ]}
                >
                  <Radio
                    checked={item.id === value}
                    tone={tone}
                    label={
                      item.isRetired ? `${item.label} (non più disponibile)` : item.label
                    }
                    onPress={() => onSelect(item.id)}
                    testID={`team-selector-option-${item.id}`}
                  />
                </View>
              ))}
            </View>
          )}

          {onClear && value ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClear}
              style={styles.clear}
              testID="team-selector-clear"
            >
              <AppText color="accent" variant="actionLabel">
                Rimuovi selezione
              </AppText>
            </Pressable>
          ) : null}

          {footer}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  rootNeutral: {
    backgroundColor: colors.surface,
  },
  navBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  backButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  navTitle: {
    flex: 1,
    textAlign: "center",
  },
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  options: {
    gap: spacing[4],
  },
  option: {
    borderRadius: 12,
    paddingHorizontal: spacing[12],
  },
  optionSelected: {
    backgroundColor: colors.surfaceMuted,
  },
  optionSelectedNeutral: {
    backgroundColor: colors.surfaceNeutral,
  },
  centered: {
    paddingVertical: spacing[32],
  },
  errorBox: {
    gap: spacing[8],
  },
  retry: {
    minHeight: sizes.touchTarget - spacing[14],
    justifyContent: "center",
  },
  clear: {
    minHeight: sizes.touchTarget,
    justifyContent: "center",
  },
});
