import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Button } from "../../../../../ui";

type Props = {
  /** Resa accanto alla primaria invece che sopra, come lo screen 12. */
  inlineSecondary?: ReactNode;
  /** Testo neutro sopra le azioni: «La posizione Primavera resterà in bozza.» */
  helper?: string | null;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLabel: string;
  primaryLoading?: boolean;
  primaryTestID?: string;
  /** §4: «Salva come bozze — secondaria discreta, non seconda primaria.» */
  secondaryLabel?: string | null;
  secondaryLoading?: boolean;
  secondaryOnPress?: () => void;
  secondaryTestID?: string;
};

/**
 * Rail delle azioni del composer (DAS-REV-16 §4).
 *
 * «Le primarie hanno fondo blu PROLINK saturo e testo bianco.» «Il footer
 * resta sopra safe area e tastiera, con spazio di scorrimento sufficiente
 * dopo l'ultimo campo.»
 *
 * «Salva come bozze» è un testo premuto, non un secondo pulsante pieno: §4
 * la vuole «secondaria discreta, non seconda primaria equivalente», e nel
 * PNG è infatti una riga blu senza cornice.
 */
export function ComposerFooter({
  helper,
  inlineSecondary,
  onPrimary,
  primaryDisabled = false,
  primaryLabel,
  primaryLoading = false,
  primaryTestID,
  secondaryLabel,
  secondaryLoading = false,
  secondaryOnPress,
  secondaryTestID,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
      {helper ? (
        <AppText align="center" color="neutralMuted" variant="meta">
          {helper}
        </AppText>
      ) : null}

      <View style={inlineSecondary ? styles.inlineRow : undefined}>
        {inlineSecondary}

        <View style={inlineSecondary ? styles.inlinePrimary : undefined}>
          <Button
            disabled={primaryDisabled}
            fullWidth
            label={primaryLabel}
            loading={primaryLoading}
            onPress={onPrimary}
            testID={primaryTestID}
          />
        </View>
      </View>

      {secondaryLabel && secondaryOnPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: secondaryLoading }}
          disabled={secondaryLoading}
          onPress={secondaryOnPress}
          style={({ pressed }) => [styles.secondary, pressed ? styles.pressed : null]}
          testID={secondaryTestID}
        >
          <AppText align="center" color="accent" variant="actionLabel">
            {secondaryLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  inlinePrimary: {
    flex: 1,
  },
  inlineRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  pressed: {
    opacity: 0.7,
  },
  secondary: {
    justifyContent: "center",
    minHeight: spacing[32],
  },
});
