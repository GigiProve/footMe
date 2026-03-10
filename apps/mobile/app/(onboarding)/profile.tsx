import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import {
  createInitialProfile,
  type AppRole,
  type PlayerPosition,
  type StaffSpecialization,
} from "../../src/features/onboarding/create-initial-profile";
import { colors } from "../../src/theme/tokens";

const roles: Array<{ label: string; value: AppRole }> = [
  { label: "Calciatore", value: "player" },
  { label: "Allenatore", value: "coach" },
  { label: "Staff", value: "staff" },
  { label: "Societa'", value: "club_admin" },
];

const positions: Array<{ label: string; value: PlayerPosition }> = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

const specializations: Array<{ label: string; value: StaffSpecialization }> = [
  { label: "Preparatore atletico", value: "fitness_coach" },
  { label: "Preparatore portieri", value: "goalkeeper_coach" },
  { label: "Fisioterapista", value: "physiotherapist" },
  { label: "Match analyst", value: "match_analyst" },
  { label: "Team manager", value: "team_manager" },
  { label: "Altro", value: "other" },
];

export default function OnboardingProfileScreen() {
  const { refreshProfile, session } = useSession();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("player");
  const [primaryPosition, setPrimaryPosition] =
    useState<PlayerPosition>("midfielder");
  const [staffSpecialization, setStaffSpecialization] =
    useState<StaffSpecialization>("fitness_coach");
  const [clubName, setClubName] = useState("");
  const [clubCity, setClubCity] = useState("");
  const [clubRegion, setClubRegion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleHint = useMemo(() => {
    switch (role) {
      case "player":
        return "Imposta il profilo base del calciatore per poi completare carriera e statistiche.";
      case "coach":
        return "Crea il profilo allenatore: licenze e storico squadre arriveranno nel prossimo step.";
      case "staff":
        return "Definisci la specializzazione per avviare il profilo professionale di staff.";
      case "club_admin":
        return "Crea la pagina iniziale della societa' con i dati minimi richiesti.";
    }
  }, [role]);

  async function handleSubmit() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await createInitialProfile({
        clubCity,
        clubName,
        clubRegion,
        fullName,
        primaryPosition,
        role,
        staffSpecialization,
        userId: session.user.id,
      });

      await refreshProfile();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso durante l'onboarding.";
      Alert.alert("Onboarding non completato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 28 }}>
        <View
          style={{
            gap: 10,
            padding: 22,
            borderRadius: 26,
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              color: colors.heroSoft,
              fontSize: 12,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
          >
            Initial Setup
          </Text>
          <Text
            style={{
              fontSize: 32,
              lineHeight: 36,
              fontWeight: "800",
              color: colors.inkInvert,
            }}
          >
            Completa il profilo iniziale
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: "rgba(255,253,252,0.78)",
            }}
          >
            Scegli il ruolo e crea i dati minimi per entrare nella piattaforma.
          </Text>
        </View>

        <View
          style={{
            gap: 16,
            padding: 18,
            borderRadius: 24,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TextInput
            onChangeText={setFullName}
            placeholder="Nome e cognome"
            placeholderTextColor={colors.textMuted}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
            }}
            value={fullName}
          />

          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
              Ruolo
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {roles.map((entry) => {
                const isActive = role === entry.value;

                return (
                  <Pressable
                    key={entry.value}
                    onPress={() => setRole(entry.value)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: isActive
                        ? colors.textPrimary
                        : colors.background,
                      borderWidth: 1,
                      borderColor: isActive
                        ? colors.textPrimary
                        : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.inkInvert : colors.textPrimary,
                        fontWeight: "700",
                      }}
                    >
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
              {roleHint}
            </Text>
          </View>

          {role === "player" ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                Ruolo in campo
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {positions.map((entry) => {
                  const isActive = primaryPosition === entry.value;

                  return (
                    <Pressable
                      key={entry.value}
                      onPress={() => setPrimaryPosition(entry.value)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: isActive
                          ? colors.accent
                          : colors.background,
                        borderWidth: 1,
                        borderColor: isActive ? colors.accent : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive
                            ? colors.inkInvert
                            : colors.textPrimary,
                          fontWeight: "700",
                        }}
                      >
                        {entry.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {role === "staff" ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                Specializzazione
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {specializations.map((entry) => {
                  const isActive = staffSpecialization === entry.value;

                  return (
                    <Pressable
                      key={entry.value}
                      onPress={() => setStaffSpecialization(entry.value)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: isActive
                          ? colors.accent
                          : colors.background,
                        borderWidth: 1,
                        borderColor: isActive ? colors.accent : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive
                            ? colors.inkInvert
                            : colors.textPrimary,
                          fontWeight: "700",
                        }}
                      >
                        {entry.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {role === "club_admin" ? (
            <View style={{ gap: 12 }}>
              <TextInput
                onChangeText={setClubName}
                placeholder="Nome societa'"
                placeholderTextColor={colors.textMuted}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                }}
                value={clubName}
              />
              <TextInput
                onChangeText={setClubCity}
                placeholder="Citta'"
                placeholderTextColor={colors.textMuted}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                }}
                value={clubCity}
              />
              <TextInput
                onChangeText={setClubRegion}
                placeholder="Regione"
                placeholderTextColor={colors.textMuted}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                }}
                value={clubRegion}
              />
            </View>
          ) : null}

          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={{
              paddingVertical: 15,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isSubmitting ? "#6AA687" : colors.hero,
            }}
          >
            <Text
              style={{
                color: colors.inkInvert,
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              {isSubmitting ? "Salvataggio..." : "Completa onboarding"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
