import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Redirect, useRouter } from "expo-router";

import { Screen } from "../src/components/ui/screen";
import { KeyboardAwareForm } from "../src/components/ui/keyboard-aware-form";
import { useSession } from "../src/features/auth/use-session";
import { supabase } from "../src/lib/supabase";
import { spacing } from "../src/theme/tokens";
import { AppText, Badge, Button, Card, SectionCard } from "../src/ui";

export default function SettingsScreen() {
  const router = useRouter();
  const { isLoading, profile, refreshProfile, session } = useSession();
  const [isUnlinking, setIsUnlinking] = useState(false);

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const isClubAdmin = profile?.role === "club_admin";
  const hasClub = !!profile?.club_id;

  async function handleUnlinkClub() {
    if (!profile?.club_id) return;

    Alert.alert(
      "Scollega societa'",
      "Sei sicuro di voler scollegare il tuo profilo dalla societa'? Potrai ricollegarti in seguito.",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            setIsUnlinking(true);
            try {
              const { error } = await supabase
                .from("clubs")
                .update({ owner_profile_id: profile.id })
                .eq("id", profile.club_id!);

              if (error) throw error;

              await refreshProfile();
              Alert.alert("Fatto", "Profilo scollegato dalla societa'.");
            } catch {
              Alert.alert("Errore", "Impossibile scollegare il profilo.");
            } finally {
              setIsUnlinking(false);
            }
          },
          style: "destructive",
          text: "Scollega",
        },
      ],
    );
  }

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <Button
          label="Torna indietro"
          onPress={() => router.back()}
          size="sm"
          variant="link"
        />

        <AppText variant="displaySm">Impostazioni</AppText>

        {isClubAdmin ? (
          <SectionCard
            description="Gestisci il collegamento tra il tuo profilo e la societa'"
            title="Societa'"
          >
            {hasClub ? (
              <View style={styles.clubSection}>
                <AppText variant="bodySm" color="secondary">
                  Il tuo profilo e' attualmente collegato a: {profile?.club_name}
                </AppText>
                <Button
                  disabled={isUnlinking}
                  label={isUnlinking ? "Scollegamento..." : "Scollega profilo dalla societa'"}
                  onPress={handleUnlinkClub}
                  size="sm"
                  variant="danger"
                />
              </View>
            ) : (
              <View style={styles.clubSection}>
                <AppText variant="bodySm" color="secondary">
                  Nessuna societa' collegata al tuo profilo.
                </AppText>
                <Button
                  label="Vai alla home"
                  onPress={() => router.replace("/(tabs)")}
                  size="sm"
                  variant="secondary"
                />
              </View>
            )}
          </SectionCard>
        ) : null}

        <Card style={styles.card}>
          <Badge label="Generali" variant="accent" />
          <AppText variant="bodyLg" color="secondary">
            Altre impostazioni verranno aggiunte in questa sezione.
          </AppText>
          <Button
            label="Vai alla home"
            onPress={() => router.replace("/(tabs)")}
            variant="secondary"
          />
        </Card>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[16],
  },
  clubSection: {
    gap: spacing[12],
  },
  scrollContent: {
    gap: spacing[18],
  },
});
