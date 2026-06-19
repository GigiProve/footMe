import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import {
  fetchPendingClubs,
  fetchReportedTags,
  moderateReportedTag,
  type AdminClubEntry,
  type ReportedTag,
} from "../../src/features/admin/admin-service";
import { logout } from "../../src/features/auth/logout";
import { useSession } from "../../src/features/auth/use-session";
import { ClubRegistrationRequestList } from "../../src/features/admin/components/club-registration-request-list";
import { colors, spacing } from "../../src/theme/tokens";
import { AppText, Badge, Button } from "../../src/ui";

const REPORTED_CONTENT_LABELS: Record<string, string> = {
  club_media: "Post societa'",
  fan_tribuna: "Tribuna tifosi",
  media_profile: "Articolo media",
};

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { profile, session } = useSession();
  const [clubs, setClubs] = useState<AdminClubEntry[]>([]);
  const [reportedTags, setReportedTags] = useState<ReportedTag[]>([]);
  const [moderatingKey, setModeratingKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [clubsData, tagsData] = await Promise.all([
        fetchPendingClubs(),
        fetchReportedTags().catch(() => [] as ReportedTag[]),
      ]);
      setClubs(clubsData);
      setReportedTags(tagsData);
    } catch {
      setError("Impossibile caricare le richieste di iscrizione.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  async function handleModerateTag(tag: ReportedTag, dismiss: boolean) {
    const key = `${tag.content_type}:${tag.post_id}:${tag.tagged_profile_id}`;
    try {
      setModeratingKey(key);
      await moderateReportedTag({
        contentType: tag.content_type,
        dismiss,
        postId: tag.post_id,
        taggedProfileId: tag.tagged_profile_id,
      });
      await loadData();
    } catch (moderationError) {
      const message =
        moderationError instanceof Error
          ? moderationError.message
          : "Operazione non riuscita.";
      Alert.alert("Operazione non riuscita", message);
    } finally {
      setModeratingKey(null);
    }
  }

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
        onPress: async () => {
          await logout({
            avatarUrl: profile?.avatar_url,
            email: session?.user.email,
            fullName: profile?.full_name,
          });
          router.replace("/(auth)/sign-in");
        },
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

      {reportedTags.length > 0 ? (
        <View style={styles.moderationSection}>
          <View style={styles.moderationHeader}>
            <AppText variant="titleSm">Tag segnalati</AppText>
            <Badge label={reportedTags.length.toString()} variant="error" />
          </View>
          {reportedTags.map((tag) => {
            const key = `${tag.content_type}:${tag.post_id}:${tag.tagged_profile_id}`;
            return (
              <View key={key} style={styles.moderationRow}>
                <View style={styles.moderationInfo}>
                  <AppText variant="bodySm">{tag.tagged_name}</AppText>
                  <AppText color="secondary" variant="caption">
                    {REPORTED_CONTENT_LABELS[tag.content_type] ??
                      tag.content_type}
                  </AppText>
                </View>
                <View style={styles.moderationActions}>
                  <Button
                    disabled={moderatingKey === key}
                    label="Mantieni"
                    onPress={() => handleModerateTag(tag, true)}
                    size="sm"
                    variant="outline"
                  />
                  <Button
                    disabled={moderatingKey === key}
                    label="Rimuovi"
                    onPress={() => handleModerateTag(tag, false)}
                    size="sm"
                    variant="danger"
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

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
  moderationSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing[12],
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[20],
  },
  moderationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  moderationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  moderationInfo: {
    flex: 1,
    gap: spacing[4],
  },
  moderationActions: {
    flexDirection: "row",
    gap: spacing[8],
  },
});
