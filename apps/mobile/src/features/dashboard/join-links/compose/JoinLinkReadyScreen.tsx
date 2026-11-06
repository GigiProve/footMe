/**
 * Screen 05 del composer — Invito pronto (§17, §18, §39).
 *
 * Il link esiste già: questo schermo non crea nulla, legge solo il dettaglio
 * appena creato. Scadenza e limite restano righe informative separate, senza
 * frasi che promettano una disponibilità che il dato non garantisce (§39) —
 * "nessuna scadenza" non significa "fino alla disattivazione" quando esiste
 * comunque un limite. Chiudere la share sheet senza scegliere non racconta
 * nulla sull'avvenuta consegna: il link resta creato e basta.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppText, Button, useToast } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  JOIN_LINKS_COPY,
  audienceSummary,
  expiryLabel,
  limitLabel,
  shareMessage,
} from "../join-links-presentation";
import { JOIN_LINKS_QK } from "../join-links-keys";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import { fetchJoinLink, fetchJoinLinkShare } from "../join-links-service";
import {
  buildTeamJoinUrl,
  copyTeamJoinLink,
  shareTeamJoinLink,
} from "../join-link-url";

export function JoinLinkReadyScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const { showToast } = useToast();

  const detailQuery = useQuery({
    queryKey: JOIN_LINKS_QK.detail(actorId, linkId),
    queryFn: () => fetchJoinLink(linkId),
    staleTime: STALE_MS.operational,
    enabled: Boolean(linkId),
  });

  const [isSharing, setSharing] = useState(false);
  const [isCopying, setCopying] = useState(false);

  function handleBack() {
    router.replace(JOIN_LINKS_HREFS.detail(linkId, { from: "ready" }) as Parameters<typeof router.replace>[0]);
  }

  async function handleShare() {
    if (isSharing) {
      return;
    }

    setSharing(true);

    try {
      const share = await fetchJoinLinkShare(linkId);
      const url = buildTeamJoinUrl(share.token);
      const message = shareMessage({
        allowedProfileTypes: share.allowedProfileTypes,
        clubName: share.clubName,
        teamName: share.teamName,
        url,
      });
      const outcome = await shareTeamJoinLink(message);

      if (outcome === "unavailable") {
        const copied = await copyTeamJoinLink(url);

        if (copied) {
          showToast({ message: JOIN_LINKS_COPY.copied, tone: "success" });
        }
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (isCopying) {
      return;
    }

    setCopying(true);

    try {
      const share = await fetchJoinLinkShare(linkId);
      const url = buildTeamJoinUrl(share.token);
      const copied = await copyTeamJoinLink(url);

      if (copied) {
        showToast({ message: JOIN_LINKS_COPY.copied, tone: "success" });
      }
    } finally {
      setCopying(false);
    }
  }

  if (detailQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <DashboardGlobalError onRetry={() => detailQuery.refetch()} />;
  }

  const detail = detailQuery.data;

  return (
    <View style={styles.screen}>
      <SocietyContextHeader
        title={JOIN_LINKS_COPY.readyTitle}
        isVerified={detail.clubIsVerified}
        logoUrl={detail.clubLogoUrl}
        name={detail.clubName}
        onBack={handleBack}
      />

      <View style={styles.body}>
        <AppText variant="headingSm" color="neutral">
          {detail.teamName}
        </AppText>

        <InfoRow
          label={JOIN_LINKS_COPY.audienceField}
          value={audienceSummary(detail.allowedProfileTypes)}
        />
        <InfoRow label={JOIN_LINKS_COPY.expiryField} value={expiryLabel(detail.expiresOn)} />
        <InfoRow label={JOIN_LINKS_COPY.limitField} value={limitLabel(detail.maxRedemptions)} />

        <AppText variant="bodySm" color="neutralMuted" style={styles.hint}>
          {JOIN_LINKS_COPY.readyBody}
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button
          label={JOIN_LINKS_COPY.share}
          onPress={handleShare}
          variant="primary"
          fullWidth
          loading={isSharing}
          disabled={isSharing}
          testID="join-link-share"
        />
        <Button
          label={JOIN_LINKS_COPY.copy}
          onPress={handleCopy}
          variant="outline"
          fullWidth
          loading={isCopying}
          disabled={isCopying}
          testID="join-link-copy"
        />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="meta" color="neutralMuted">
        {label}
      </AppText>
      <AppText variant="bodyLg" color="neutral">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[12],
    padding: spacing[4],
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    padding: spacing[4],
  },
  hint: {
    marginTop: spacing[8],
  },
  row: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingVertical: spacing[12],
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
