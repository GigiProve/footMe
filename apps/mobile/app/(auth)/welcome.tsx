import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AuthDivider,
  authStyles,
  SocialButtons,
} from "../../src/features/auth/components";
import { startOAuthSignIn } from "../../src/features/auth/oauth";
import { colors, spacing } from "../../src/theme/tokens";
import { AppText, Button } from "../../src/ui";

const HERO_IMAGE_URI =
  "https://storage.googleapis.com/banani-generated-images/generated-images/9623ef71-57ea-4d27-9ad2-2f940fb49880.jpg";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [oauthProvider, setOauthProvider] = useState<"apple" | "google" | null>(
    null,
  );

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
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO_IMAGE_URI }} style={styles.heroImage} />
        <LinearGradient
          colors={["transparent", colors.surface]}
          locations={[0.3, 0.95]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing[40]) }]}>
        <AppText variant="displaySm" style={styles.title}>
          Il network del calcio dilettantistico
        </AppText>
        <AppText variant="bodyLg" color="muted" style={styles.subtitle}>
          Connettiti, fatti notare, trova opportunità
        </AppText>

        <SocialButtons
          loading={oauthProvider}
          onApple={() => handleOAuthSignIn("apple")}
          onGoogle={() => handleOAuthSignIn("google")}
        />

        <AuthDivider />

        <Button
          label="Accedi"
          onPress={() => router.push("/(auth)/sign-in")}
          size="lg"
          style={authStyles.primaryButton}
        />
        <Button
          label="Registrati"
          onPress={() => router.push("/(auth)/sign-up")}
          size="lg"
          style={styles.outlineBtn}
          textStyle={styles.outlineBtnText}
          variant="outline"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    flex: 1,
    minHeight: 340,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bottom: {
    paddingHorizontal: spacing[24],
    backgroundColor: colors.surface,
  },
  title: {
    marginBottom: spacing[12],
  },
  subtitle: {
    marginBottom: spacing[32],
  },
  outlineBtn: {
    ...authStyles.outlineButton,
    marginTop: spacing[16],
  },
  outlineBtnText: {
    color: colors.accent,
    fontWeight: "600",
  },
});
