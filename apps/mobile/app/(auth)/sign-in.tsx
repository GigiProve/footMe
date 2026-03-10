import { useState } from "react";
import { Link } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme/tokens";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            Welcome Back
          </Text>
          <Text
            style={{
              fontSize: 34,
              lineHeight: 38,
              fontWeight: "800",
              color: colors.textPrimary,
            }}
          >
            Accedi a footMe
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: colors.textSecondary,
            }}
          >
            Entra nel network del calcio dilettantistico con un accesso pulito,
            rapido e orientato alla tua identita' sportiva.
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
          <Pressable
            disabled={isSubmitting}
            onPress={handleSignIn}
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
              {isSubmitting ? "Accesso in corso..." : "Accedi"}
            </Text>
          </Pressable>
        </View>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: colors.accentStrong, fontWeight: "700" }}>
              Non hai un account? Crea il tuo profilo
            </Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
