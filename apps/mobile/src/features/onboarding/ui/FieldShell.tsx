import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "../../../ui";
import { InlineError } from "./InlineError";
import { onboardingLayout } from "./onboarding-tokens";

type FieldShellProps = {
  children: ReactNode;
  label?: string;
  /** Testo di aiuto. Nascosto quando c'è un errore: non si accumulano. */
  helperText?: string;
  errorMessage?: string;
  /** Segnala il campo come facoltativo. Il default è obbligatorio. */
  optional?: boolean;
};

/**
 * Gabbia comune di ogni campo: label, controllo, helper o errore.
 * Garantisce che label e spaziature siano identiche in tutti gli onboarding.
 */
export function FieldShell({
  children,
  errorMessage,
  helperText,
  label,
  optional = false,
}: FieldShellProps) {
  return (
    <View style={styles.container}>
      {label ? (
        <AppText color="secondary" variant="metaStrong">
          {label}
          {optional ? (
            <AppText color="muted" variant="meta">
              {"  facoltativo"}
            </AppText>
          ) : null}
        </AppText>
      ) : null}

      {children}

      {errorMessage ? (
        <InlineError message={errorMessage} />
      ) : helperText ? (
        <AppText color="muted" variant="meta">
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingLayout.labelGap,
  },
});
