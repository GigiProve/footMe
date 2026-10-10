import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

/**
 * Superficie comune ai moduli del dettaglio (§10).
 *
 * Un solo blocco ripetuto: superficie bianca, hairline sopra e sotto,
 * intestazione con titolo a sinistra e — alternativamente — un conteggio
 * grigio o un accesso blu a destra. I moduli differiscono per contenuto, mai
 * per impaginazione: §10 vieta che una squadra con molti dati diventi «una
 * Dashboard alternativa».
 *
 * `meta` e `action` sono mutuamente esclusivi per costruzione: §13 è
 * esplicito sul fatto che "2 attive" è un metadato grigio **non
 * interattivo**, e averli entrambi a destra li renderebbe indistinguibili.
 */
export function TeamDetailModule({
  action,
  children,
  meta,
  title,
}: {
  action?: { label: string; onPress: () => void } | null;
  children?: ReactNode;
  meta?: string | null;
  title: string;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title} variant="headingSm">
          {title}
        </AppText>

        {meta ? (
          <AppText color="muted" numberOfLines={1} variant="meta">
            {meta}
          </AppText>
        ) : null}

        {action ? (
          <Pressable
            accessibilityLabel={`${action.label}: ${title}`}
            accessibilityRole="button"
            hitSlop={10}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.headerAction,
              pressed ? styles.pressed : null,
            ]}
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
 * Riepilogo compatto navigabile: Candidature e Inviti (§15, §16).
 *
 * **Un solo bersaglio**, non un riepilogo più un pulsante accanto. §14
 * critica la duplicazione degli accessi nello stesso modulo e qui vale lo
 * stesso principio: la riga intera apre il centro proprietario e la label
 * accessibile esplicita l'azione, come §15 richiede per le varianti del
 * mockup che mostrano solo riepilogo e chevron.
 */
export function TeamSummaryRow({
  accessibilityLabel,
  onPress,
  summary,
  testID,
}: {
  accessibilityLabel: string;
  onPress: (() => void) | null;
  summary: string;
  testID?: string;
}) {
  const body = (
    <>
      <AppText color="secondary" numberOfLines={2} style={styles.summaryText} variant="bodySm">
        {summary}
      </AppText>

      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  if (!onPress) {
    // Nessuna destinazione disponibile: il riepilogo resta leggibile ma non
    // finge di essere un pulsante (§9, §35).
    return (
      <View accessibilityLabel={accessibilityLabel} style={styles.summaryRow} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.summaryRow, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

/**
 * Errore locale di un modulo autorizzato (§24, master 06).
 *
 * Superficie neutra leggera e piccolo comando di retry: «Non usare un grande
 * banner rosso.» Il retry ricarica il solo dominio in errore — gli altri
 * moduli restano leggibili e utilizzabili, senza overlay globale né reset
 * dello scroll.
 */
export function TeamModuleError({
  icon = "document-text-outline",
  isRetrying = false,
  message,
  onRetry,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  isRetrying?: boolean;
  message: string;
  onRetry: () => void;
  testID?: string;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorBox} testID={testID}>
      <Ionicons color={colors.textMuted} name={icon} size={20} />

      <View style={styles.errorBody}>
        <AppText color="secondary" variant="bodySm">
          {message}
        </AppText>

        <Pressable
          accessibilityLabel={`Riprova: ${message}`}
          accessibilityRole="button"
          accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
          disabled={isRetrying}
          hitSlop={10}
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

/** Accesso testuale in coda a un modulo: "Vedi posizioni →" (§14). */
export function TeamModuleLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <AppText color="accent" variant="actionLabel">
        {label}
      </AppText>

      <Ionicons color={colors.accent} name="arrow-forward" size={15} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[14],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: spacing[24],
  },
  title: {
    flex: 1,
  },
  headerAction: {
    justifyContent: "center",
    minHeight: sizes.touchTarget - spacing[12],
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  summaryText: {
    flex: 1,
  },
  errorBox: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
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
  link: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
});
