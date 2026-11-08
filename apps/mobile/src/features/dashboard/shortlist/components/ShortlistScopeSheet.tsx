/**
 * Ambito della lista (DAS-REV-26 §17, screen 15).
 *
 * «Supporta Intera società oppure un solo Team della Society. Non
 * utilizzare il multi-Team del form dei ruoli amministrativi: qui il
 * selector è singolo.» Radio, non checkbox.
 *
 * Stesso schema dello `ShortlistStatusSheet` della 25, e per lo stesso
 * motivo: la scelta temporanea è una terza copia del valore. «Conferma
 * aggiorna soltanto il draft del form. X/back scartano la selezione
 * temporanea non confermata, preservando il resto dei campi. La lista nasce
 * solo con Crea e aggiungi.»
 *
 * Le opzioni arrivano già filtrate dal server (§17: «Non mostrare ambiti non
 * autorizzati disabilitati»): qui non c'è nessuna logica di permesso.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { BottomSheet, Button, Radio } from "../../../../ui";
import { PROFILE_SHORTLIST_COPY } from "../profile/profile-shortlist-presentation";
import type { CustomScopeOption } from "../profile/profile-shortlist-types";

/** `null` è un valore legittimo (Intera società): serve un sentinel per «nessuna scelta». */
export const SCOPE_UNSET = "__unset__";
export const SCOPE_SOCIETY = "__society__";

export function scopeValue(option: CustomScopeOption): string {
  return option.teamId ?? SCOPE_SOCIETY;
}

type Props = {
  onClose: () => void;
  onConfirm: (value: string) => void;
  options: CustomScopeOption[];
  value: string;
  visible: boolean;
};

export function ShortlistScopeSheet({ onClose, onConfirm, options, value, visible }: Props) {
  const [pending, setPending] = useState(value);

  useEffect(() => {
    if (visible) {
      setPending(value);
    }
  }, [value, visible]);

  return (
    <BottomSheet onClose={onClose} title={PROFILE_SHORTLIST_COPY.scopeTitle} visible={visible}>
      <View accessibilityRole="radiogroup" style={styles.group}>
        {options.map((option) => (
          <Radio
            checked={pending === scopeValue(option)}
            key={scopeValue(option)}
            label={option.label}
            onPress={() => setPending(scopeValue(option))}
            testID={`shortlist-scope-${scopeValue(option)}`}
          />
        ))}
      </View>

      <Button
        accessibilityLabel={`${PROFILE_SHORTLIST_COPY.scopeConfirm}. Aggiorna l'ambito nel modulo, senza creare la lista.`}
        disabled={pending === SCOPE_UNSET}
        label={PROFILE_SHORTLIST_COPY.scopeConfirm}
        onPress={() => onConfirm(pending)}
        size="lg"
        testID="shortlist-scope-confirm"
        variant="primary"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing[4],
    paddingBottom: spacing[24],
    paddingTop: spacing[8],
  },
});
