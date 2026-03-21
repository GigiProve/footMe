import { Redirect, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Screen } from "../src/components/ui/screen";
import { useSession } from "../src/features/auth/use-session";
import { spacing } from "../src/theme/tokens";
import { AppText, Badge, Button, Card } from "../src/ui";

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
          <Badge label="Impostazioni" variant="accent" />
          <AppText variant="displaySm">
            Area impostazioni in preparazione
          </AppText>
          <AppText variant="bodyLg" color="secondary">
            Questa schermata e' pronta come destinazione del drawer. I controlli
            di configurazione verranno aggiunti nei prossimi step senza rompere
            la navigazione utente.
          </AppText>
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
  card: {
    gap: spacing[16],
  },
  container: {
    flex: 1,
    gap: spacing[18],
  },
});
