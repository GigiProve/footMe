import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import {
  clearLastAccount,
  LastAccount,
  loadLastAccount,
  loadLastCredentials,
  saveLastAccountCredentials,
} from "../../src/features/auth/last-account";
import { startOAuthSignIn } from "../../src/features/auth/oauth";
import { withDefaultProfileAvatar } from "../../src/features/profiles/profile-avatar";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, shadows, spacing } from "../../src/theme/tokens";
import { AppText, Button, Card, Divider, Input } from "../../src/ui";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"apple" | "google" | null>(
    null,
  );
  const [lastAccount, setLastAccount] = useState<LastAccount | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function load() {
      const [account, credentials] = await Promise.all([
        loadLastAccount(),
        loadLastCredentials(),
      ]);
      if (account && credentials && account.email === credentials.email) {
        setLastAccount(account);
        setHasCredentials(true);
      }
    }
    load();
  }, []);

  async function handleQuickLogin() {
    const credentials = await loadLastCredentials();
    if (!credentials) {
      Alert.alert("Sessione scaduta", "Inserisci le credenziali manualmente.");
      handleSwitchAccount();
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        Alert.alert("Accesso non riuscito", error.message);
        handleSwitchAccount();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSwitchAccount() {
    clearLastAccount();
    setLastAccount(null);
    setHasCredentials(false);
    setDismissed(true);
  }

  async function handleSignIn() {
    const loginEmail = email.trim();
    if (!loginEmail) return;

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        Alert.alert("Accesso non riuscito", error.message);
      } else {
        await saveLastAccountCredentials(loginEmail, password);
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

  const showQuickLogin = lastAccount !== null && hasCredentials && !dismissed;

  return (
    <Screen>
      <KeyboardAwareForm
        contentContainerStyle={styles.container}
        keyboardVerticalOffset={spacing[16]}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <AppText variant="headingMd" color="inverse">
                F
              </AppText>
            </View>
            <AppText variant="displaySm" color="accent">
              FootMe
            </AppText>
          </View>
          <AppText variant="bodySm" color="secondary" style={styles.tagline}>
            Il network professionale del calcio dilettantistico
          </AppText>
        </View>

        {showQuickLogin ? (
          <Card style={styles.quickLoginCard}>
            <Pressable
              accessibilityLabel={`Accedi come ${lastAccount.fullName ?? lastAccount.email}`}
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleQuickLogin}
              style={({ pressed }) => [
                styles.quickLoginRow,
                pressed ? styles.quickLoginPressed : null,
              ]}
            >
              <Image
                accessibilityLabel="Avatar ultimo utente"
                source={{
                  uri: withDefaultProfileAvatar(lastAccount.avatarUrl),
                }}
                style={styles.quickLoginAvatar}
              />
              <View style={styles.quickLoginText}>
                <AppText variant="bodySm" color="secondary">
                  {isSubmitting ? "Accesso in corso..." : "Accedi come"}
                </AppText>
                <AppText variant="titleMd">
                  {lastAccount.fullName ?? lastAccount.email}
                </AppText>
              </View>
            </Pressable>
            <Divider />
            <Button
              label="Usa un altro account"
              onPress={handleSwitchAccount}
              size="sm"
              variant="link"
            />
          </Card>
        ) : (
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
        )}
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
    alignItems: "center",
    gap: spacing[8],
    marginBottom: spacing[12],
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: radius[10],
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  tagline: {
    textAlign: "center",
  },
  formCard: {
    gap: spacing[14],
  },
  quickLoginCard: {
    alignItems: "center",
    gap: spacing[14],
    paddingVertical: spacing[24],
  },
  quickLoginRow: {
    alignItems: "center",
    borderRadius: radius[16],
    gap: spacing[14],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
    width: "100%",
  },
  quickLoginPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  quickLoginAvatar: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 2,
    height: 80,
    width: 80,
    ...shadows.card,
  },
  quickLoginText: {
    alignItems: "center",
    gap: spacing[4],
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
