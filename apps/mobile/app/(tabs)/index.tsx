import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import {
  getHomeDashboard,
  type HomeDashboardData,
} from "../../src/features/home/home-dashboard-service";
import { useSession } from "../../src/features/auth/use-session";
import { ClubDashboard } from "../../src/features/clubs/components/ClubDashboard";
import { hasSupabaseEnv, supabase } from "../../src/lib/supabase";
import { spacing } from "../../src/theme/tokens";
import { AppText, Badge, Button, Card, StatCard, TopBar } from "../../src/ui";

type HighlightTone = "accent" | "hero" | "muted";

const toneMap: Record<string, HighlightTone> = {
  accent: "accent",
  hero: "hero",
};

export default function HomeScreen() {
  const { profile, session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? null;
  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setIsLoadingDashboard(true);
      const nextDashboard = await getHomeDashboard(userId, userEmail);
      setDashboard(nextDashboard);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento della home reale.";
      Alert.alert("Home non disponibile", message);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [userEmail, userId]);

  useEffect(() => {
    if (!userId || !profile?.id) {
      setDashboard(null);
      setIsLoadingDashboard(false);
      return;
    }

    loadDashboard();
  }, [loadDashboard, profile?.id, userId]);

  if (profile?.role === "club_admin") {
    return <ClubDashboard />;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const displayName =
    dashboard?.profile.fullName ?? profile?.full_name ?? "Utente autenticato";
  const displayRole = dashboard?.summary.title ?? "Profilo in caricamento";

  return (
    <Screen>
      <View style={styles.container}>
        <TopBar searchPlaceholder="Cerca giocatori, squadre..." />

        <View style={styles.feedContent}>
          <Card>
            <AppText variant="overline" color="muted">
              Profilo
            </AppText>
            <AppText variant="titleMd">{displayName}</AppText>
            <AppText variant="bodySm" color="secondary">
              {displayRole}
            </AppText>
            {dashboard?.profile.isOpenToTransfer ? (
              <Badge label="Aperto a nuove opportunita'" variant="hero" />
            ) : null}
          </Card>

          <View style={styles.statRow}>
            {(dashboard?.highlights ?? []).map((highlight) => (
              <StatCard
                key={highlight.label}
                label={highlight.label}
                tone={toneMap[highlight.tone] ?? "muted"}
                value={isLoadingDashboard ? "..." : highlight.value}
              />
            ))}
          </View>

          <Card>
            <AppText variant="titleSm">
              {dashboard?.summary.kicker ??
                "Dashboard iniziale del network calcistico"}
            </AppText>
            <AppText variant="bodySm" color="secondary">
              {dashboard?.summary.body ??
                "Il tuo profilo sportivo, la tua rete di contatti e le opportunita' giuste nello stesso posto."}
            </AppText>
            {!hasSupabaseEnv ? (
              <AppText variant="bodySm" color="hero">
                Configura `apps/mobile/.env.local` con URL e anon key del
                progetto Supabase per usare auth e dashboard reali.
              </AppText>
            ) : null}
            <Button
              label="Aggiorna dati reali"
              onPress={loadDashboard}
              size="sm"
              style={styles.selfStart}
              variant="secondary"
            />
          </Card>

          <Button
            label="Esci"
            onPress={handleSignOut}
            size="sm"
            style={styles.selfStart}
            variant="tertiary"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  feedContent: {
    gap: spacing[12],
    padding: spacing[16],
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  selfStart: {
    alignSelf: "flex-start",
  },
});
