import {
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

/**
 * Il modulo — la regola che tutte le pagine seguono (§1a del design
 * "ProLink UI Upgrade"). Un solo contenitore, ripetuto ovunque, in tre parti:
 *
 *   1. Eyebrow — 10,5px maiuscolo. Dice sempre perché quel blocco è lì:
 *      "Per te", "Carriera", "In base al tuo profilo".
 *   2. Corpo — titolo, meta, media. Passato come `children`.
 *   3. Rail azioni — 44px fissi, hairline sopra, azioni a sinistra, salva a
 *      destra. Sempre nella stessa posizione, in ogni pagina.
 *
 * La barra blu di 3px a sinistra (`personalized`) è l'unico segnale di
 * personalizzazione del sistema: compare solo quando il contenuto è stato
 * scelto per l'utente. Non va usata per decorare.
 */
export type ContentModuleAction = {
  accessibilityLabel?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
  /** `accent` è l'azione principale del rail; `muted` le secondarie. */
  tone?: "accent" | "muted";
};

type ContentModuleProps = PropsWithChildren<{
  actions?: readonly ContentModuleAction[];
  /** Testo dell'eyebrow. Omesso, il modulo parte direttamente dal corpo. */
  eyebrow?: string;
  /** Nota allineata a destra dell'eyebrow: "In base al tuo profilo", "2 h fa". */
  eyebrowNote?: string;
  onPress?: () => void;
  /** Contenuto a piena larghezza sotto al corpo, senza padding (media, liste). */
  bleed?: ReactNode;
  personalized?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Elemento in fondo a destra nel rail: di norma il bookmark "salva". */
  trailing?: ReactNode;
}>;

export function ContentModule({
  actions,
  bleed,
  children,
  eyebrow,
  eyebrowNote,
  onPress,
  personalized = false,
  style,
  testID,
  trailing,
}: ContentModuleProps) {
  const hasRail = (actions?.length ?? 0) > 0 || trailing != null;

  const body = (
    <>
      {eyebrow || eyebrowNote ? (
        <View style={styles.eyebrowRow}>
          {eyebrow ? (
            <AppText
              color={personalized ? "accent" : "muted"}
              style={styles.eyebrow}
              variant="eyebrow"
            >
              {eyebrow}
            </AppText>
          ) : (
            <View style={styles.eyebrowSpacer} />
          )}
          {eyebrowNote ? (
            <AppText color="muted" variant="caption">
              {eyebrowNote}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <View style={[styles.module, style]} testID={onPress ? undefined : testID}>
      {personalized ? <View style={styles.personalizedRail} /> : null}

      {onPress ? (
        // Il testID segue l'elemento interattivo: chi cerca il modulo per
        // toccarlo trova direttamente ciò che risponde al tocco.
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.body,
            pressed ? styles.pressed : null,
          ]}
          testID={testID}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.body}>{body}</View>
      )}

      {bleed}

      {hasRail ? (
        <View style={styles.rail}>
          {actions?.map((action) => (
            <Pressable
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              accessibilityRole="button"
              disabled={!action.onPress}
              hitSlop={8}
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                pressed ? styles.pressed : null,
              ]}
            >
              {action.icon ? (
                <Ionicons
                  color={
                    action.tone === "muted"
                      ? colors.textSecondary
                      : colors.accent
                  }
                  name={action.icon}
                  size={15}
                />
              ) : null}
              <AppText
                color={action.tone === "muted" ? "secondary" : "accent"}
                style={action.tone === "muted" ? styles.mutedAction : null}
                variant="actionLabel"
              >
                {action.label}
              </AppText>
            </Pressable>
          ))}
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  module: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
  personalizedRail: {
    backgroundColor: colors.accent,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: sizes.personalizedRail,
    zIndex: 1,
  },
  body: {
    paddingBottom: spacing[14],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[14],
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
    marginBottom: spacing[10],
  },
  eyebrow: {
    flexShrink: 1,
  },
  eyebrowSpacer: {
    flex: 1,
  },
  rail: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[20],
    height: sizes.actionRail,
    paddingHorizontal: spacing[16],
  },
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  mutedAction: {
    fontWeight: "600",
  },
  trailing: {
    marginLeft: "auto",
  },
  pressed: {
    opacity: 0.7,
  },
});
