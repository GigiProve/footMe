import { Pressable, Text, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import { hasSupabaseEnv, supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme/tokens";

export default function HomeScreen() {
  const { profile } = useSession();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

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
              backgroundColor: "rgba(255,253,252,0.12)",
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
              color: "rgba(255,253,252,0.82)",
            }}
          >
            Il tuo profilo sportivo, la tua rete di contatti e le opportunita'
            giuste nello stesso posto.
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
              {profile?.full_name ?? "Utente autenticato"}
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
              {hasSupabaseEnv ? "Pronto" : "Da collegare"}
            </Text>
          </View>
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
            Primo look & feel
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Dashboard iniziale del network calcistico
          </Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
            Questa schermata e' il punto di ingresso del feed, del recruiting e
            della rete contatti. Il prossimo passo naturale e' sostituire questi
            blocchi con dati reali da Supabase.
          </Text>
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
