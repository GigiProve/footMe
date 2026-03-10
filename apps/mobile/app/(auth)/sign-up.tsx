import { Link } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme/tokens";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        Alert.alert("Registrazione non riuscita", error.message);
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

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        <View style={{ gap: 10 }}>
          <Text
            style={{
              color: colors.hero,
              fontSize: 12,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
          >
            Join The Network
          </Text>
          <Text
            style={{
              fontSize: 34,
              lineHeight: 38,
              fontWeight: "800",
              color: colors.textPrimary,
            }}
          >
            Crea il tuo account
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: colors.textSecondary,
            }}
          >
            Entra nel portale con una registrazione essenziale e completa il tuo
            posizionamento sportivo nel passo successivo.
          </Text>
        </View>
        <View
          style={{
            gap: 14,
            padding: 18,
            borderRadius: 24,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
            }}
            value={email}
          />
          <TextInput
            secureTextEntry
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
            }}
            value={password}
          />
          <TextInput
            secureTextEntry
            onChangeText={setConfirmPassword}
            placeholder="Conferma password"
            placeholderTextColor={colors.textMuted}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
            }}
            value={confirmPassword}
          />
          <Pressable
            disabled={isSubmitting}
            onPress={handleSignUp}
            style={{
              paddingVertical: 15,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isSubmitting ? "#6AA687" : colors.accent,
            }}
          >
            <Text
              style={{
                color: colors.inkInvert,
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              {isSubmitting ? "Creazione account..." : "Registrati"}
            </Text>
          </Pressable>
        </View>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: colors.accentStrong, fontWeight: "700" }}>
              Hai gia' un account? Accedi
            </Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
