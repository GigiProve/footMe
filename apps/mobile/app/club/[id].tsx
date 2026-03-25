import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../src/features/auth/use-session";
import {
  fetchPublicClubProfile,
  submitClubClaim,
  submitClubReport,
  type PublicClubProfile,
} from "../../src/features/clubs/club-service";
import { requestClubMembership } from "../../src/features/clubs/membership-service";
import type { MemberRole } from "../../src/features/clubs/membership-types";
import { fetchClubTeams, type ClubTeam } from "../../src/features/clubs/team-service";
import { VerificationBadge } from "../../src/features/clubs/verification-badge";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { Screen } from "../../src/components/ui/screen";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { AppText, Button, Card, Input, ModalHeader } from "../../src/ui";

type ReportClaimMode = "claim" | "report" | "join" | null;

export default function ClubProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const router = useRouter();

  const [club, setClub] = useState<PublicClubProfile | null>(null);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ReportClaimMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Claim form
  const [claimRole, setClaimRole] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimMessage, setClaimMessage] = useState("");

  // Report form
  const [reportReason, setReportReason] = useState("");

  // Join form
  const [joinRole, setJoinRole] = useState<MemberRole | "">("");

  const loadClub = useCallback(async () => {
    if (!id) {
      return;
    }

    setIsLoading(true);

    try {
      const [clubData, teamsData] = await Promise.all([
        fetchPublicClubProfile(id),
        fetchClubTeams(id),
      ]);
      setClub(clubData);
      setTeams(teamsData);
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
    setJoinRole("");
  }

  async function handleJoinClub() {
    if (!profile || !club || !joinRole) {
      return;
    }

    try {
      setIsSubmitting(true);
      await requestClubMembership({
        clubId: club.id,
        memberRole: joinRole,
        profileId: profile.id,
      });
      setModalMode(null);
      resetForms();
      Alert.alert(
        "Collegamento effettuato",
        "Ti sei collegato alla societa'. L'amministratore puo' gestire la tua appartenenza.",
      );
    } catch {
      Alert.alert("Errore", "Collegamento gia' effettuato oppure errore di rete.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (!club) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContainer}>
          <AppText variant="bodyLg" color="secondary">
            Società non trovata.
          </AppText>
          <Button label="Torna indietro" onPress={() => router.back()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          accessibilityLabel="Torna indietro"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>

        <Card style={styles.clubHeaderCard}>
          <View style={styles.clubHeaderRow}>
            {club.logo_url ? (
              <Image
                accessibilityLabel={`Logo ${club.name}`}
                source={{ uri: club.logo_url }}
                style={styles.clubLogo}
              />
            ) : null}
            <View style={styles.clubNameContainer}>
              <AppText variant="headingMd">
                {club.name}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                {club.city}, {club.region}
              </AppText>
            </View>
          </View>
          <VerificationBadge status={club.verification_status} />
        </Card>

        {club.description ? (
          <Card style={styles.sectionCard}>
            <AppText variant="titleMd">Descrizione</AppText>
            <AppText variant="bodySm" color="secondary">{club.description}</AppText>
          </Card>
        ) : null}

        <Card style={styles.infoCard}>
          <AppText variant="titleMd">Informazioni</AppText>
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

        {teams.length > 0 ? (
          <Card style={styles.teamsSection}>
            <AppText variant="titleMd">Squadre</AppText>
            <ScrollView
              contentContainerStyle={styles.teamsScrollContent}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {teams.map((team) => {
                const isSenior = team.team_type === "senior";
                return (
                  <View
                    key={team.id}
                    style={[
                      styles.teamCard,
                      isSenior ? styles.teamCardSenior : styles.teamCardYouth,
                    ]}
                  >
                    {team.logo_url ? (
                      <Image
                        source={{ uri: team.logo_url }}
                        style={styles.teamCardLogo}
                      />
                    ) : (
                      <View style={styles.teamCardLogoPlaceholder}>
                        <Ionicons
                          color={isSenior ? colors.accent : colors.textMuted}
                          name="shield-outline"
                          size={24}
                        />
                      </View>
                    )}
                    <AppText variant="titleSm" numberOfLines={1}>
                      {team.name}
                    </AppText>
                    <View
                      style={[
                        styles.teamCategoryBadge,
                        isSenior
                          ? styles.teamCategoryBadgeSenior
                          : styles.teamCategoryBadgeYouth,
                      ]}
                    >
                      <AppText
                        variant="caption"
                        color={isSenior ? "accent" : "secondary"}
                      >
                        {team.category}
                      </AppText>
                    </View>
                    {!isSenior ? (
                      <AppText variant="caption" color="muted">
                        Settore giovanile
                      </AppText>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </Card>
        ) : null}

        <Card style={styles.infoCard}>
          <AppText variant="titleMd">Contatti</AppText>
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
            <AppText variant="bodySm" color="muted">Nessun contatto disponibile.</AppText>
          ) : null}
        </Card>

        {club.owner_full_name ? (
          <Card style={styles.sectionCard}>
            <AppText variant="titleMd">Responsabile</AppText>
            <AppText variant="bodySm" color="secondary">{club.owner_full_name}</AppText>
          </Card>
        ) : null}

        {profile?.role !== "club_admin" ? (
          <Button
            label="Collegati a questa societa'"
            onPress={() => setModalMode("join")}
            variant="secondary"
          />
        ) : null}

        <Pressable
          onPress={() =>
            Alert.alert("Segnala o rivendica", "Cosa vuoi fare con questa società?", [
              { text: "Annulla", style: "cancel" },
              { text: "Rivendica come mia", onPress: () => setModalMode("claim") },
              { text: "Segnala come falsa", style: "destructive", onPress: () => setModalMode("report") },
            ])
          }
          style={styles.reportLink}
        >
          <AppText variant="bodySm" color="muted">
            Segnala o rivendica questa società
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setModalMode(null)}
        presentationStyle="pageSheet"
        visible={modalMode === "claim"}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ModalHeader title="Rivendica società" onClose={() => setModalMode(null)} />
          <KeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
            <AppText variant="bodySm" color="secondary">
              Se questa è la tua società, compila il modulo e il nostro team
              verificherà la tua richiesta.
            </AppText>
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
        <SafeAreaView style={styles.modalSafeArea}>
          <ModalHeader title="Segnala società" onClose={() => setModalMode(null)} />
          <KeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
            <AppText variant="bodySm" color="secondary">
              Se ritieni che questa pagina non rappresenti una società reale,
              invia una segnalazione.
            </AppText>
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
      <Modal
        animationType="slide"
        onRequestClose={() => setModalMode(null)}
        presentationStyle="pageSheet"
        visible={modalMode === "join"}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ModalHeader title="Collegati alla societa'" onClose={() => setModalMode(null)} />
          <KeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
            <AppText variant="bodySm" color="secondary">
              Seleziona il tuo ruolo e collegati a {club.name}. L'amministratore
              ricevera' una notifica e potra' gestire il tuo collegamento.
            </AppText>
            <View style={styles.joinRoleOptions}>
              {(
                [
                  { label: "Giocatore", value: "player" },
                  { label: "Staff", value: "staff" },
                  { label: "Allenatore", value: "coach" },
                  { label: "Dirigente", value: "director" },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  label={option.label}
                  onPress={() => setJoinRole(option.value)}
                  size="sm"
                  variant={joinRole === option.value ? "primary" : "outline"}
                />
              ))}
            </View>
            <Button
              disabled={isSubmitting || !joinRole}
              label={isSubmitting ? "Collegamento..." : "Collegati"}
              onPress={handleJoinClub}
              variant="primary"
            />
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText variant="bodySm" color="secondary">
        {label}
      </AppText>
      <AppText variant="titleSm" style={styles.infoRowValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[28],
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  centerContainer: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
  },
  backButton: {
    alignSelf: "flex-start",
  },
  clubHeaderCard: {
    gap: spacing[12],
  },
  clubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
  },
  clubLogo: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    height: 48,
    width: 48,
  },
  clubNameContainer: {
    flex: 1,
    gap: spacing[4],
  },
  sectionCard: {
    gap: spacing[8],
  },
  infoCard: {
    gap: spacing[10],
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[8],
  },
  infoRowValue: {
    textAlign: "right",
    flex: 1,
  },
  reportLink: {
    alignItems: "center",
    paddingVertical: spacing[12],
  },
  modalSafeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  joinRoleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[10],
  },
  modalContent: {
    gap: spacing[16],
    padding: spacing[20],
  },
  teamsSection: {
    gap: spacing[12],
  },
  teamsScrollContent: {
    gap: spacing[10],
    paddingRight: spacing[4],
  },
  teamCard: {
    alignItems: "center",
    borderRadius: radius[8],
    borderWidth: 1,
    gap: spacing[6],
    padding: spacing[14],
    width: 130,
  },
  teamCardSenior: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  teamCardYouth: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  teamCardLogo: {
    borderRadius: radius[6],
    height: 40,
    width: 40,
  },
  teamCardLogoPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  teamCategoryBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  teamCategoryBadgeSenior: {
    backgroundColor: colors.accentSoft,
  },
  teamCategoryBadgeYouth: {
    backgroundColor: colors.surfaceMuted,
  },
});
