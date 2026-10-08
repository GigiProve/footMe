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
  /**
   * Testo e affordance di un canale senza valore. Quando è dichiarato, una
   * riga vuota invita ad aggiungerlo con un chevron invece di mostrare un
   * interruttore disattivato: un canale che non esiste non ha una visibilità
   * da regolare (REV-PROF-22, Screen 7).
   */
  emptyActionLabel?: string;
  expanded: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  /** Tinta dell'icona quando il canale è pubblicabile. Default: accent. */
  iconColor?: string;
  invalidMessage: string;
  keyboardType?: "email-address" | "phone-pad" | "url";
  label: string;
  /** Risultato vuoto = valore non pubblicabile. Un campo vuoto non è un errore. */
  normalize: (value: string) => string;
  onChangeValue: (value: string) => void;
  /** Apre il canale in una scheda esterna. Mostrato solo con un valore valido. */
  onOpenValue?: () => void;
  onToggleExpanded: () => void;
  onVisibilityChange: (visible: boolean) => void;
  placeholder: string;
  testID: string;
  value: string;
  visible: boolean;
};

export function PublicContactChannelRow({
  emptyActionLabel,
  expanded,
  icon,
  iconColor,
  invalidMessage,
  keyboardType,
  label,
  normalize,
  onChangeValue,
  onOpenValue,
  onToggleExpanded,
  onVisibilityChange,
  placeholder,
  testID,
  value,
  visible,
}: PublicContactChannelRowProps) {
  const isPublishable = normalize(value).length > 0;
  const showsInvalid = value.trim().length > 0 && !isPublishable;
  const isEmpty = value.trim().length === 0;
  const showsEmptyAction = Boolean(emptyActionLabel) && isEmpty;

  return (
    <View style={styles.channel}>
      <Pressable
        accessibilityHint={
          showsEmptyAction
            ? "Aggiunge il valore del canale"
            : "Modifica il valore del contatto"
        }
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggleExpanded}
        style={styles.row}
        testID={`${testID}-row`}
      >
        <IoniconsComponent
          color={
            isPublishable ? (iconColor ?? colors.accent) : colors.textSecondary
          }
          name={icon}
          size={20}
        />
        <View style={styles.rowText}>
          <AppText color="secondary" variant="meta">
            {label}
          </AppText>
          {/*
            Mai un valore finto: se non c'è, si dice che non c'è — e quando la
            riga ha un'azione di aggiunta il posto del valore resta al testo
            dell'azione, non a un segnaposto.
          */}
          {showsEmptyAction ? null : (
            <AppText
              color={isEmpty ? "muted" : "primary"}
              numberOfLines={1}
              variant="bodySm"
            >
              {value.trim() || "Non configurato"}
            </AppText>
          )}
        </View>

        {showsEmptyAction ? (
          <View style={styles.emptyAction}>
            <AppText color="accent" variant="actionLabel">
              {emptyActionLabel}
            </AppText>
            <IoniconsComponent
              color={colors.textMuted}
              name="chevron-forward"
              size={16}
            />
          </View>
        ) : (
          <View style={styles.trailing}>
            <ToggleSwitch
              accessibilityLabel={`Rendi visibile ${label}`}
              disabled={!isPublishable}
              onValueChange={onVisibilityChange}
              testID={`${testID}-visibility`}
              value={visible}
            />
            {onOpenValue && isPublishable ? (
              <Pressable
                accessibilityLabel={`Apri ${label}`}
                accessibilityRole="link"
                hitSlop={8}
                onPress={onOpenValue}
                testID={`${testID}-open`}
              >
                <IoniconsComponent
                  color={colors.textSecondary}
                  name="open-outline"
                  size={18}
                />
              </Pressable>
            ) : null}
          </View>
        )}
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
  emptyAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  trailing: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
