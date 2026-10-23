import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet } from "../../../../ui";

export type AdminOption = {
  id: string;
  label: string;
  meta?: string | null;
};

type Props = {
  /** Testo quando non c'è nessuna opzione selezionabile (§9). */
  emptyMessage: string;
  multiple?: boolean;
  onClose: () => void;
  onToggle: (id: string) => void;
  options: readonly AdminOption[];
  selected: readonly string[];
  title: string;
  visible: boolean;
};

/**
 * Elenco di scelta condiviso da Ruolo e Ambito (§9, §10).
 *
 * «Usa il selector/lista condiviso, con nome leggibile e selezione
 * annunciata»: `accessibilityState.selected` fa esattamente quello, ed è
 * l'unica ragione per cui questa lista non è una serie di `Pressable` nude.
 *
 * In modalità multipla la sheet non si chiude al tocco: §10 vuole che si
 * possano scegliere più squadre, e chiudere alla prima renderebbe lo scope
 * multiplo raggiungibile solo per tentativi.
 */
export function AdminOptionSheet({
  emptyMessage,
  multiple = false,
  onClose,
  onToggle,
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
            const isSelected = selected.includes(option.id);

            return (
              <Pressable
                accessibilityRole={multiple ? "checkbox" : "radio"}
                accessibilityState={{ selected: isSelected }}
                key={option.id}
                onPress={() => {
                  onToggle(option.id);

                  if (!multiple) {
                    onClose();
                  }
                }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? styles.divided : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`admin-option-${option.id}`}
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
                  <Ionicons
                    color={colors.accent}
                    name="checkmark"
                    size={20}
                  />
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
    maxHeight: 360,
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
