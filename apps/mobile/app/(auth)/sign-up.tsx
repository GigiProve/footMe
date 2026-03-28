import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import {
  AuthDivider,
  authStyles,
  SocialButtons,
} from "../../src/features/auth/components";
import { startOAuthSignIn } from "../../src/features/auth/oauth";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { AppText, Button, Input } from "../../src/ui";

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          <View style={styles.stepIndicator}>
            <View style={styles.stepTrack}>
              <View style={styles.stepFill} />
            </View>
            <AppText variant="caption" color="secondary">
              Passo 1 di 6
            </AppText>
          </View>

          <AppText variant="displaySm" style={authStyles.pageTitle}>
            Crea il tuo account
          </AppText>
          <AppText style={authStyles.pageDesc}>
            Entra nel network del calcio dilettantistico e completa il tuo
            posizionamento sportivo nel passo successivo.
          </AppText>

          <View style={authStyles.inputGroup}>
            <AppText style={authStyles.inputLabel}>Email</AppText>
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="es. mario.rossi@email.com"
              style={styles.inputField}
              value={email}
            />
          </View>

          <View style={authStyles.inputGroup}>
            <AppText style={authStyles.inputLabel}>Password</AppText>
            <View style={styles.passwordContainer}>
              <Input
                onChangeText={setPassword}
                placeholder="Almeno 6 caratteri"
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
          </View>

          <View style={authStyles.inputGroup}>
            <AppText style={authStyles.inputLabel}>Conferma password</AppText>
            <Input
              onChangeText={setConfirmPassword}
              placeholder="Ripeti la password"
              secureTextEntry={!showPassword}
              style={styles.inputField}
              value={confirmPassword}
            />
          </View>

          <Button
            disabled={isSubmitting}
            label={isSubmitting ? "Creazione account..." : "Registrati"}
            loading={isSubmitting}
            onPress={handleSignUp}
            size="lg"
            style={authStyles.primaryButton}
          />

          <AuthDivider />

          <SocialButtons
            loading={oauthProvider}
            onApple={() => handleOAuthSignIn("apple")}
            onGoogle={() => handleOAuthSignIn("google")}
          />

          <AppText variant="bodySm" color="muted" style={styles.bottomLink}>
            Hai gia' un account?{" "}
            <Link href="/(auth)/sign-in">
              <AppText variant="bodySm" style={styles.loginLink}>
                Accedi
              </AppText>
            </Link>
          </AppText>
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}

const TOTAL_ONBOARDING_STEPS = 6;
const STEP_FILL_PERCENTAGE = Math.round((1 / TOTAL_ONBOARDING_STEPS) * 100);

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    marginBottom: spacing[24],
  },
  stepTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  stepFill: {
    height: "100%",
    width: `${STEP_FILL_PERCENTAGE}%`,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
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
  bottomLink: {
    textAlign: "center",
    marginTop: spacing[32],
  },
  loginLink: {
    color: colors.accent,
    fontWeight: typography.fontWeight.semibold,
  },
});
