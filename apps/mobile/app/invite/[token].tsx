import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import { joinClubViaInvite } from "../../src/features/clubs/invite-service";
import { colors, spacing } from "../../src/theme/tokens";
import { AppText, Button } from "../../src/ui";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session) {
      // Not authenticated — redirect to sign-in
      // The token will be in the URL when they come back
      router.replace("/(auth)/sign-in");
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMessage("Link di invito non valido.");
      return;
    }

    async function join() {
      try {
        await joinClubViaInvite(token!);
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Errore nel collegamento alla societa'",
        );
      }
    }

    join();
  }, [session, token, router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {status === "loading" ? (
          <>
            <ActivityIndicator color={colors.accent} size="large" />
            <AppText variant="bodyLg" color="secondary">
              Collegamento alla societa' in corso...
            </AppText>
          </>
        ) : null}

        {status === "success" ? (
          <>
            <AppText variant="headingMd">Collegamento riuscito</AppText>
            <AppText variant="bodyLg" color="secondary">
              Ti sei collegato alla societa'. L'amministratore e' stato
              notificato.
            </AppText>
            <Button
              label="Vai alla home"
              onPress={() => router.replace("/(tabs)")}
              variant="primary"
            />
          </>
        ) : null}

        {status === "error" ? (
          <>
            <AppText variant="headingMd">Errore</AppText>
            <AppText variant="bodyLg" color="secondary">
              {errorMessage}
            </AppText>
            <Button
              label="Vai alla home"
              onPress={() => router.replace("/(tabs)")}
              variant="secondary"
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    padding: spacing[20],
  },
});
