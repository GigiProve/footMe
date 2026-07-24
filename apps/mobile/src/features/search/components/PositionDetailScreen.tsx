import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import { toggleSavedAd } from "../../recruiting/recruiting-service";
import { fetchPositionDetail } from "../position-detail-service";
import { formatDeadlineLabel } from "../search-format";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, EmptyState, Skeleton } from "../../../ui";

export function PositionDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const { id } = useLocalSearchParams<{ id: string }>();

  const detailQuery = useQuery({
    queryKey: ["position-detail", id, profileId],
    queryFn: () => fetchPositionDetail(profileId as string, id as string),
    enabled: !!profileId && !!id,
  });

  const detail = detailQuery.data;

  const toggleSavedMutation = useMutation({
    mutationFn: () => {
      if (!profileId || !detail) {
        throw new Error("Sessione non valida.");
      }
      return toggleSavedAd(profileId, detail.ad_id, !detail.is_saved);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["search-positions"] });
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    },
  });

  return (
    <>
      <View style={styles.headerRow}>
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
          <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
        </Pressable>
      </View>

      {detailQuery.isLoading ? (
        <View style={styles.loaderContainer}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row style={styles.skeletonShort} />
        </View>
      ) : !detail ? (
        <EmptyState
          icon="briefcase-outline"
          title="Posizione non disponibile"
          description="Questa posizione potrebbe non essere più pubblicata."
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <AppText variant="headingMd" style={styles.title}>
            {detail.title}
          </AppText>

          {detail.club_name ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                detail.club_id
                  ? router.push(`/club/${detail.club_id}` as never)
                  : undefined
              }
              style={styles.clubRow}
            >
              <Avatar name={detail.club_name} size="sm" square uri={detail.club_logo_url} />
              <View style={styles.clubText}>
                <AppText variant="titleSm">{detail.club_name}</AppText>
                {detail.category ? (
                  <AppText variant="bodySm" color="muted">
                    {detail.category}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          <View style={styles.metaBlock}>
            {detail.region ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="location-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {detail.region}
                </AppText>
              </View>
            ) : null}
            {detail.team_name ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="shield-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {detail.team_name}
                </AppText>
              </View>
            ) : null}
            {detail.category ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="trophy-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {detail.category}
                </AppText>
              </View>
            ) : null}
            {detail.deadline ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="time-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {formatDeadlineLabel(detail.deadline)}
                </AppText>
              </View>
            ) : null}
          </View>

          {detail.compensation_summary ? (
            <AppText variant="bodySm" color="secondary" style={styles.compensation}>
              {detail.compensation_summary}
            </AppText>
          ) : null}

          <AppText variant="bodyLg" style={styles.description}>
            {detail.description}
          </AppText>

          <Button
            label={detail.is_saved ? "Salvata" : "Salva"}
            leftIcon={
              <Ionicons
                color={colors.accent}
                name={detail.is_saved ? "bookmark" : "bookmark-outline"}
                size={16}
              />
            }
            loading={toggleSavedMutation.isPending}
            onPress={() => toggleSavedMutation.mutate()}
            style={styles.saveButton}
            variant="secondary"
          />
        </ScrollView>
      )}
    </>
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
  clubRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  clubText: {
    flex: 1,
    gap: spacing[4],
  },
  compensation: {
    marginBottom: spacing[8],
  },
  description: {
    marginBottom: spacing[24],
  },
  headerRow: {
    marginBottom: spacing[16],
  },
  loaderContainer: {
    gap: spacing[8],
  },
  metaBlock: {
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
  saveButton: {
    alignSelf: "flex-start",
  },
  scroll: {
    flex: 1,
  },
  skeletonShort: {
    width: "60%",
  },
  title: {
    marginBottom: spacing[16],
  },
});
