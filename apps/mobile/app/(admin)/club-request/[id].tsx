import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../../src/features/auth/use-session";
import {
  fetchClubDetail,
  updateClubVerificationStatus,
  type AdminClubDetail,
} from "../../../src/features/admin/admin-service";
import { StatusBadge } from "../../../src/features/admin/components/status-badge";
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { AppText, Button, Card } from "../../../src/ui";

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
      <SafeAreaView style={styles.root}>
        <Header onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !club) {
    return (
      <SafeAreaView style={styles.root}>
        <Header onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <AppText variant="bodyLg" color="secondary" align="center">
            {error ?? "Richiesta non trovata."}
          </AppText>
          <Button label="Riprova" onPress={loadDetail} size="sm" variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const isPending = club.verification_status === "pending_review" || club.verification_status === "unverified";

  return (
    <SafeAreaView style={styles.root}>
      <Header onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isPending ? styles.scrollContentWithFooter : undefined,
        ]}
      >
        {/* Logo + Nome */}
        <View style={styles.clubHeader}>
          {club.logo_url ? (
            <Image
              accessibilityLabel={`Logo ${club.name}`}
              source={{ uri: club.logo_url }}
              style={styles.logo}
            />
          ) : null}
          <View style={styles.clubHeaderText}>
            <AppText variant="headingMd">{club.name}</AppText>
            <StatusBadge status={club.verification_status} />
          </View>
        </View>

        {/* Informazioni generali */}
        <Card>
          <AppText variant="titleSm">Informazioni generali</AppText>
          <View style={styles.detailGroup}>
            <DetailRow label="Anno di fondazione" value={club.founding_year?.toString() ?? null} />
            <DetailRow label="Categoria" value={club.category} />
            <DetailRow label="Colori sociali" value={club.club_colors} />
          </View>
        </Card>

        {/* Contatti */}
        <Card>
          <AppText variant="titleSm">Contatti</AppText>
          <View style={styles.detailGroup}>
            <DetailRow label="Email" value={club.club_email} />
            <DetailRow label="Telefono" value={club.club_phone} />
            <DetailRow label="Sito web" value={club.website_url} />
          </View>
        </Card>

        {/* Sedi */}
        <Card>
          <AppText variant="titleSm">Sedi</AppText>
          <View style={styles.detailGroup}>
            <DetailRow label="Citta" value={club.city} />
            <DetailRow label="Regione" value={club.region} />
            <DetailRow label="Paese" value={club.country} />
            <DetailRow label="Sede legale" value={club.headquarters_address} />
            <DetailRow label="Campo sportivo" value={club.field_address} />
          </View>
        </Card>

        {/* Responsabile */}
        <Card>
          <AppText variant="titleSm">Responsabile</AppText>
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
          <View style={styles.footerButton}>
            <Button
              disabled={isUpdating}
              label="Rifiuta iscrizione"
              onPress={() => handleAction("rejected")}
              size="md"
              variant="danger"
            />
          </View>
          <View style={styles.footerButton}>
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
      <AppText variant="titleMd">Dettaglio richiesta</AppText>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" color="muted">{label}</AppText>
      <AppText variant="bodySm">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  headerSpacer: {
    width: 24,
  },
  scrollContent: {
    gap: spacing[16],
    padding: spacing[20],
  },
  scrollContentWithFooter: {
    paddingBottom: 100,
  },
  clubHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  clubHeaderText: {
    flex: 1,
  },
  logo: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[14],
    height: 56,
    width: 56,
  },
  detailGroup: {
    gap: spacing[12],
  },
  detailRow: {
    gap: spacing[4],
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
  footerButton: {
    flex: 1,
  },
});
