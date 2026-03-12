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
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Welcome Back</Text>
          <Text style={styles.title}>Accedi a footMe</Text>
          <Text style={styles.description}>
            Entra nel network del calcio dilettantistico con un accesso pulito,
            rapido e orientato alla tua identita' sportiva.
          </Text>
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
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>oppure continua con</Text>
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
        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.linkLabel}>Non hai un account? Crea il tuo profilo</Text>
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
