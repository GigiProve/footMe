import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { EmptyState, ScreenHeader, SectionCard } from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { ClubInvitesSection } from "../../src/features/clubs/components/ClubInvitesSection";
import { ClubMemberRow } from "../../src/features/clubs/components/ClubMemberRow";
import {
  fetchClubMembers,
  rejectMember,
  removeMember,
} from "../../src/features/clubs/membership-service";
import type { ClubMember } from "../../src/features/clubs/membership-types";
import { colors, radius, spacing } from "../../src/theme/tokens";

export default function ClubInvitesScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const clubId = profile?.club_id ?? null;

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  const loadMembers = useCallback(async () => {
    if (!clubId) return;
    try {
      setIsLoadingMembers(true);
      const data = await fetchClubMembers(clubId);
      setMembers(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore nel caricamento rosa";
      Alert.alert("Errore rosa", message);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [clubId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleRemoveMember(memberId: string) {
    Alert.alert("Conferma", "Vuoi rimuovere questo membro dalla rosa?", [
      { style: "cancel", text: "Annulla" },
      {
        onPress: async () => {
          try {
            await removeMember(memberId);
            await loadMembers();
          } catch {
            Alert.alert("Errore", "Impossibile rimuovere il membro");
          }
        },
        style: "destructive",
        text: "Rimuovi",
      },
    ]);
  }

  async function handleRejectMember(memberId: string) {
    Alert.alert(
      "Conferma",
      "Vuoi rifiutare il collegamento di questo membro?",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              await rejectMember(memberId);
              await loadMembers();
            } catch {
              Alert.alert("Errore", "Impossibile rifiutare il membro");
            }
          },
          style: "destructive",
          text: "Rifiuta",
        },
      ],
    );
  }

  const pendingMembers = members.filter((m) => m.status === "pending");

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <ScreenHeader
            title="Inviti e richieste"
            action={
              <Pressable
                accessibilityLabel="Indietro"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons
                  color={colors.textPrimary}
                  name="arrow-back"
                  size={20}
                />
              </Pressable>
            }
          />
        </View>

        <SectionCard
          description="Richieste di collegamento in attesa di approvazione"
          title="Richieste in attesa"
        >
          {pendingMembers.length === 0 && !isLoadingMembers ? (
            <EmptyState
              description="Non ci sono richieste in attesa"
              icon="time-outline"
              title="Nessuna richiesta"
            />
          ) : (
            <FlatList
              data={pendingMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ClubMemberRow
                  member={item}
                  onReject={handleRejectMember}
                  onRemove={handleRemoveMember}
                  teamName={null}
                />
              )}
              scrollEnabled={false}
            />
          )}
        </SectionCard>

        <ClubInvitesSection />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
  scrollContent: {
    gap: spacing[18],
    paddingBottom: spacing[48],
  },
});
