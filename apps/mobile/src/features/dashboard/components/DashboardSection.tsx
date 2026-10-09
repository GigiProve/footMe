import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

type Props = {
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  title: string;
};

/**
 * Titolo di sezione con CTA opzionale ("Le tue candidature" · "Vedi tutte").
 *
 * Il titolo non è tappabile: la CTA è un target separato, così lo screen
 * reader annuncia un'intestazione e un pulsante invece di un unico blocco
 * ambiguo.
 */
export function DashboardSection({ action, children, title }: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title} variant="headingSm">
          {title}
        </AppText>

        {action ? (
          <Pressable
            accessibilityLabel={`${action.label}: ${title}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={action.onPress}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <AppText color="accent" variant="actionLabel">
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
}

/**
 * Errore locale di un modulo (§21). Gli altri moduli restano utilizzabili: è
 * la ragione per cui questo stato vive dentro la sezione e non al posto della
 * pagina.
 */
export function DashboardModuleError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <AppText color="secondary" variant="bodyLg">
        {message}
      </AppText>
      <Button
        label="Riprova"
        onPress={onRetry}
        size="sm"
        style={styles.retry}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  title: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  errorBox: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[10],
    padding: spacing[14],
  },
  retry: {
    alignSelf: "flex-start",
  },
});
