/**
 * Righe elenco del Master Profile Società (REV-PROF-17).
 *
 * Una sola riga per le squadre e una per le affiliate, riusate sia
 * nell'anteprima della tab Profilo sia nell'elenco completo: "Vedi tutte" non
 * deve inaugurare un secondo stile di lista.
 *
 * Ogni riga è interamente tappabile e il chevron non è mai l'unica etichetta:
 * l'accessibilityLabel dice cosa si apre.
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { getClubInitials } from "./SocietyProfileHeader";

type CrestProps = {
  name: string;
  uri: string | null;
};

function Crest({ name, uri }: CrestProps) {
  if (uri) {
    return (
      <Image
        resizeMode="contain"
        source={{ uri }}
        style={styles.crest}
      />
    );
  }

  return (
    <View style={styles.crestFallback}>
      <AppText color="inverse" variant="metaStrong">
        {getClubInitials(name)}
      </AppText>
    </View>
  );
}

type SocietyListRowProps = {
  isLast?: boolean;
  logoUrl: string | null;
  onPress: () => void;
  /** "Primavera 4", "Settore giovanile": la classificazione, non uno stato. */
  subtitle?: string | null;
  testID?: string;
  title: string;
};

/** Riga squadra o riga affiliata: stessa forma, significato diverso. */
export function SocietyListRow({
  isLast = false,
  logoUrl,
  onPress,
  subtitle,
  testID,
  title,
}: SocietyListRowProps) {
  return (
    <Pressable
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isLast ? null : styles.rowDivided,
        pressed ? styles.rowPressed : null,
      ]}
      testID={testID}
    >
      <Crest name={title} uri={logoUrl} />
      <View style={styles.rowText}>
        <AppText numberOfLines={1} variant="titleSm">
          {title}
        </AppText>
        {subtitle ? (
          <AppText color="muted" numberOfLines={1} variant="meta">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

type SocietyPersonRowProps = {
  avatarUrl: string | null;
  isLast?: boolean;
  name: string;
  /**
   * Assente su un record manuale: non è un profilo PROLINK, quindi la riga
   * non promette una navigazione che non esiste.
   */
  onPress?: () => void;
  roleLabel?: string | null;
  testID?: string;
};

export function SocietyPersonRow({
  avatarUrl,
  isLast = false,
  name,
  onPress,
  roleLabel,
  testID,
}: SocietyPersonRowProps) {
  const content = (
    <>
      <Avatar name={name} size="md" uri={avatarUrl ?? undefined} />
      <View style={styles.rowText}>
        <AppText numberOfLines={1} variant="titleSm">
          {name}
        </AppText>
        {roleLabel ? (
          <AppText color="muted" numberOfLines={1} variant="meta">
            {roleLabel}
          </AppText>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={roleLabel ? `${name}, ${roleLabel}` : name}
        style={[styles.row, isLast ? null : styles.rowDivided]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={
        roleLabel ? `${name}, ${roleLabel}, apri il profilo` : `${name}, apri il profilo`
      }
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isLast ? null : styles.rowDivided,
        pressed ? styles.rowPressed : null,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crest: {
    borderRadius: radius[10],
    height: 44,
    width: 44,
  },
  crestFallback: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius[10],
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 60,
    paddingVertical: spacing[8],
  },
  rowDivided: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
