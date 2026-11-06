import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type Props = {
  city?: string | null;
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  region?: string | null;
  testID?: string;
};

/**
 * Identità compatta del club (§12, screen 02, 04, 05, 06, 07).
 *
 * «Titolo Richiedi conferma del ruolo, identità compatta del club», con lo
 * stemma reale e la verifica quando esiste.
 *
 * §5: «Il normale check blu appartiene alla società verificata; non
 * trasferirlo alla squadra o all'incarico.» Il check è quindi qui e non
 * sulle righe del ruolo.
 */
export function ClubIdentityRow({
  city,
  isVerified,
  logoUrl,
  name,
  region,
  testID,
}: Props) {
  const place = [city, region].filter(Boolean).join(" · ");

  return (
    <View
      accessible
      accessibilityLabel={[name, isVerified ? "verificata" : null, place]
        .filter(Boolean)
        .join(", ")}
      style={styles.row}
      testID={testID}
    >
      <Avatar name={name} size="md" square tone="ink" uri={logoUrl ?? undefined} />

      <View style={styles.body}>
        <View style={styles.nameRow}>
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
              color={colors.accent}
              name="checkmark-circle"
              size={16}
            />
          ) : null}
        </View>

        {place ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {place}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  name: {
    flexShrink: 1,
    fontWeight: "600",
  },
});
