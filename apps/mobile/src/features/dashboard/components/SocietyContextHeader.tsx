import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type Props = {
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  onBack: () => void;
  /** Progresso «1 di 3 · Persona»: testo informativo, non un secondo back (§6). */
  step?: string | null;
  /**
   * Facoltativo: alcune pagine — il dettaglio di una persona, per esempio —
   * aprono direttamente sul proprio contenuto e non hanno un titolo di
   * pagina da ripetere sopra di esso.
   */
  title?: string | null;
  /** Uscita dal flusso focalizzato (§6). Nel Centro non esiste. */
  onCancel?: (() => void) | null;
  /**
   * Menu secondario della superficie (DAS-REV-27 §19: «nel menu del Centro
   * Shortlist, mostra Recupera liste soltanto agli actor con capability
   * adeguata»). Assente = nessun pulsante, non un pulsante disabilitato.
   */
  menu?: { accessibilityLabel: string; onPress: () => void } | null;
};

/**
 * Testata di una superficie gestionale in contesto Società.
 *
 * Nata in DAS-REV-19 come `InvitesCenterHeader` ed estratta qui da
 * DAS-REV-20, che ne ha la stessa identica necessità: back, stemma reale,
 * nome della Società e verifica quando disponibile. Duplicarla avrebbe
 * fatto divergere due intestazioni che il mockup mostra uguali.
 *
 * Testata condivisa dal Centro e dalle schermate del composer (§6, §12).
 *
 * «Il contesto mostra back, stemma reale, nome della società e verifica
 * quando disponibile» e «Mantiene una sola azione back, la società corrente
 * chiaramente visibile e un'uscita Annulla coerente con la shell».
 *
 * Il progresso è un `AppText`, non un controllo: §6 è esplicito — «Il
 * progresso 1 di 3 / 2 di 3 / 3 di 3 è testo informativo, non un secondo
 * pulsante back».
 *
 * L'identità non è tappabile: il Centro non ha un selector di Società.
 */
export function SocietyContextHeader({
  isVerified,
  logoUrl,
  name,
  onBack,
  menu,
  onCancel,
  step,
  title,
}: Props) {
  return (
    <View>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
          testID="invites-header-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
        </Pressable>

        <Avatar
          name={name}
          size="sm"
          square
          tone="ink"
          uri={logoUrl ?? undefined}
        />

        <AppText
          color="neutral"
          numberOfLines={1}
          style={styles.name}
          variant="titleSm"
        >
          {name}
        </AppText>

        {isVerified ? (
          <Ionicons
            accessibilityLabel="Società verificata"
            color={colors.accent}
            name="checkmark-circle"
            size={16}
          />
        ) : null}

        {onCancel ? (
          <Pressable
            accessibilityLabel="Annulla"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onCancel}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
            testID="invites-header-cancel"
          >
            <AppText color="accent" variant="actionLabel">
              Annulla
            </AppText>
          </Pressable>
        ) : null}

        {menu ? (
          <Pressable
            accessibilityLabel={menu.accessibilityLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={menu.onPress}
            style={({ pressed }) => [styles.menu, pressed ? styles.pressed : null]}
            testID="society-header-menu"
          >
            <Ionicons color={colors.textNeutral} name="ellipsis-horizontal" size={22} />
          </Pressable>
        ) : null}
      </View>

      {step ? (
        <AppText color="neutralMuted" style={styles.step} variant="meta">
          {step}
        </AppText>
      ) : null}

      {title ? (
        <AppText
          accessibilityRole="header"
          color="neutral"
          style={styles.title}
          variant="screenTitle"
        >
          {title}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  name: {
    flexShrink: 1,
    fontWeight: "600",
  },
  menu: {
    alignItems: "flex-end",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: "auto",
    width: sizes.touchTarget,
  },
  step: {
    paddingTop: spacing[8],
  },
  title: {
    paddingBottom: spacing[12],
    paddingTop: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
});
