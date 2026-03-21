import { Link } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import { startOAuthSignIn } from "../../src/features/auth/oauth";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing } from "../../src/theme/tokens";
import { AppText, Button, Card, Divider, Input } from "../../src/ui";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"apple" | "google" | null>(
    null,
  );

  async function handleSignIn() {
    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert("Accesso non riuscito", error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOAuthSignIn(provider: "apple" | "google") {
    try {
      setOauthProvider(provider);
      await startOAuthSignIn(provider);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso durante l'accesso social.";
      Alert.alert("Accesso social non riuscito", message);
    } finally {
      setOauthProvider(null);
    }
  }

  return (
    <Screen>
      <KeyboardAwareForm
        contentContainerStyle={styles.container}
        keyboardVerticalOffset={spacing[16]}
      >
        <View style={styles.header}>
          <AppText variant="overline" color="hero">
            Welcome Back
          </AppText>
          <AppText variant="displayLg">Accedi a footMe</AppText>
          <AppText variant="bodyLg" color="secondary">
            Entra nel network del calcio dilettantistico con un accesso pulito,
            rapido e orientato alla tua identita' sportiva.
          </AppText>
        </View>
        <Card style={styles.formCard}>
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            value={email}
          />
          <Input
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            value={password}
          />
          <Button
            disabled={isSubmitting}
            label={isSubmitting ? "Accesso in corso..." : "Accedi"}
            onPress={handleSignIn}
          />
          <View style={styles.socialDivider}>
            <Divider style={styles.dividerLine} />
            <AppText variant="overline" color="muted">
              oppure continua con
            </AppText>
            <Divider style={styles.dividerLine} />
          </View>
          <Button
            disabled={oauthProvider !== null}
            label={
              oauthProvider === "google"
                ? "Connessione a Google..."
                : "Continua con Google"
            }
            onPress={() => handleOAuthSignIn("google")}
            variant="secondary"
          />
          {Platform.OS === "ios" ? (
            <Button
              disabled={oauthProvider !== null}
              label={
                oauthProvider === "apple"
                  ? "Connessione ad Apple..."
                  : "Continua con Apple"
              }
              onPress={() => handleOAuthSignIn("apple")}
              variant="secondary"
            />
          ) : null}
        </Card>
        <Link href="/(auth)/sign-up" asChild>
          <Button
            label="Non hai un account? Crea il tuo profilo"
            size="sm"
            style={styles.linkButton}
            variant="link"
          />
        </Link>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    gap: spacing[18],
  },
  header: {
    gap: spacing[10],
  },
  formCard: {
    gap: spacing[14],
  },
  socialDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
  },
  dividerLine: {
    flex: 1,
  },
  linkButton: {
    alignSelf: "center",
  },
});
