import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useSession } from "../../../src/features/auth/use-session";
import {
  fetchClubDetail,
  updateClubVerificationStatus,
  type AdminClubDetail,
} from "../../../src/features/admin/admin-service";
import { StatusBadge } from "../../../src/features/admin/components/status-badge";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../src/theme/tokens";
import { Button, Card } from "../../../src/ui";

export default function AdminClubRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const router = useRouter();
  const [club, setClub] = useState<AdminClubDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchClubDetail(id);
      setClub(data);
    } catch {
      setError("Impossibile caricare i dettagli della richiesta.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function handleAction(action: "verified" | "rejected") {
    if (!club || !profile) {
      return;
    }

    const isApprove = action === "verified";

    Alert.alert(
      isApprove ? "Approva iscrizione" : "Rifiuta iscrizione",
      `Vuoi ${isApprove ? "approvare" : "rifiutare"} l'iscrizione di "${club.name}"?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: isApprove ? "Approva" : "Rifiuta",
          style: isApprove ? "default" : "destructive",
          onPress: async () => {
            try {
              setIsUpdating(true);
              await updateClubVerificationStatus(club.id, action, profile.id);
              router.back();
            } catch {
              Alert.alert("Errore", "Operazione non riuscita. Riprova.");
              setIsUpdating(false);
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
        <Header onBack={() => router.back()} />
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !club) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
        <Header onBack={() => router.back()} />
        <View style={{ alignItems: "center", flex: 1, gap: spacing[16], justifyContent: "center", paddingHorizontal: spacing[20] }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize[16], textAlign: "center" }}>
            {error ?? "Richiesta non trovata."}
          </Text>
          <Button label="Riprova" onPress={loadDetail} size="sm" variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const isPending = club.verification_status === "pending_review" || club.verification_status === "unverified";

  return (
    <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
      <Header onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ gap: spacing[16], padding: spacing[20], paddingBottom: isPending ? 100 : spacing[20] }}
      >
        {/* Logo + Nome */}
        <View style={{ alignItems: "center", gap: spacing[12], flexDirection: "row" }}>
          {club.logo_url ? (
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius[14],
                height: 56,
                width: 56,
              }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontSize: typography.fontSize[20], fontWeight: typography.fontWeight.heavy }}>
              {club.name}
            </Text>
            <StatusBadge status={club.verification_status} />
          </View>
        </View>

        {/* Informazioni generali */}
        <Card>
          <Text style={styles.sectionTitle}>Informazioni generali</Text>
          <View style={{ gap: spacing[12] }}>
            <DetailRow label="Anno di fondazione" value={club.founding_year?.toString() ?? null} />
            <DetailRow label="Categoria" value={club.category} />
            <DetailRow label="Colori sociali" value={club.club_colors} />
          </View>
        </Card>

        {/* Contatti */}
        <Card>
          <Text style={styles.sectionTitle}>Contatti</Text>
          <View style={{ gap: spacing[12] }}>
            <DetailRow label="Email" value={club.club_email} />
            <DetailRow label="Telefono" value={club.club_phone} />
            <DetailRow label="Sito web" value={club.website_url} />
          </View>
        </Card>

        {/* Sedi */}
        <Card>
          <Text style={styles.sectionTitle}>Sedi</Text>
          <View style={{ gap: spacing[12] }}>
            <DetailRow label="Citta" value={club.city} />
            <DetailRow label="Regione" value={club.region} />
            <DetailRow label="Paese" value={club.country} />
            <DetailRow label="Sede legale" value={club.headquarters_address} />
            <DetailRow label="Campo sportivo" value={club.field_address} />
          </View>
        </Card>

        {/* Responsabile */}
        <Card>
          <Text style={styles.sectionTitle}>Responsabile</Text>
          <DetailRow label="Nome" value={club.owner_full_name} />
        </Card>

        {/* Meta */}
        <Card variant="muted">
          <DetailRow
            label="Data registrazione"
            value={new Date(club.created_at).toLocaleDateString("it-IT", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          />
        </Card>
      </ScrollView>

      {/* Footer azioni */}
      {isPending ? (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Button
              disabled={isUpdating}
              label="Rifiuta iscrizione"
              onPress={() => handleAction("rejected")}
              size="md"
              variant="danger"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              disabled={isUpdating}
              label="Approva iscrizione"
              onPress={() => handleAction("verified")}
              size="md"
              variant="primary"
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable hitSlop={8} onPress={onBack}>
        <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
      </Pressable>
      <Text style={styles.headerTitle}>Dettaglio richiesta</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[12] }}>
        {label}
      </Text>
      <Text style={{ color: colors.textPrimary, fontSize: typography.fontSize[14] }}>
        {value}
      </Text>
    </View>
  );
}

const styles = {
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.semibold,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: spacing[12],
    left: 0,
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    position: "absolute",
    right: 0,
  },
} as const;
