import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import {
  getHomeDashboard,
  type HomeDashboardData,
} from "../../src/features/home/home-dashboard-service";
import { useSession } from "../../src/features/auth/use-session";
import { hasSupabaseEnv, supabase } from "../../src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "../../src/theme/tokens";
import { Button } from "../../src/ui";

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

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const backendLabel = hasSupabaseEnv ? "Collegato" : "Da collegare";
  const displayName =
    dashboard?.profile.fullName ?? profile?.full_name ?? "Utente autenticato";
  const displayRole = dashboard?.summary.title ?? "Profilo in caricamento";

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing[18] }}>
        <View
          style={{
            gap: spacing[12],
            padding: 24,
            borderRadius: radius[28],
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.full,
              overflow: "hidden",
              backgroundColor: colors.surfaceOverlay,
              color: colors.inkInvert,
              fontSize: typography.fontSize[12],
              fontWeight: typography.fontWeight.bold,
              letterSpacing: typography.letterSpacing.sm,
              textTransform: "uppercase",
            }}
          >
            Amateur Football Network
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize[34],
              lineHeight: typography.lineHeight[38],
              fontWeight: typography.fontWeight.heavy,
              color: colors.inkInvert,
            }}
          >
            footMe
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize[18],
              lineHeight: typography.lineHeight[28],
              color: colors.textInverseSoft,
            }}
          >
            {dashboard?.summary.body ??
              "Il tuo profilo sportivo, la tua rete di contatti e le opportunita' giuste nello stesso posto."}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[12] }}>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: radius[22],
              backgroundColor: colors.surface,
              ...shadows.card,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.fontSize[12],
                fontWeight: typography.fontWeight.bold,
                textTransform: "uppercase",
              }}
            >
              Profilo
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: typography.fontSize[17],
                fontWeight: typography.fontWeight.bold,
              }}
            >
              {displayName}
            </Text>
            <Text style={{ marginTop: 4, color: colors.textSecondary }}>
              {displayRole}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: radius[22],
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.fontSize[12],
                fontWeight: typography.fontWeight.bold,
                textTransform: "uppercase",
              }}
            >
              Stato backend
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: typography.fontSize[17],
                fontWeight: typography.fontWeight.bold,
              }}
            >
              {backendLabel}
            </Text>
            <Text style={{ marginTop: 4, color: colors.textSecondary }}>
              {session?.user.email ?? "Auth non disponibile"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[12] }}>
          {(dashboard?.highlights ?? []).map((highlight) => {
            const backgroundColor =
              highlight.tone === "accent"
                ? colors.accentSoft
                : highlight.tone === "hero"
                  ? colors.heroSoft
                  : colors.surfaceMuted;

            const textColor =
              highlight.tone === "hero" ? colors.hero : colors.textPrimary;

            return (
              <View
                key={highlight.label}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: radius[20],
                  backgroundColor,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: typography.fontSize[12],
                    fontWeight: typography.fontWeight.bold,
                    textTransform: "uppercase",
                  }}
                >
                  {highlight.label}
                </Text>
                <Text
                  style={{
                    marginTop: 10,
                    color: textColor,
                    fontSize: typography.fontSize[26],
                    fontWeight: typography.fontWeight.heavy,
                  }}
                >
                  {isLoadingDashboard ? "..." : highlight.value}
                </Text>
              </View>
            );
          })}
        </View>

        <View
          style={{
            gap: spacing[12],
            padding: 18,
            borderRadius: radius[24],
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize[12],
              fontWeight: typography.fontWeight.heavy,
              color: colors.textPrimary,
              letterSpacing: typography.letterSpacing.sm,
              textTransform: "uppercase",
            }}
          >
            Landing autenticata
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: typography.fontSize[18],
              fontWeight: typography.fontWeight.bold,
            }}
          >
            {dashboard?.summary.kicker ??
              "Dashboard iniziale del network calcistico"}
          </Text>
          <Text style={{ color: colors.textSecondary, lineHeight: typography.lineHeight[22] }}>
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
          </Text>
          {dashboard?.profile.isAvailable ? (
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: colors.accentSoft,
              }}
            >
              <Text style={{ color: colors.accentStrong, fontWeight: typography.fontWeight.bold }}>
                Disponibile ora
              </Text>
            </View>
          ) : null}
          {dashboard?.profile.isOpenToTransfer ? (
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: colors.heroSoft,
              }}
            >
              <Text style={{ color: colors.hero, fontWeight: typography.fontWeight.bold }}>
                Aperto a nuove opportunita'
              </Text>
            </View>
          ) : null}
          {!hasSupabaseEnv ? (
            <Text style={{ color: colors.hero, lineHeight: typography.lineHeight[22] }}>
              Configura `apps/mobile/.env.local` con URL e anon key del progetto
              Supabase per usare auth e dashboard reali.
            </Text>
          ) : null}
          <Button
            label="Aggiorna dati reali"
            onPress={loadDashboard}
            size="sm"
            style={{ alignSelf: "flex-start" }}
            variant="secondary"
          />
        </View>

        <Button
          label="Esci"
          onPress={handleSignOut}
          size="sm"
          style={{ alignSelf: "flex-start" }}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
