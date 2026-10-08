/**
 * Riga di un canale nei Contatti pubblici.
 *
 * È la stessa riga per le persone (REV-PROF-05/08/11/16) e per la Società
 * (REV-PROF-18): icona, nome del canale, valore, interruttore di visibilità e
 * — aperta — il campo con cui si corregge il valore sul posto.
 *
 * Due comportamenti vivono qui e non in chi la usa, perché sbagliarli in una
 * sola schermata basterebbe a pubblicare un link rotto:
 *
 *  - l'interruttore resta disabilitato finché il valore non si normalizza in
 *    qualcosa di utilizzabile;
 *  - toccare l'interruttore cambia solo la visibilità, non apre l'editor del
 *    valore: sono due azioni distinte sulla stessa riga.
 *
 * La riga non conosce il modello: riceve il valore, il normalizzatore e due
 * callback. È il motivo per cui `profile_contacts` e le colonne di `clubs`
 * possono condividerla senza che una delle due diventi la forma dell'altra.
 */
import { Pressable, StyleSheet, View } from "react-native";
import type Ionicons from "@expo/vector-icons/Ionicons";
import IoniconsComponent from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { OnboardingTextField, ToggleSwitch } from "../../../onboarding/ui";

type PublicContactChannelRowProps = {
  expanded: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  invalidMessage: string;
  keyboardType?: "email-address" | "phone-pad" | "url";
  label: string;
  /** Risultato vuoto = valore non pubblicabile. Un campo vuoto non è un errore. */
  normalize: (value: string) => string;
  onChangeValue: (value: string) => void;
  onToggleExpanded: () => void;
  onVisibilityChange: (visible: boolean) => void;
  placeholder: string;
  testID: string;
  value: string;
  visible: boolean;
};

export function PublicContactChannelRow({
  expanded,
  icon,
  invalidMessage,
  keyboardType,
  label,
  normalize,
  onChangeValue,
  onToggleExpanded,
  onVisibilityChange,
  placeholder,
  testID,
  value,
  visible,
}: PublicContactChannelRowProps) {
  const isPublishable = normalize(value).length > 0;
  const showsInvalid = value.trim().length > 0 && !isPublishable;

  return (
    <View style={styles.channel}>
      <Pressable
        accessibilityHint="Modifica il valore del contatto"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggleExpanded}
        style={styles.row}
        testID={`${testID}-row`}
      >
        <IoniconsComponent
          color={isPublishable ? colors.accent : colors.textSecondary}
          name={icon}
          size={20}
        />
        <View style={styles.rowText}>
          <AppText color="secondary" variant="meta">
            {label}
          </AppText>
          {/* Mai un valore finto: se non c'è, si dice che non c'è. */}
          <AppText
            color={value.trim() ? "primary" : "muted"}
            numberOfLines={1}
            variant="bodySm"
          >
            {value.trim() || "Non configurato"}
          </AppText>
        </View>

        <ToggleSwitch
          accessibilityLabel={`Rendi visibile ${label}`}
          disabled={!isPublishable}
          onValueChange={onVisibilityChange}
          testID={`${testID}-visibility`}
          value={visible}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.editor}>
          <OnboardingTextField
            autoCapitalize="none"
            errorMessage={showsInvalid ? invalidMessage : undefined}
            helperText={
              isPublishable
                ? undefined
                : "Inserisci un valore valido per poterlo rendere pubblico."
            }
            keyboardType={keyboardType}
            onChangeText={onChangeValue}
            placeholder={placeholder}
            testID={`${testID}-input`}
            value={value}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  channel: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
  editor: {
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[16],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
