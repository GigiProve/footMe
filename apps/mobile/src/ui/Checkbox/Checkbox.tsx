import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type CheckboxProps = {
  checked: boolean;
  /**
   * Metadato sotto l'etichetta — "Bergamo" con "Lombardia" a disambiguare
   * (DAS-REV-06 §13). Entra anche nell'etichetta annunciata dal lettore di
   * schermo, altrimenti la disambiguazione varrebbe solo per chi vede.
   */
  description?: string;
  disabled?: boolean;
  /**
   * Stato parziale di una casella «seleziona tutto» (DAS-REV-20 §12).
   *
   * «Deselezionandone una lo stato globale diventa parziale/non selezionato
   * secondo il componente accessibile.» Il valore non è una terza scelta
   * salvabile — §12 avverte che «l'eventuale stato indeterminato non viene
   * salvato come categoria» — ma una descrizione di che cosa farà il tap:
   * da parziale si completa la selezione, da completo la si svuota.
   *
   * Vale solo con `checked` falso: una casella piena non è anche parziale.
   */
  indeterminate?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
};

export function Checkbox({
  checked,
  description,
  disabled = false,
  indeterminate = false,
  label,
  onValueChange,
  testID,
}: CheckboxProps) {
  const partial = indeterminate && !checked;

  return (
    <Pressable
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityRole="checkbox"
      /* "mixed" è il valore che i lettori di schermo annunciano come
         parzialmente selezionato: §46 vieta di affidare lo stato al solo
         colore del quadratino. */
      accessibilityState={{ checked: partial ? "mixed" : checked, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!checked)}
      style={[styles.container, disabled ? styles.disabled : null]}
      testID={testID}
    >
      <View
        style={[
          styles.box,
          checked ? styles.boxChecked : null,
          partial ? styles.boxPartial : null,
        ]}
      >
        {checked ? (
          <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
        ) : null}
        {partial ? <View style={styles.dash} /> : null}
      </View>
      <View style={styles.text}>
        <AppText variant="bodyLg" style={styles.label}>
          {label}
        </AppText>
        {description ? (
          <AppText color="secondary" variant="bodySm">
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    // WCAG: la riga è il bersaglio, non il solo quadratino da 22px.
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[6],
  },
  disabled: {
    opacity: 0.5,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[4],
    backgroundColor: colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  boxPartial: {
    borderColor: colors.accent,
  },
  dash: {
    backgroundColor: colors.accent,
    borderRadius: 1,
    height: 2,
    width: 10,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
  },
});
