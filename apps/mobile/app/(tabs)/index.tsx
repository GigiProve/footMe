import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import {
  getHomeDashboard,
  type HomeDashboardData,
} from "../../src/features/home/home-dashboard-service";
import { useSession } from "../../src/features/auth/use-session";
import { hasSupabaseEnv, supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme/tokens";

export default function HomeScreen() {
  const { profile, session } = useSession();
  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  useEffect(() => {
    if (!session?.user || !profile) {
      setDashboard(null);
      setIsLoadingDashboard(false);
      return;
    }

    loadDashboard();
  }, [profile?.id, session?.user?.id]);

  async function loadDashboard() {
    if (!session?.user) {
      return;
    }

    try {
      setIsLoadingDashboard(true);
      const nextDashboard = await getHomeDashboard(
        session.user.id,
        session.user.email ?? null,
      );
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
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const backendLabel = hasSupabaseEnv ? "Collegato" : "Da collegare";
  const displayName =
    dashboard?.profile.fullName ?? profile?.full_name ?? "Utente autenticato";
  const displayRole = dashboard?.summary.title ?? "Profilo in caricamento";

  return (
    <Screen>
      <View style={{ flex: 1, gap: 18 }}>
        <View
          style={{
            gap: 12,
            padding: 24,
            borderRadius: 28,
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: colors.surfaceOverlay,
              color: colors.inkInvert,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Amateur Football Network
          </Text>
          <Text
            style={{
              fontSize: 34,
              lineHeight: 38,
              fontWeight: "800",
              color: colors.inkInvert,
            }}
          >
            footMe
          </Text>
          <Text
            style={{
              fontSize: 18,
              lineHeight: 28,
              color: colors.textInverseSoft,
            }}
          >
            {dashboard?.summary.body ??
              "Il tuo profilo sportivo, la tua rete di contatti e le opportunita' giuste nello stesso posto."}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 22,
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              shadowOpacity: 1,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Profilo
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: 17,
                fontWeight: "700",
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
              borderRadius: 22,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Stato backend
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              {backendLabel}
            </Text>
            <Text style={{ marginTop: 4, color: colors.textSecondary }}>
              {session?.user.email ?? "Auth non disponibile"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
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
                  borderRadius: 20,
                  backgroundColor,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  {highlight.label}
                </Text>
                <Text
                  style={{
                    marginTop: 10,
                    color: textColor,
                    fontSize: 26,
                    fontWeight: "800",
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
            gap: 12,
            padding: 18,
            borderRadius: 24,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: colors.textPrimary,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Landing autenticata
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            {dashboard?.summary.kicker ??
              "Dashboard iniziale del network calcistico"}
          </Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
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
                borderRadius: 999,
                backgroundColor: colors.accentSoft,
              }}
            >
              <Text style={{ color: colors.accentStrong, fontWeight: "700" }}>
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
                borderRadius: 999,
                backgroundColor: colors.heroSoft,
              }}
            >
              <Text style={{ color: colors.hero, fontWeight: "700" }}>
                Aperto a nuove opportunita'
              </Text>
            </View>
          ) : null}
          {!hasSupabaseEnv ? (
            <Text style={{ color: colors.hero, lineHeight: 22 }}>
              Configura `apps/mobile/.env.local` con URL e anon key del progetto
              Supabase per usare auth e dashboard reali.
            </Text>
          ) : null}
          <Pressable
            onPress={loadDashboard}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
              Aggiorna dati reali
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSignOut}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 18,
            paddingVertical: 13,
            borderRadius: 999,
            backgroundColor: colors.hero,
          }}
        >
          <Text style={{ color: colors.inkInvert, fontWeight: "700" }}>
            Esci
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
