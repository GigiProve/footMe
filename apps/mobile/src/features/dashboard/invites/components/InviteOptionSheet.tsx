import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet } from "../../../../ui";

export type InviteOption = {
  id: string;
  label: string;
  meta?: string | null;
};

type Props = {
  /** Testo quando non c'è nessuna opzione selezionabile (§22). */
  emptyMessage: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  options: readonly InviteOption[];
  selected: string | null;
  title: string;
  visible: boolean;
};

/**
 * Selettore a scelta singola condiviso da Ruolo, Squadra e Ambito (§22).
 *
 * «Riusa i bottom sheet di selezione: Ruolo nella struttura, Squadra,
 * Ambito, con selezione singola, stato riconoscibile e focus ripristinato
 * alla chiusura.»
 *
 * Il check rende lo stato riconoscibile anche senza colore, e
 * `accessibilityState.selected` lo annuncia. Il filtro del Centro resta
 * invece multiselezione, e per questo è un componente diverso.
 */
export function InviteOptionSheet({
  emptyMessage,
  onClose,
  onSelect,
  options,
  selected,
  title,
  visible,
}: Props) {
  return (
    <BottomSheet onClose={onClose} title={title} visible={visible}>
      {options.length === 0 ? (
        <AppText color="neutralMuted" style={styles.empty} variant="bodySm">
          {emptyMessage}
        </AppText>
      ) : (
        <ScrollView style={styles.list}>
          {options.map((option, index) => {
            const isSelected = option.id === selected;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                key={option.id}
                onPress={() => {
                  onSelect(option.id);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? styles.divided : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`invite-option-${option.id}`}
              >
                <View style={styles.body}>
                  <AppText color="neutral" variant="bodyLg">
                    {option.label}
                  </AppText>

                  {option.meta ? (
                    <AppText color="neutralMuted" variant="meta">
                      {option.meta}
                    </AppText>
                  ) : null}
                </View>

                {isSelected ? (
                  <Ionicons color={colors.accent} name="checkmark" size={20} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 400,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  empty: {
    paddingVertical: spacing[16],
  },
  pressed: {
    opacity: 0.6,
  },
});
