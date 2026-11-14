/**
 * Stati di apertura dell'editor Articolo (HOM-06.2 §233, §237, §259, §7Y): caricamento
 * e messaggio con «Riprova» / «Chiudi». La copy è umana, mai un codice (§233); un
 * contenuto a cui non si ha accesso è identico a «non esiste» (§259).
 */

import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../styles";
import { AppText, Button } from "../../../ui";
import { publishingErrorCopy } from "../../publishing/publishing-presentation";
import type { PublishingErrorKind } from "../../publishing/publishing-types";

/** Il contesto o la bozza non si sono aperti: copy dedicata dove «pubblicare» non c'entra. */
export function openErrorCopy(kind: PublishingErrorKind): string {
  switch (kind) {
    case "article_mode_not_allowed":
      return "Non puoi creare articoli con le identità disponibili.";
    case "content_permission_denied":
      return "Non hai i permessi per modificare questo contenuto.";
    case "content_invalid_state":
      return "Questo contenuto non si può modificare in questo momento.";
    default:
      return publishingErrorCopy(kind, "article");
  }
}

export function ArticleLoading() {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <View style={styles.centered} testID="article-loading">
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    </SafeAreaView>
  );
}

type MessageProps = {
  message: string;
  onRetry?: () => void;
  onClose: () => void;
};

export function ArticleMessage({ message, onRetry, onClose }: MessageProps) {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <View style={styles.centered} testID="article-message">
        <AppText accessibilityRole="alert" align="center" color="secondary" variant="bodyLg">
          {message}
        </AppText>
        <View style={styles.actions}>
          {onRetry ? <Button label="Riprova" onPress={onRetry} variant="secondary" /> : null}
          <Button label="Chiudi" onPress={onClose} variant="outline" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignSelf: "stretch",
    gap: spacing[12],
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
