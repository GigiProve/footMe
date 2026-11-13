/**
 * Stati generici di un dettaglio contenuto (HOM-04 §56–68, §121, §126–127).
 *
 * `ContentUnavailableState` è lo stato unico «Contenuto non disponibile»: stesso
 * titolo e testo per eliminazione, perdita di visibilità, permessi o id non
 * valido (§63–65). La CTA «Torna al feed» c'è solo se `onBackToFeed` è passato
 * (vedi `useBackToFeed`): altrove basta il Back nativo.
 *
 * `ContentLoadErrorState` è l'errore temporaneo: «Riprova», mai confuso con
 * «non disponibile» (§67–68).
 *
 * Deviazione dichiarata dal mockup 4 (Luigi 2026-11-13): il dettaglio vive
 * fuori dalle tab, quindi niente header PROLINK né bottom nav.
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  CONTENT_LOAD_ERROR,
  CONTENT_LOAD_RETRY,
  CONTENT_UNAVAILABLE_BODY,
  CONTENT_UNAVAILABLE_CTA,
  CONTENT_UNAVAILABLE_TITLE,
} from "../content-availability-presentation";

export function ContentUnavailableState({ onBackToFeed }: { onBackToFeed?: () => void }) {
  return (
    <View style={styles.container} testID="content-unavailable">
      <View style={styles.icon}>
        <Ionicons color={colors.textMuted} name="document-outline" size={56} />
        <View style={styles.ban}>
          <Ionicons color={colors.textMuted} name="ban-outline" size={26} />
        </View>
      </View>
      <AppText align="center" variant="headingMd">
        {CONTENT_UNAVAILABLE_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="bodyLg">
        {CONTENT_UNAVAILABLE_BODY}
      </AppText>
      {onBackToFeed ? (
        <Button label={CONTENT_UNAVAILABLE_CTA} onPress={onBackToFeed} testID="content-unavailable-cta" />
      ) : null}
    </View>
  );
}

export function ContentLoadErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container} testID="content-load-error">
      <AppText align="center" color="secondary" variant="bodyLg">
        {CONTENT_LOAD_ERROR}
      </AppText>
      <Button label={CONTENT_LOAD_RETRY} onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  ban: {
    bottom: 0,
    position: "absolute",
    right: 0,
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    padding: spacing[24],
  },
  icon: {
    alignItems: "center",
    height: 72,
    justifyContent: "center",
    marginBottom: spacing[8],
    width: 72,
  },
});
