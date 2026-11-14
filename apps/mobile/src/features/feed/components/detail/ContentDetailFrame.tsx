/**
 * Cornice comune dei due dettagli contenuto (HOM-08 §8, §11, §13, §184–§191).
 *
 * Il dettaglio canonico del Post («← Post») e quello di Articolo/Video
 * («← Contenuto») condividono la stessa struttura: barra in alto, corpo che
 * scorre e, per i commenti, un composer che resta fisso in basso fuori dallo
 * scroll. È lo stesso schema di `PostComposerScreen` (tastiera con
 * `KeyboardAvoidingView` + barra sticky; l'inset dell'home indicator serve solo
 * a tastiera chiusa), non un `Screen`: il composer è a tutta larghezza e dentro
 * il padding di `Screen` sarebbe rientrato di 20pt.
 *
 * `footer` è sempre fuori dal corpo e dal suo padding. Gli stati di caricamento,
 * errore e «non disponibile» non lo passano: senza contenuto non c'è composer e
 * quindi nessun invio (§188–§191).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type ContentDetailFrameProps = {
  title: string;
  /** Azione a destra nella barra (es. segnalibro); assente = spazio vuoto di 44pt. */
  right?: ReactNode;
  children: ReactNode;
  /** Composer sticky: fuori dallo scroll, dentro il `KeyboardAvoidingView`. */
  footer?: ReactNode;
};

export function ContentDetailFrame({ title, right, children, footer }: ContentDetailFrameProps) {
  const router = useRouter();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // L'inset in basso (home indicator) serve solo a tastiera chiusa.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
      setKeyboardOpen(false),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <SafeAreaView
      edges={keyboardOpen ? ["top"] : ["top", "bottom"]}
      style={styles.root}
      testID="screen-root"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.topBarButton}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>
        <AppText align="center" style={styles.topBarTitle} variant="bodySm">
          {title}
        </AppText>
        {right ?? <View style={styles.topBarButton} />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.body} testID="screen-content">
          {children}
        </View>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  flex: {
    flex: 1,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarTitle: {
    flex: 1,
    fontWeight: "600",
  },
});
