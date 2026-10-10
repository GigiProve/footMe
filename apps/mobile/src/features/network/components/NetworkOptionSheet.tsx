import { ScrollView, StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Radio } from "../../../ui";

export type NetworkOption = {
  description?: string | null;
  disabled?: boolean;
  id: string;
  label: string;
};

type Props = {
  onClose: () => void;
  onSelect: (id: string) => void;
  options: readonly NetworkOption[];
  selectedId: string | null;
  title: string;
  visible: boolean;
};

/**
 * Selector single-select condiviso dagli screen 04 e 06 (§11, §16).
 *
 * «I selector utilizzano componenti condivisi … Riutilizzare i selector
 * dello screen 04, senza un secondo catalogo per inviti.» È lo stesso
 * componente per tipo e ruolo, e lo stesso per richiesta e invito.
 *
 * `Radio` in tono neutro è l'unico indicatore di selezione: §11 vieta
 * «chevron/check duplicati» sulle opzioni finali, quindi il chevron resta
 * sul campo (`NetworkFieldRow`) e qui non compare.
 */
export function NetworkOptionSheet({
  onClose,
  onSelect,
  options,
  selectedId,
  title,
  visible,
}: Props) {
  return (
    <BottomSheet onClose={onClose} title={title} visible={visible}>
      <ScrollView contentContainerStyle={styles.list} style={styles.scroll}>
        {options.map((option) => (
          <View key={option.id} style={styles.option}>
            <Radio
              checked={option.id === selectedId}
              disabled={option.disabled}
              label={option.label}
              onPress={() => onSelect(option.id)}
              testID={`network-option-${option.id}`}
              tone="neutral"
            />

            {option.description ? (
              <AppText color="neutralMuted" style={styles.description} variant="meta">
                {option.description}
              </AppText>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 420,
  },
  list: {
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
  option: {
    gap: spacing[4],
  },
  description: {
    paddingLeft: spacing[32],
  },
});
