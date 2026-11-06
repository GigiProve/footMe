import { ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Button, Radio } from "../../../ui";

export type RoleOption = {
  id: string;
  label: string;
  meta?: string | null;
};

type Props = {
  confirmLabel?: string;
  /** Testo quando non c'è nessuna opzione selezionabile (§45). */
  emptyMessage: string;
  onClose: () => void;
  onConfirm: () => void;
  /** Cambia la selezione provvisoria. Non applica nulla al draft. */
  onSelect: (id: string) => void;
  options: readonly RoleOption[];
  selected: string | null;
  testID?: string;
  title: string;
  visible: boolean;
};

/**
 * Selettore a scelta singola (§13, screen 03).
 *
 * «Apri il bottom sheet Seleziona squadra sopra il form reale, con una sola
 * selezione. Nella fixture Prima squadra è selezionata; Primavera e Under 17
 * hanno radio vuoti neutri. CTA Conferma.»
 *
 * Due differenze volute rispetto al selettore di DAS-REV-19, entrambe
 * chieste dal PNG e verificate da §54:
 *
 *   · l'indicatore è un **radio**, non un check — lo stato si vede anche
 *     sulle righe non scelte, che è ciò che il mockup mostra;
 *   · la selezione non chiude lo sheet: «Conferma applica la scelta al
 *     draft; chiusura/back conserva la scelta precedentemente confermata».
 *     Un tap su una riga che chiudesse subito renderebbe Conferma inutile e
 *     impossibile cambiare idea senza riaprire.
 *
 * Lo stato locale della selezione vive nel chiamante, perché è lui a sapere
 * che cosa fare di un annullamento.
 */
export function RoleOptionSheet({
  confirmLabel = "Conferma",
  emptyMessage,
  onClose,
  onConfirm,
  onSelect,
  options,
  selected,
  testID,
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
        <>
          <ScrollView style={styles.list} testID={testID}>
            {options.map((option, index) => (
              <View
                key={option.id}
                style={[styles.row, index > 0 ? styles.divided : null]}
              >
                <Radio
                  checked={option.id === selected}
                  label={option.label}
                  onPress={() => onSelect(option.id)}
                  testID={`role-option-${option.id}`}
                  tone="neutral"
                />

                {option.meta ? (
                  <AppText color="neutralMuted" style={styles.meta} variant="meta">
                    {option.meta}
                  </AppText>
                ) : null}
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              disabled={!selected}
              fullWidth
              label={confirmLabel}
              onPress={onConfirm}
              size="md"
              testID="role-option-confirm"
              variant="primary"
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 340,
  },
  row: {
    paddingVertical: spacing[8],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meta: {
    paddingLeft: spacing[32],
  },
  empty: {
    paddingVertical: spacing[16],
  },
  actions: {
    paddingTop: spacing[16],
  },
});
