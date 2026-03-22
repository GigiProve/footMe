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
import { colors, radius, spacing } from "../../src/theme/tokens";
import { AppText, Badge, Button, Card, StatCard } from "../../src/ui";

type HighlightTone = "accent" | "hero" | "muted";

const toneMap: Record<string, HighlightTone> = {
  accent: "accent",
  hero: "hero",
};

export default function HomeScreen() {
  const { profile, session } = useSession();

  if (profile?.role === "club_admin") {
    return <ClubDashboard />;
  }
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

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const backendLabel = hasSupabaseEnv ? "Collegato" : "Da collegare";
  const displayName =
    dashboard?.profile.fullName ?? profile?.full_name ?? "Utente autenticato";
  const displayRole = dashboard?.summary.title ?? "Profilo in caricamento";

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.heroBanner}>
          <AppText variant="overline" color="inverseSoft" style={styles.heroBadge}>
            Amateur Football Network
          </AppText>
          <AppText variant="displayLg" color="inverse">
            footMe
          </AppText>
          <AppText variant="bodyLg" color="inverseSoft">
            {dashboard?.summary.body ??
              "Il tuo profilo sportivo, la tua rete di contatti e le opportunita' giuste nello stesso posto."}
          </AppText>
        </View>

        <View style={styles.statRow}>
          <Card elevated style={styles.profileCard}>
            <AppText variant="overline" color="muted">
              Profilo
            </AppText>
            <AppText variant="titleMd">{displayName}</AppText>
            <AppText variant="bodySm" color="secondary">
              {displayRole}
            </AppText>
          </Card>
          <StatCard
            label="Stato backend"
            tone="muted"
            value={backendLabel}
          />
        </View>

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
          <AppText variant="overline">Landing autenticata</AppText>
          <AppText variant="headingSm">
            {dashboard?.summary.kicker ??
              "Dashboard iniziale del network calcistico"}
          </AppText>
          <AppText variant="bodySm" color="secondary">
            {dashboard
              ? [
                  dashboard.profile.region,
                  dashboard.profile.city,
                  dashboard.profile.clubName,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                "I dati reali del profilo sono arrivati da Supabase."
              : "Questa schermata e' il punto di ingresso del feed, del recruiting e della rete contatti. Collega Supabase reale per sostituire i placeholder."}
          </AppText>
          {dashboard?.profile.isOpenToTransfer ? (
            <Badge label="Aperto a nuove opportunita'" variant="hero" />
          ) : null}
          {!hasSupabaseEnv ? (
            <AppText variant="bodySm" color="hero">
              Configura `apps/mobile/.env.local` con URL e anon key del progetto
              Supabase per usare auth e dashboard reali.
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
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing[18],
  },
  heroBanner: {
    gap: spacing[12],
    padding: spacing[24],
    borderRadius: radius[28],
    backgroundColor: colors.surfaceInverse,
  },
  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.full,
    overflow: "hidden",
    backgroundColor: colors.surfaceOverlay,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  profileCard: {
    flex: 1,
  },
  selfStart: {
    alignSelf: "flex-start",
  },
});
