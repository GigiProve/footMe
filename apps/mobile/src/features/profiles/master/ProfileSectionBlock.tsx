/**
 * Blocchi di sezione del Master Profile (REV-PROF-01 §25, §31, §36).
 *
 * Titolo di sezione, riga etichetta/valore e stato di errore locale: tre pezzi
 * neutri riusati da Carriera, Media e Dettagli, e disponibili alle tipologie di
 * profilo successive.
 */
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

type ProfileSectionBlockProps = {
  children: ReactNode;
  testID?: string;
  title: string;
};

export function ProfileSectionBlock({
  children,
  testID,
  title,
}: ProfileSectionBlockProps) {
  return (
    <View style={styles.section} testID={testID}>
      <AppText accessibilityRole="header" variant="titleMd">
        {title}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

type ProfileDetailRowProps = {
  /** Icona lineare a sinistra, neutra: mai un badge colorato (§26). */
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
  /** Valore assente: la riga non viene renderizzata affatto (§31). */
  value?: string;
};

export function ProfileDetailRow({
  icon,
  label,
  onPress,
  value,
}: ProfileDetailRowProps) {
  const content = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons color={colors.accent} name={icon} size={15} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText color="muted" variant="caption">
          {label}
        </AppText>
        {value ? <AppText variant="titleSm">{value}</AppText> : null}
      </View>
      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}${value ? `, ${value}` : ""}`} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`${label}${value ? `, ${value}` : ""}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      {content}
    </Pressable>
  );
}

type ProfileFactRowProps = {
  /** Ultima riga del gruppo: niente hairline appesa in fondo alla sezione. */
  isLast?: boolean;
  label: string;
  value: string;
};

/**
 * Riga etichetta a sinistra / valore a destra (REV-PROF-03, "Profilo
 * tecnico"). È la variante compatta di `ProfileDetailRow` per le coppie
 * label/valore senza icona: stessa altezza minima e la stessa hairline
 * `divider` fra le righe di uno stesso modulo.
 *
 * Il valore va a capo invece di essere troncato o rimpicciolito: categorie e
 * lingue multiple restano leggibili anche a 320 px.
 */
export function ProfileFactRow({
  isLast = false,
  label,
  value,
}: ProfileFactRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.factRow, isLast ? null : styles.factRowDivided]}
    >
      <AppText color="secondary" style={styles.factLabel} variant="bodySm">
        {label}
      </AppText>
      <AppText style={styles.factValue} variant="titleSm">
        {value}
      </AppText>
    </View>
  );
}

type ProfileSectionErrorProps = {
  /** Copy leggibile: mai status code, enum o nomi di API (§36). */
  message: string;
  onRetry?: () => void;
  testID?: string;
};

export function ProfileSectionError({
  message,
  onRetry,
  testID,
}: ProfileSectionErrorProps) {
  return (
    <View style={styles.error} testID={testID}>
      <AppText color="secondary" variant="bodySm">
        {message}
      </AppText>
      {onRetry ? (
        <Button label="Riprova" onPress={onRetry} size="sm" variant="secondary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    gap: spacing[10],
    padding: spacing[16],
  },
  factLabel: {
    flexShrink: 0,
    maxWidth: "45%",
  },
  factRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: spacing[10],
  },
  factRowDivided: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  factValue: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: "right",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingVertical: spacing[6],
  },
  rowIcon: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  sectionBody: {
    gap: spacing[4],
  },
});
