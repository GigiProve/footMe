/**
 * Fallback «conversazione non disponibile» (DAS-REV-34 §22; PNG 11 e 12).
 *
 * Stato focalizzato: back, icona, titolo, testo e una sola CTA primaria blu
 * «Torna ai messaggi». Nessuna bottom navigation (la route sta fuori dalle tab),
 * nessuno storico, nome o composer sotto, nessun Riprova né Ripristina. Il focus
 * dello screen reader va al titolo; il motivo è l'unico dato che arriva (§22).
 */
import { useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { MESSAGES_INBOX_ROUTE } from "../messaging-routes";
import { UNAVAILABLE_BACK_LABEL, UNAVAILABLE_COPY, type UnavailableReason } from "../unavailable-presentation";

const ICONS: Record<UnavailableReason, keyof typeof Ionicons.glyphMap> = {
  deleted: "trash-outline",
  revoked: "ban-outline",
  unavailable: "chatbubbles-outline",
};

export function ConversationUnavailableScreen({ reason }: { reason: UnavailableReason }) {
  const router = useRouter();
  const titleRef = useRef<View>(null);
  const copy = UNAVAILABLE_COPY[reason];

  useEffect(() => {
    const node = titleRef.current ? findNodeHandle?.(titleRef.current) : null;

    if (node) {
      AccessibilityInfo?.setAccessibilityFocus?.(node);
    }

    AccessibilityInfo?.announceForAccessibility?.(copy.title);
  }, [copy.title]);

  /* Sempre all'Inbox: uno stack con la chat appena sostituita non ha niente a cui tornare. */
  function goToMessages() {
    router.replace(MESSAGES_INBOX_ROUTE as never);
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    goToMessages();
  }

  return (
    <SafeAreaView style={styles.root} testID="conversation-unavailable">
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={goBack}
          style={styles.back}
          testID="conversation-unavailable-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Ionicons color={colors.textNeutralMuted} name={ICONS[reason]} size={44} />
        <View accessible ref={titleRef}>
          <AppText accessibilityRole="header" align="center" color="neutral" variant="headingMd">
            {copy.title}
          </AppText>
        </View>
        {copy.body ? (
          <AppText align="center" color="neutralMuted" variant="bodyLg">
            {copy.body}
          </AppText>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          fullWidth
          label={UNAVAILABLE_BACK_LABEL}
          onPress={goToMessages}
          size="lg"
          testID="conversation-unavailable-primary"
          variant="primary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  body: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  footer: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  header: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
