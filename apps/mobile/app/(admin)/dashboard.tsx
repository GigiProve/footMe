import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";
import {
  approveClubLink,
  fetchPendingClaims,
  fetchPendingClubLinks,
  fetchPendingClubs,
  fetchPendingReports,
  updateClubVerificationStatus,
  type AdminClubEntry,
  type ClubClaimEntry,
  type ClubReportEntry,
  type ClubVerificationStatus,
  type PendingClubLink,
} from "../../src/features/admin/admin-service";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { Button, Card } from "../../src/ui";

type Tab = "clubs" | "claims" | "reports" | "links";

export default function AdminDashboardScreen() {
  const { profile } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("clubs");
  const [clubs, setClubs] = useState<AdminClubEntry[]>([]);
  const [claims, setClaims] = useState<ClubClaimEntry[]>([]);
  const [reports, setReports] = useState<ClubReportEntry[]>([]);
  const [links, setLinks] = useState<PendingClubLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [clubsData, claimsData, reportsData, linksData] = await Promise.all([
        fetchPendingClubs(),
        fetchPendingClaims(),
        fetchPendingReports(),
        fetchPendingClubLinks(),
      ]);

      setClubs(clubsData);
      setClaims(claimsData);
      setReports(reportsData);
      setLinks(linksData);
    } catch {
      Alert.alert("Errore", "Impossibile caricare i dati.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleVerification(clubId: string, status: ClubVerificationStatus) {
    if (!profile) {
      return;
    }

    const statusLabels: Record<ClubVerificationStatus, string> = {
      flagged: "Segnalato",
      pending_review: "In revisione",
      suspended: "Sospeso",
      unverified: "Non verificato",
      verified: "Verificato",
    };

    Alert.alert(
      "Conferma azione",
      `Vuoi impostare lo stato a "${statusLabels[status]}"?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          onPress: async () => {
            try {
              setIsUpdating(clubId);
              await updateClubVerificationStatus(clubId, status, profile.id);
              await loadData();
            } catch {
              Alert.alert("Errore", "Operazione non riuscita.");
            } finally {
              setIsUpdating(null);
            }
          },
        },
      ],
    );
  }

  function handleSignOut() {
    Alert.alert("Esci", "Vuoi uscire dall'account admin?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  function renderClubItem({ item }: { item: AdminClubEntry }) {
    const isItemUpdating = isUpdating === item.id;

    return (
      <Card style={{ gap: spacing[12], marginBottom: spacing[12] }}>
        <View style={{ gap: spacing[4] }}>
          <Text style={styles.clubName}>{item.name}</Text>
          <Text style={styles.clubDetail}>
            {item.city}, {item.region}
          </Text>
          {item.club_email ? (
            <Text style={styles.clubDetail}>{item.club_email}</Text>
          ) : null}
          <Text style={styles.clubDetail}>
            Responsabile: {item.owner_full_name ?? "N/D"}
          </Text>
          <Text style={styles.clubMeta}>
            Registrato il {new Date(item.created_at).toLocaleDateString("it-IT")}
          </Text>
          <StatusBadge status={item.verification_status} />
        </View>

        <View style={{ flexDirection: "row", gap: spacing[8] }}>
          <View style={{ flex: 1 }}>
            <Button
              disabled={isItemUpdating}
              label="Verifica"
              onPress={() => handleVerification(item.id, "verified")}
              size="sm"
              variant="primary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              disabled={isItemUpdating}
              label="Segnala"
              onPress={() => handleVerification(item.id, "flagged")}
              size="sm"
              variant="secondary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              disabled={isItemUpdating}
              label="Sospendi"
              onPress={() => handleVerification(item.id, "suspended")}
              size="sm"
              variant="danger"
            />
          </View>
        </View>
      </Card>
    );
  }

  function renderClaimItem({ item }: { item: ClubClaimEntry }) {
    return (
      <Card style={{ gap: spacing[8], marginBottom: spacing[12] }}>
        <Text style={styles.clubName}>{item.club_name}</Text>
        <Text style={styles.clubDetail}>
          Rivendicato da: {item.claimant_email ?? item.claimant_profile_id}
        </Text>
        {item.claimant_role_at_club ? (
          <Text style={styles.clubDetail}>
            Ruolo dichiarato: {item.claimant_role_at_club}
          </Text>
        ) : null}
        {item.message ? (
          <Text style={styles.clubDetail}>Messaggio: {item.message}</Text>
        ) : null}
        <Text style={styles.clubMeta}>
          {new Date(item.created_at).toLocaleDateString("it-IT")}
        </Text>
      </Card>
    );
  }

  async function handleApproveLink(link: PendingClubLink) {
    Alert.alert(
      "Conferma collegamento",
      `Collegare "${link.career_club_name}" (di ${link.player_name ?? "giocatore"}) al club "${link.candidate_club_name}" (${link.candidate_club_city})?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Approva",
          onPress: async () => {
            try {
              setIsUpdating(link.career_entry_id);
              await approveClubLink(link.career_entry_id, link.candidate_club_id);
              await loadData();
            } catch {
              Alert.alert("Errore", "Operazione non riuscita.");
            } finally {
              setIsUpdating(null);
            }
          },
        },
      ],
    );
  }

  function renderLinkItem({ item }: { item: PendingClubLink }) {
    const isItemUpdating = isUpdating === item.career_entry_id;

    return (
      <Card style={{ gap: spacing[8], marginBottom: spacing[12] }}>
        <View style={{ gap: spacing[4] }}>
          <Text style={styles.clubName}>{item.career_club_name}</Text>
          <Text style={styles.clubDetail}>
            Giocatore: {item.player_name ?? "N/D"}
          </Text>
          <Text style={styles.clubDetail}>
            Club candidato: {item.candidate_club_name} ({item.candidate_club_city}, {item.candidate_club_region})
          </Text>
          <Text style={styles.clubMeta}>
            {new Date(item.entry_created_at).toLocaleDateString("it-IT")}
          </Text>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: item.confidence === "high" ? "#D1FAE5" : "#FEF3C7",
              borderRadius: radius[14],
              marginTop: spacing[4],
              paddingHorizontal: spacing[8],
              paddingVertical: spacing[4],
            }}
          >
            <Text
              style={{
                color: item.confidence === "high" ? "#065F46" : "#92400E",
                fontSize: typography.fontSize[12],
                fontWeight: typography.fontWeight.bold,
              }}
            >
              {item.confidence === "high" ? "Alta confidenza" : "Media confidenza"}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Button
            disabled={isItemUpdating}
            label="Approva collegamento"
            onPress={() => handleApproveLink(item)}
            size="sm"
            variant="primary"
          />
        </View>
      </Card>
    );
  }

  function renderReportItem({ item }: { item: ClubReportEntry }) {
    return (
      <Card style={{ gap: spacing[8], marginBottom: spacing[12] }}>
        <Text style={styles.clubName}>{item.club_name}</Text>
        {item.reason ? (
          <Text style={styles.clubDetail}>Motivo: {item.reason}</Text>
        ) : null}
        <Text style={styles.clubMeta}>
          {new Date(item.created_at).toLocaleDateString("it-IT")}
        </Text>
      </Card>
    );
  }

  const tabs: { count: number; key: Tab; label: string }[] = [
    { count: clubs.length, key: "clubs", label: "Societa'" },
    { count: claims.length, key: "claims", label: "Rivendicazioni" },
    { count: reports.length, key: "reports", label: "Segnalazioni" },
    { count: links.length, key: "links", label: "Collegamenti" },
  ];

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Admin</Text>
        <Button label="Esci" onPress={handleSignOut} size="sm" variant="secondary" />
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              activeTab === tab.key ? styles.tabActive : null,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key ? styles.tabTextActive : null,
              ]}
            >
              {tab.label} ({tab.count})
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === "clubs" ? (
            <FlatList
              contentContainerStyle={styles.list}
              data={clubs}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<EmptyState message="Nessuna società in attesa di revisione." />}
              renderItem={renderClubItem}
            />
          ) : null}

          {activeTab === "claims" ? (
            <FlatList
              contentContainerStyle={styles.list}
              data={claims}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<EmptyState message="Nessuna rivendicazione in sospeso." />}
              renderItem={renderClaimItem}
            />
          ) : null}

          {activeTab === "reports" ? (
            <FlatList
              contentContainerStyle={styles.list}
              data={reports}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<EmptyState message="Nessuna segnalazione in sospeso." />}
              renderItem={renderReportItem}
            />
          ) : null}

          {activeTab === "links" ? (
            <FlatList
              contentContainerStyle={styles.list}
              data={links}
              keyExtractor={(item) => item.career_entry_id}
              ListEmptyComponent={<EmptyState message="Nessun collegamento in sospeso." />}
              renderItem={renderLinkItem}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: ClubVerificationStatus }) {
  const config: Record<ClubVerificationStatus, { bg: string; label: string; text: string }> = {
    flagged: { bg: "#FEF3C7", label: "Segnalato", text: "#92400E" },
    pending_review: { bg: "#DBEAFE", label: "In revisione", text: "#1E40AF" },
    suspended: { bg: "#FEE2E2", label: "Sospeso", text: "#991B1B" },
    unverified: { bg: colors.surfaceMuted, label: "Non verificato", text: colors.textSecondary },
    verified: { bg: "#D1FAE5", label: "Verificato", text: "#065F46" },
  };

  const { bg, label, text } = config[status];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radius[14],
        marginTop: spacing[4],
        paddingHorizontal: spacing[8],
        paddingVertical: spacing[4],
      }}
    >
      <Text style={{ color: text, fontSize: typography.fontSize[12], fontWeight: typography.fontWeight.bold }}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing[32] }}>
      <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[16] }}>
        {message}
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
    paddingTop: 60,
    paddingBottom: spacing[16],
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.heavy,
  },
  tabBar: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[20],
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing[12],
  },
  tabActive: {
    borderBottomColor: colors.accent,
    borderBottomWidth: 2,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
  },
  tabTextActive: {
    color: colors.accent,
  },
  list: {
    padding: spacing[20],
  },
  clubName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
  },
  clubDetail: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[14],
    lineHeight: 20,
  },
  clubMeta: {
    color: colors.textMuted,
    fontSize: typography.fontSize[12],
  },
} as const;
