import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  action?: { label: string; onPress: () => void };
  /**
   * Opzionale: §12 di DAS-REV-03 prevede un modulo ridotto al solo accesso
   * alla lista quando tutte le preview sono già mostrate più in alto.
   */
  children?: ReactNode;
  /**
   * Conteggio o contesto accanto al titolo ("8 squadre"), grigio e non
   * tappabile: DAS-REV-07 §15 lo vuole fra il titolo e la CTA. Non è una
   * seconda azione e non compete con "Vedi tutte".
   */
  meta?: string | null;
  title: string;
};

/**
 * Titolo di sezione con CTA opzionale ("Le tue candidature" · "Vedi tutte").
 *
 * Il titolo non è tappabile: la CTA è un target separato, così lo screen
 * reader annuncia un'intestazione e un pulsante invece di un unico blocco
 * ambiguo.
 */
export function DashboardSection({ action, children, meta, title }: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title} variant="headingSm">
          {title}
        </AppText>

        {meta ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {meta}
          </AppText>
        ) : null}

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
 * Errore locale di un modulo (master 04).
 *
 * Gli altri moduli restano utilizzabili: è la ragione per cui questo stato
 * vive **dentro** la sezione e non al posto della pagina. Il retry ricarica
 * il solo provider necessario — §26 è esplicito: non deve ricaricare
 * inutilmente le candidature.
 *
 * Trattamento neutro: icona informativa e azione blu, nessun rosso. Un
 * caricamento fallito non è un problema operativo del dominio (§5), e
 * colorarlo come tale confonderebbe due cose che la task tiene separate.
 */
export function DashboardModuleError({
  isRetrying = false,
  message,
  onRetry,
}: {
  /** Loading locale durante il retry: l'azione non si ripete a vuoto. */
  isRetrying?: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <Ionicons
        color={colors.textMuted}
        name="information-circle-outline"
        size={20}
      />

      <View style={styles.errorBody}>
        <AppText color="secondary" variant="bodySm">
          {message}
        </AppText>

        <Pressable
          accessibilityLabel={`Riprova: ${message}`}
          accessibilityRole="button"
          accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
          disabled={isRetrying}
          hitSlop={8}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryRow,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color={colors.accent} name="refresh" size={14} />
          <AppText color="accent" variant="actionLabel">
            {isRetrying ? "Aggiornamento…" : "Riprova"}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Il modulo ha dati utilizzabili ma l'ultimo aggiornamento è fallito (§18).
 *
 * «Se il modulo possiede già dati utilizzabili, conservarli con feedback di
 * mancato aggiornamento invece di sostituirli automaticamente con il pannello
 * vuoto.» Lo screen 04 è il caso opposto — nessuna lista riutilizzabile — e
 * per quello esiste `DashboardModuleError`.
 */
export function DashboardModuleStale({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Dati non aggiornati. Riprova."
      accessibilityRole="button"
      hitSlop={8}
      onPress={onRetry}
      style={({ pressed }) => [styles.staleRow, pressed ? styles.pressed : null]}
    >
      <Ionicons color={colors.textMuted} name="refresh" size={13} />
      <AppText color="muted" variant="caption">
        Dati non aggiornati · Riprova
      </AppText>
    </Pressable>
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
  // `flex: 1` e non `flexShrink`: il titolo assorbe lo spazio libero, così
  // conteggio e CTA restano appaiati a destra invece di distribuirsi.
  title: {
    flex: 1,
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
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[14],
  },
  errorBody: {
    flex: 1,
    gap: spacing[6],
  },
  retryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[14],
  },
  staleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[14],
    paddingVertical: spacing[4],
  },
});
