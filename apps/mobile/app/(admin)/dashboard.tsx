import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { fetchPendingClubs, type AdminClubEntry } from "../../src/features/admin/admin-service";
import { ClubRegistrationRequestList } from "../../src/features/admin/components/club-registration-request-list";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing } from "../../src/theme/tokens";
import { AppText, Badge, Button } from "../../src/ui";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [clubs, setClubs] = useState<AdminClubEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPendingClubs();
      setClubs(data);
    } catch {
      setError("Impossibile caricare le richieste di iscrizione.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  function handleRefresh() {
    setIsRefreshing(true);
    loadData();
  }

  function handleItemPress(clubId: string) {
    router.push({ pathname: "/(admin)/club-request/[id]", params: { id: clubId } });
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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <AppText variant="headingLg">Dashboard</AppText>
        <Button label="Esci" onPress={handleSignOut} size="sm" variant="secondary" />
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="titleSm">Richieste di iscrizione</AppText>
        {clubs.length > 0 ? (
          <Badge label={clubs.length.toString()} />
        ) : null}
      </View>

      <ClubRegistrationRequestList
        clubs={clubs}
        error={error}
        isLoading={isLoading}
        onItemPress={handleItemPress}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: 60,
  },
  sectionHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[20],
  },
});
