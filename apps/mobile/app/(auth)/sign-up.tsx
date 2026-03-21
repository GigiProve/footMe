import { Link } from "expo-router";
import { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import { startOAuthSignIn } from "../../src/features/auth/oauth";
import { supabase } from "../../src/lib/supabase";
import { spacing } from "../../src/theme/tokens";
import { AppText, Button, Card, Divider, Input } from "../../src/ui";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"apple" | "google" | null>(
    null,
  );

  async function handleSignUp() {
    if (password !== confirmPassword) {
      Alert.alert(
        "Password non valide",
        "Le password inserite non coincidono.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert(
          "Registrazione non riuscita",
          error.code ? `${error.code}: ${error.message}` : error.message,
        );
        return;
      }

      if (!data.session) {
        Alert.alert(
          "Controlla la tua email",
          "Se la conferma email e' attiva, completa la verifica prima di accedere.",
        );
        return;
      }

      Alert.alert("Account creato", "Completa ora il profilo iniziale.");
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
          : "Errore inatteso durante la registrazione social.";
      Alert.alert("Registrazione social non riuscita", message);
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
            Join The Network
          </AppText>
          <AppText variant="displayLg">Crea il tuo account</AppText>
          <AppText variant="bodyLg" color="secondary">
            Entra nel portale con una registrazione essenziale e completa il tuo
            posizionamento sportivo nel passo successivo.
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
          <Input
            onChangeText={setConfirmPassword}
            placeholder="Conferma password"
            secureTextEntry
            value={confirmPassword}
          />
          <Button
            disabled={isSubmitting}
            label={isSubmitting ? "Creazione account..." : "Registrati"}
            onPress={handleSignUp}
          />
          <View style={styles.socialDivider}>
            <Divider style={styles.dividerLine} />
            <AppText variant="overline" color="muted">
              oppure registrati con
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
        <Link href="/(auth)/sign-in" asChild>
          <Button
            label="Hai gia' un account? Accedi"
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
