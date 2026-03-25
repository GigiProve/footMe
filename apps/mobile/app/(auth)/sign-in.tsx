import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import {
  AuthDivider,
  authStyles,
  SocialButtons,
} from "../../src/features/auth/components";
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
import { colors, radius, shadows, spacing, typography } from "../../src/theme/tokens";
import { AppText, Button, Card, Divider, Input } from "../../src/ui";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      setErrorMessage(null);

      const { error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        setErrorMessage("Credenziali errate. Riprova.");
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
      setErrorMessage(null);

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        setErrorMessage("Credenziali errate. Riprova.");
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
    <SafeAreaView style={authStyles.screen}>
      <View style={authStyles.headerNav}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={() => router.replace("/(auth)/welcome")}
          style={authStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAwareForm
        contentContainerStyle={styles.scrollContent}
        keyboardVerticalOffset={spacing[16]}
      >
        <View style={authStyles.contentPad}>
          <AppText variant="displaySm" style={authStyles.pageTitle}>
            Bentornato
          </AppText>
          <AppText style={authStyles.pageDesc}>
            Accedi per continuare a fare networking nel mondo del calcio.
          </AppText>

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
            <>
              <View style={authStyles.inputGroup}>
                <AppText style={authStyles.inputLabel}>Email</AppText>
                <Input
                  autoCapitalize="none"
                  error={errorMessage !== null}
                  keyboardType="email-address"
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrorMessage(null);
                  }}
                  placeholder="mario.rossi@email.com"
                  style={styles.inputField}
                  value={email}
                />
              </View>

              <View style={authStyles.inputGroup}>
                <AppText style={authStyles.inputLabel}>Password</AppText>
                <View style={styles.passwordContainer}>
                  <Input
                    error={errorMessage !== null}
                    onChangeText={(text) => {
                      setPassword(text);
                      setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? "Nascondi password" : "Mostra password"}
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye" : "eye-off"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
                {errorMessage ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <AppText variant="bodySm" color="danger">
                      {errorMessage}
                    </AppText>
                  </View>
                ) : null}
              </View>

              <Link href="/(auth)/forgot-password" asChild>
                <Pressable style={styles.forgotLink}>
                  <AppText variant="bodySm" style={styles.forgotText}>
                    Password dimenticata?
                  </AppText>
                </Pressable>
              </Link>

              <Button
                disabled={isSubmitting}
                label={isSubmitting ? "Accesso in corso..." : "Accedi"}
                loading={isSubmitting}
                onPress={handleSignIn}
                size="lg"
                style={styles.loginButton}
              />

              <AuthDivider />

              <SocialButtons
                loading={oauthProvider}
                onApple={() => handleOAuthSignIn("apple")}
                onGoogle={() => handleOAuthSignIn("google")}
              />

              <AppText variant="bodySm" color="muted" style={styles.bottomLink}>
                Non hai un account?{" "}
                <Link href="/(auth)/sign-up">
                  <AppText variant="bodySm" style={styles.registerLink}>
                    Registrati
                  </AppText>
                </Link>
              </AppText>
            </>
          )}
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  inputField: {
    minHeight: 56,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    minHeight: 56,
    paddingRight: spacing[48],
  },
  eyeButton: {
    position: "absolute",
    right: spacing[16],
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 40,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    marginTop: spacing[8],
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -spacing[4],
    marginBottom: spacing[24],
  },
  forgotText: {
    color: colors.accent,
    fontWeight: typography.fontWeight.semibold,
  },
  loginButton: {
    ...authStyles.primaryButton,
    marginTop: spacing[8],
  },
  bottomLink: {
    textAlign: "center",
    marginTop: spacing[32],
  },
  registerLink: {
    color: colors.accent,
    fontWeight: typography.fontWeight.semibold,
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
});
