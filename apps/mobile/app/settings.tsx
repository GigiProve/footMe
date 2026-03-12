import { Redirect, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../src/components/ui/screen";
import { useSession } from "../src/features/auth/use-session";
import { colors, radius, spacing, typography } from "../src/theme/tokens";
import { Button, Card } from "../src/ui";

export default function SettingsScreen() {
  const router = useRouter();
  const { isLoading, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Button
          label="Torna indietro"
          onPress={() => router.back()}
          size="sm"
          variant="link"
        />
        <Card style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Impostazioni</Text>
          </View>
          <Text style={styles.title}>Area impostazioni in preparazione</Text>
          <Text style={styles.description}>
            Questa schermata e' pronta come destinazione del drawer. I controlli
            di configurazione verranno aggiunti nei prossimi step senza rompere
            la navigazione utente.
          </Text>
          <Button
            label="Vai alla home"
            onPress={() => router.replace("/(tabs)")}
            variant="secondary"
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  badgeText: {
    color: colors.accentStrong,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.sm,
    textTransform: "uppercase",
  },
  card: {
    gap: spacing[16],
  },
  container: {
    flex: 1,
    gap: spacing[18],
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[16],
    lineHeight: typography.lineHeight[24],
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[28],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[32],
  },
});
