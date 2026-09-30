/**
 * Card compatta della situazione attuale (REV-PROF-03; REV-PROF-06 §"Sezione
 * situazione attuale").
 *
 * Logo, nome società, categoria e ruolo dell'incarico in corso. Il chevron
 * compare solo se la riga porta davvero da qualche parte: una società senza
 * pagina PROLINK mostra comunque i suoi dati, ma non promette una navigazione
 * che non esiste e non diventa interattiva.
 *
 * Vive fra i pezzi Master perché è la stessa card per ogni tipologia di
 * profilo con una carriera di incarichi: l'Allenatore e lo Staff tecnico la
 * usano identica.
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ProfileCurrentClubRowProps = {
  category: string;
  clubName: string;
  logoUrl: string;
  onPress?: () => void;
  role: string;
  testID?: string;
};

export function ProfileCurrentClubRow({
  category,
  clubName,
  logoUrl,
  onPress,
  role,
  testID,
}: ProfileCurrentClubRowProps) {
  const accessibilityLabel = [clubName, category, role].filter(Boolean).join(", ");
  const content = (
    <>
      <ClubLogo logoUrl={logoUrl} />
      <View style={styles.situationText}>
        <AppText numberOfLines={2} variant="titleSm">
          {clubName}
        </AppText>
        {category ? (
          <AppText color="secondary" variant="meta">
            {category}
          </AppText>
        ) : null}
        {role ? (
          <AppText color="secondary" variant="meta">
            {role}
          </AppText>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={styles.situationRow}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.situationRow,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

/** Logo assente: il placeholder del design system, mai un'immagine rotta. */
function ClubLogo({ logoUrl }: { logoUrl: string }) {
  if (logoUrl) {
    return (
      <View style={styles.clubLogo}>
        <Image source={{ uri: logoUrl }} style={styles.clubLogoImage} />
      </View>
    );
  }

  return (
    <View style={[styles.clubLogo, styles.clubLogoFallback]}>
      <Ionicons color={colors.accent} name="shield-outline" size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  clubLogo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 36,
    overflow: "hidden",
    width: 36,
  },
  clubLogoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  clubLogoImage: {
    height: "100%",
    width: "100%",
  },
  pressed: {
    opacity: 0.6,
  },
  situationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingVertical: spacing[4],
  },
  situationText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
