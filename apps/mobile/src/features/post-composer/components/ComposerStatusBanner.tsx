/**
 * Riga di stato inline del composer (HOM-06.1 §29, §120, §130, §169, §173,
 * §175, §177, §199).
 *
 * Non è una pagina né un box: una riga leggera tra il contenuto e la toolbar.
 *  • `progress`: «Pubblicazione in corso…» con spinner, senza schermata
 *    bloccante né celebrativa (§120);
 *  • `error`: motivo di blocco o errore (permesso perso §169/§173, identità non
 *    compatibile §29, errore di pubblicazione §175, offline §177). Icona +
 *    testo: l'errore non è mai affidato al solo colore (§199). Azione opzionale
 *    (es. «Riprova»);
 *  • `notice`: informazione neutra, come il limite media (§62).
 *
 * Il testo arriva dal chiamante: i messaggi della spec sono molti e dipendono
 * dal codice errore. Le regioni live annunciano il cambio agli screen reader.
 */

import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type ComposerStatusTone = "progress" | "error" | "notice";

type ComposerStatusBannerProps = {
  tone: ComposerStatusTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ComposerStatusBanner({
  tone,
  message,
  actionLabel,
  onAction,
}: ComposerStatusBannerProps) {
  const isError = tone === "error";

  return (
    <View
      accessibilityLiveRegion={isError ? "assertive" : "polite"}
      accessibilityRole={isError ? "alert" : undefined}
      style={styles.container}
      testID="composer-status-banner"
    >
      {tone === "progress" ? (
        <ActivityIndicator color={colors.textSecondary} size="small" />
      ) : (
        <Ionicons
          color={isError ? colors.danger : colors.textSecondary}
          name={isError ? "alert-circle-outline" : "information-circle-outline"}
          size={18}
        />
      )}
      <AppText
        color={isError ? "danger" : "secondary"}
        style={styles.message}
        variant="feedMeta"
      >
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={styles.action}
        >
          <AppText color="accent" variant="actionLabel">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: "center",
    minHeight: 32,
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  message: {
    flex: 1,
  },
});
