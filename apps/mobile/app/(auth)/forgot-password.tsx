import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { authStyles } from "../../src/features/auth/components";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { AppText, Button, Input } from "../../src/ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleResetPassword() {
    const trimmed = email.trim();
    if (!trimmed) return;

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);

      if (error) {
        Alert.alert("Errore", error.message);
      } else {
        setEmailSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.screen}>
      <View style={authStyles.headerNav}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={() => router.back()}
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
            Recupera password
          </AppText>
          <AppText style={authStyles.pageDesc}>
            Inserisci l'email associata al tuo account. Ti invieremo un link per
            creare una nuova password.
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

          {emailSent ? (
            <View style={styles.successBox}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.successForeground}
              />
              <AppText variant="bodySm" style={styles.successText}>
                Email inviata! Controlla la tua casella di posta.
              </AppText>
            </View>
          ) : null}

          <Button
            disabled={isSubmitting || (emailSent && !email.trim())}
            label={isSubmitting ? "Invio in corso..." : "Invia link di recupero"}
            loading={isSubmitting}
            onPress={handleResetPassword}
            size="lg"
            style={authStyles.primaryButton}
          />
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
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderRadius: 6,
    backgroundColor: colors.successSoft,
    marginTop: spacing[8],
    marginBottom: spacing[24],
  },
  successText: {
    color: colors.successForeground,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
});
