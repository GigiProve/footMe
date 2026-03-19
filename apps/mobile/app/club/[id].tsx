import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../src/features/auth/use-session";
import {
  fetchPublicClubProfile,
  submitClubClaim,
  submitClubReport,
  type PublicClubProfile,
} from "../../src/features/clubs/club-service";
import { VerificationBadge } from "../../src/features/clubs/verification-badge";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { Screen } from "../../src/components/ui/screen";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

type ReportClaimMode = "claim" | "report" | null;

export default function ClubProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const router = useRouter();

  const [club, setClub] = useState<PublicClubProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ReportClaimMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Claim form
  const [claimRole, setClaimRole] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimMessage, setClaimMessage] = useState("");

  // Report form
  const [reportReason, setReportReason] = useState("");

  const loadClub = useCallback(async () => {
    if (!id) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchPublicClubProfile(id);
      setClub(data);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClub();
  }, [loadClub]);

  async function handleSubmitClaim() {
    if (!profile || !club) {
      return;
    }

    try {
      setIsSubmitting(true);
      await submitClubClaim({
        claimantEmail: claimEmail,
        claimantProfileId: profile.id,
        claimantRoleAtClub: claimRole,
        clubId: club.id,
        message: claimMessage,
      });
      setModalMode(null);
      resetForms();
      Alert.alert("Richiesta inviata", "La tua rivendicazione è stata inviata e sarà valutata dal nostro team.");
    } catch {
      Alert.alert("Errore", "Rivendicazione già inviata oppure errore di rete.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReport() {
    if (!profile || !club) {
      return;
    }

    try {
      setIsSubmitting(true);
      await submitClubReport({
        clubId: club.id,
        reason: reportReason,
        reporterProfileId: profile.id,
      });
      setModalMode(null);
      resetForms();
      Alert.alert("Segnalazione inviata", "Grazie per la segnalazione. Il nostro team la valuterà.");
    } catch {
      Alert.alert("Errore", "Segnalazione già inviata oppure errore di rete.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForms() {
    setClaimRole("");
    setClaimEmail("");
    setClaimMessage("");
    setReportReason("");
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (!club) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ alignItems: "center", flex: 1, gap: spacing[16], justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize[16] }}>
            Società non trovata.
          </Text>
          <Button label="Torna indietro" onPress={() => router.back()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScrollView contentContainerStyle={{ gap: spacing[16], paddingBottom: 28 }}>
        <Pressable
          accessibilityLabel="Torna indietro"
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start" }}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>

        <Card style={{ gap: spacing[12] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[12] }}>
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
            <View style={{ flex: 1, gap: spacing[4] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[20],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                {club.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize[14] }}>
                {club.city}, {club.region}
              </Text>
            </View>
          </View>
          <VerificationBadge status={club.verification_status} />
        </Card>

        {club.description ? (
          <Card style={{ gap: spacing[8] }}>
            <Text style={styles.sectionTitle}>Descrizione</Text>
            <Text style={styles.bodyText}>{club.description}</Text>
          </Card>
        ) : null}

        <Card style={{ gap: spacing[10] }}>
          <Text style={styles.sectionTitle}>Informazioni</Text>
          {club.founding_year ? (
            <InfoRow label="Anno di fondazione" value={String(club.founding_year)} />
          ) : null}
          {club.club_colors ? <InfoRow label="Colori sociali" value={club.club_colors} /> : null}
          {club.country ? <InfoRow label="Nazione" value={club.country} /> : null}
          {club.headquarters_address ? (
            <InfoRow label="Sede" value={club.headquarters_address} />
          ) : null}
          {club.field_address ? <InfoRow label="Campo" value={club.field_address} /> : null}
        </Card>

        <Card style={{ gap: spacing[10] }}>
          <Text style={styles.sectionTitle}>Contatti</Text>
          {club.club_email ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${club.club_email}`)}>
              <InfoRow label="Email" value={club.club_email!} />
            </Pressable>
          ) : null}
          {club.club_phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${club.club_phone}`)}>
              <InfoRow label="Telefono" value={club.club_phone!} />
            </Pressable>
          ) : null}
          {club.website_url ? (
            <Pressable onPress={() => Linking.openURL(club.website_url!)}>
              <InfoRow label="Sito web" value={club.website_url!} />
            </Pressable>
          ) : null}
          {!club.club_email && !club.club_phone && !club.website_url ? (
            <Text style={styles.emptyText}>Nessun contatto disponibile.</Text>
          ) : null}
        </Card>

        {club.owner_full_name ? (
          <Card style={{ gap: spacing[8] }}>
            <Text style={styles.sectionTitle}>Responsabile</Text>
            <Text style={styles.bodyText}>{club.owner_full_name}</Text>
          </Card>
        ) : null}

        <Pressable
          onPress={() =>
            Alert.alert("Segnala o rivendica", "Cosa vuoi fare con questa società?", [
              { text: "Annulla", style: "cancel" },
              { text: "Rivendica come mia", onPress: () => setModalMode("claim") },
              { text: "Segnala come falsa", style: "destructive", onPress: () => setModalMode("report") },
            ])
          }
          style={{ alignItems: "center", paddingVertical: spacing[12] }}
        >
          <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[14] }}>
            Segnala o rivendica questa società
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setModalMode(null)}
        presentationStyle="pageSheet"
        visible={modalMode === "claim"}
      >
        <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalMode(null)}>
              <Ionicons color={colors.textPrimary} name="close" size={24} />
            </Pressable>
            <Text style={styles.modalTitle}>Rivendica società</Text>
            <View style={{ width: 24 }} />
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: spacing[16], padding: spacing[20] }}>
            <Text style={styles.bodyText}>
              Se questa è la tua società, compila il modulo e il nostro team
              verificherà la tua richiesta.
            </Text>
            <Input
              label="Il tuo ruolo nella società *"
              onChangeText={setClaimRole}
              placeholder="Es. Presidente, Direttore sportivo"
              value={claimRole}
            />
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email di contatto *"
              onChangeText={setClaimEmail}
              placeholder="Es. nome@societa.it"
              value={claimEmail}
            />
            <Input
              label="Messaggio aggiuntivo"
              multiline
              onChangeText={setClaimMessage}
              placeholder="Spiega perché questa società è la tua..."
              value={claimMessage}
            />
            <Button
              disabled={isSubmitting || !claimRole.trim() || !claimEmail.trim()}
              label={isSubmitting ? "Invio..." : "Invia rivendicazione"}
              onPress={handleSubmitClaim}
              variant="primary"
            />
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setModalMode(null)}
        presentationStyle="pageSheet"
        visible={modalMode === "report"}
      >
        <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalMode(null)}>
              <Ionicons color={colors.textPrimary} name="close" size={24} />
            </Pressable>
            <Text style={styles.modalTitle}>Segnala società</Text>
            <View style={{ width: 24 }} />
          </View>
          <KeyboardAwareScrollView contentContainerStyle={{ gap: spacing[16], padding: spacing[20] }}>
            <Text style={styles.bodyText}>
              Se ritieni che questa pagina non rappresenti una società reale,
              invia una segnalazione.
            </Text>
            <Input
              label="Motivo della segnalazione *"
              multiline
              onChangeText={setReportReason}
              placeholder="Spiega perché ritieni che questa pagina sia falsa..."
              value={reportReason}
            />
            <Button
              disabled={isSubmitting || !reportReason.trim()}
              label={isSubmitting ? "Invio..." : "Invia segnalazione"}
              onPress={handleSubmitReport}
              variant="danger"
            />
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[8] }}>
      <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize[14] }}>
        {label}
      </Text>
      <Text
        style={{
          color: colors.textPrimary,
          flex: 1,
          fontSize: typography.fontSize[14],
          fontWeight: typography.fontWeight.bold,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = {
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[14],
    lineHeight: 22,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.fontSize[14],
  },
  modalHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
  },
} as const;
