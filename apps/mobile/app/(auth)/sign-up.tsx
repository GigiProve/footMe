import { Link } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { startOAuthSignIn } from "../../src/features/auth/oauth";
import { hasSupabaseEnv, supabase } from "../../src/lib/supabase";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Join The Network</Text>
          <Text style={styles.title}>Crea il tuo account</Text>
          <Text style={styles.description}>
            Entra nel portale con una registrazione essenziale e completa il tuo
            posizionamento sportivo nel passo successivo.
          </Text>
          {__DEV__ ? (
            <Text style={styles.debugText}>
              Supabase env: {hasSupabaseEnv ? "live" : "missing"} · key prefix:{" "}
              {String(
                process.env.EXPO_PUBLIC_SUPABASE_KEY ??
                  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
                  "missing",
              ).slice(0, 12)}
            </Text>
          ) : null}
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
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>oppure registrati con</Text>
            <View style={styles.dividerLine} />
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
          <Pressable style={styles.linkButton}>
            <Text style={styles.linkLabel}>Hai gia' un account? Accedi</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: spacing[18],
  },
  header: {
    gap: spacing[10],
  },
  eyebrow: {
    color: colors.hero,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.heavy,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.md,
  },
  title: {
    fontSize: typography.fontSize[34],
    lineHeight: typography.lineHeight[38],
    fontWeight: typography.fontWeight.heavy,
    color: colors.textPrimary,
  },
  description: {
    fontSize: typography.fontSize[16],
    lineHeight: typography.lineHeight[24],
    color: colors.textSecondary,
  },
  debugText: {
    fontSize: typography.fontSize[12],
    lineHeight: 18,
    color: colors.textMuted,
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
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: spacing[8],
  },
  linkLabel: {
    color: colors.accentStrong,
    fontWeight: typography.fontWeight.bold,
  },
});
