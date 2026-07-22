import { useEffect } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, Card, Divider } from "../../../ui";
import { formatRelativeTime } from "../../../lib/relative-time";
import {
  fetchCommunicationDetail,
  markCommunicationRead,
} from "../communications-service";
import { CommunicationCategoryBadge } from "./CommunicationCategoryBadge";

type CommunicationDetailScreenProps = {
  communicationId: string;
};

export function CommunicationDetailScreen({
  communicationId,
}: CommunicationDetailScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    enabled: !!communicationId,
    queryFn: () => fetchCommunicationDetail(communicationId),
    queryKey: ["communication-detail", communicationId],
  });

  const markReadMutation = useMutation({
    mutationFn: () => markCommunicationRead(communicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
    },
  });

  useEffect(() => {
    if (communicationId) {
      markReadMutation.mutate();
    }
    // Fire once per communicationId: marking read should not re-run on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communicationId]);

  const communication = detailQuery.data;

  async function handleShare() {
    if (!communication) {
      return;
    }

    await Share.share({
      message: `${communication.title}\n\n${communication.body}`,
    });
  }

  function handlePrimaryAction() {
    if (communication?.cta_label && communication.cta_url) {
      void Linking.openURL(communication.cta_url);
      return;
    }

    router.back();
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={22} />
        </Pressable>
        <AppText variant="titleMd">Comunicazione</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {detailQuery.isLoading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !communication ? (
        <View style={styles.loadingWrapper}>
          <AppText color="muted" variant="bodySm">
            Comunicazione non disponibile.
          </AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.metaRow}>
            <CommunicationCategoryBadge category={communication.category} />
            <AppText color="muted" variant="caption">
              {formatRelativeTime(communication.published_at)}
            </AppText>
          </View>

          <AppText variant="headingLg">{communication.title}</AppText>

          <Card style={styles.senderCard} variant="muted">
            <View style={styles.senderRow}>
              <Avatar name={communication.sender_name} size="sm" uri={communication.sender_logo_url} />
              <View style={styles.senderInfo}>
                <AppText variant="titleSm">{communication.sender_name}</AppText>
                <AppText color="muted" variant="caption">
                  Mittente Ufficiale
                </AppText>
              </View>
            </View>
          </Card>

          <AppText style={styles.body} variant="bodyLg">
            {communication.body}
          </AppText>

          <Divider spacing={4} />

          <View style={styles.metaRow}>
            <AppText color="muted" variant="caption">
              Destinatari:{" "}
            </AppText>
            <AppText variant="caption" style={styles.audienceLabel}>
              {communication.audience_label}
            </AppText>
          </View>

          <View style={styles.alertBox}>
            <Ionicons color={colors.warning} name="information-circle-outline" size={18} />
            <AppText style={styles.alertText} variant="caption">
              Questa è una comunicazione senza risposta.
            </AppText>
          </View>
        </ScrollView>
      )}

      {communication ? (
        <View style={styles.footer}>
          <Button
            fullWidth
            label={communication.cta_label ?? "Ho letto"}
            onPress={handlePrimaryAction}
            variant="primary"
          />
          <Button
            fullWidth
            label="Condividi"
            onPress={() => void handleShare()}
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  alertBox: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    padding: spacing[12],
  },
  alertText: {
    color: colors.warningStrong,
    flex: 1,
    fontWeight: "700",
  },
  audienceLabel: {
    fontWeight: "700",
  },
  backButton: {
    padding: spacing[4],
  },
  body: {
    color: colors.textPrimary,
  },
  content: {
    gap: spacing[16],
    padding: spacing[20],
    paddingBottom: spacing[32],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing[16],
  },
  headerSpacer: {
    width: 22,
  },
  loadingWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  senderCard: {
    gap: spacing[0],
  },
  senderInfo: {
    gap: spacing[4],
  },
  senderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
