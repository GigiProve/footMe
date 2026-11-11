/**
 * Check di verifica standard di ProLink (HOM-02 §8, §140).
 *
 * Un solo componente per ogni identità — persona, Società, Media — accanto al
 * nome: stesso glifo, stesso blu accent, nessun colore per ruolo e mai la
 * dicitura "Profilo ufficiale". Nato per l'header del Feed; gli altri usi
 * inline di `checkmark-circle` nell'app (circa trenta) non sono stati migrati
 * in HOM-02 e possono adottarlo alla prima occasione.
 */

import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../styles";

export const VERIFIED_CHECK_LABEL = "Profilo verificato";

type VerifiedCheckProps = {
  size?: number;
};

export function VerifiedCheck({ size = 15 }: VerifiedCheckProps) {
  return (
    <Ionicons
      accessibilityLabel={VERIFIED_CHECK_LABEL}
      accessibilityRole="image"
      color={colors.accent}
      name="checkmark-circle"
      size={size}
    />
  );
}
