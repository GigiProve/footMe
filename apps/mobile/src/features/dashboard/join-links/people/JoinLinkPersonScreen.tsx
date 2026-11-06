/**
 * Dettaglio della persona collegata (DAS-REV-20, screen 19-20, §33-§34).
 *
 * Sola lettura su origine e data di collegamento: la provenienza (§34) è un
 * fatto registrato all'ingresso, mai dedotto confrontando i nomi delle
 * squadre in questo schermo. L'unica azione distruttiva è "Rimuovi ruolo",
 * mai "Rimuovi dalla società" — frasi che indicano operazioni diverse. Questo
 * schermo non cambia squadra, professione o ruolo, e non mostra incarichi
 * fuori dal proprio ambito.
 *
 * La chiave di operazione è legata al contenuto (link + incarico): un retry
 * dello stesso tentativo resta idempotente lato server.
 */
import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, useToast } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { JoinLinkFieldRow } from "../components/JoinLinkFieldRow";
import { JoinLinkRemoveRoleSheet } from "../components/JoinLinkRemoveRoleSheet";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { JOIN_LINKS_QK, JOIN_LINKS_QK_PREFIXES } from "../join-links-keys";
import {
  JOIN_LINKS_COPY,
  enteredViaLabel,
  formatConnectedDate,
  mutationErrorCopy,
} from "../join-links-presentation";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import { newJoinSessionNonce, operationKeyOf } from "../operation-key";
import {
  endJoinLinkAssignment,
  isAuthorizationError,
  fetchJoinLinkPerson,
  toJoinLinksError,
} from "../join-links-service";

export function JoinLinkPersonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { connection } = useDashboardConnection();

  const params = useLocalSearchParams<{
    assignmentId?: string;
    linkId?: string;
  }>();
  const linkId = typeof params.linkId === "string" ? params.linkId : "";
  const assignmentId =
    typeof params.assignmentId === "string" ? params.assignmentId : "";

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const nonceRef = useRef(newJoinSessionNonce());

  const personQuery = useQuery({
    enabled: !!actorId && !!linkId && !!assignmentId,
    queryFn: () => fetchJoinLinkPerson({ assignmentId, linkId }),
    queryKey: JOIN_LINKS_QK.person(actorId, linkId, assignmentId),
    retry: (failureCount, error) =>
      !isAuthorizationError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const detail = personQuery.data ?? null;

  useFocusEffect(
    useCallback(() => {
      trackJoinLinksEvent("join_link_person_opened");
    }, []),
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(JOIN_LINKS_HREFS.people(linkId) as never as Parameters<typeof router.replace>[0]);
  }, [linkId, router]);

  const removeMutation = useMutation({
    mutationFn: () =>
      endJoinLinkAssignment({
        assignmentId,
        linkId,
        operationKey: operationKeyOf(
          nonceRef.current,
          `${linkId}|${assignmentId}`,
        ),
      }),
    onError: (error) => {
      const joinError = toJoinLinksError(error);

      setMutationError(
        mutationErrorCopy(joinError.code, "remove", joinError.detail),
      );
      trackJoinLinksEvent("join_link_remove_result", {
        reason: joinError.code,
      });
    },
    onSuccess: (result) => {
      setSheetOpen(false);

      void Promise.all(
        JOIN_LINKS_QK_PREFIXES.map((prefix) =>
          queryClient.invalidateQueries({ queryKey: [prefix] }),
        ),
      );

      if (result.alreadyApplied) {
        void personQuery.refetch();
        showToast({
          message: "Questo ruolo non è più attivo.",
          tone: "neutral",
        });
        trackJoinLinksEvent("join_link_remove_result");

        return;
      }

      trackJoinLinksEvent("join_link_remove_result");
      showToast({ message: JOIN_LINKS_COPY.removed, tone: "success" });
      goBack();
    },
  });

  const openProfile = useCallback(() => {
    if (!detail) {
      return;
    }

    trackJoinLinksEvent("join_link_person_opened");

    const href = `/profile/${detail.profileId}`;

    router.push(href as never);
  }, [detail, router]);

  const confirmRemove = useCallback(() => {
    if (removeMutation.isPending) {
      return;
    }

    setMutationError(null);
    removeMutation.mutate();
  }, [removeMutation]);

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={detail?.clubIsVerified ?? false}
          logoUrl={detail?.clubLogoUrl ?? null}
          name={detail?.clubName ?? ""}
          onBack={goBack}
        />
      </View>
      {body}
    </View>
  );

  if (isAuthorizationError(personQuery.error)) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: JOIN_LINKS_COPY.cancel,
          body: JOIN_LINKS_COPY.notAuthorized,
          icon: "lock-closed-outline",
          title: JOIN_LINKS_COPY.notAuthorized,
        }}
        onAction={goBack}
      />,
    );
  }

  if (personQuery.isLoading && !detail) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!detail) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline onRetry={() => void personQuery.refetch()} />,
      );
    }

    return shell(
      <DashboardGlobalError
        onRetry={() => void personQuery.refetch()}
        title={JOIN_LINKS_COPY.peopleError}
      />,
    );
  }

  const connectedOn = formatConnectedDate(detail.connectedAt) ?? "";
  const enteredVia = enteredViaLabel({
    allowedProfileTypes: detail.sourceAllowedProfileTypes,
    teamName: detail.sourceTeamName,
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={detail.clubIsVerified}
          logoUrl={detail.clubLogoUrl}
          name={detail.clubName}
          onBack={goBack}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
      >
        <View style={styles.personBlock}>
          <Avatar name={detail.personName} size="lg" uri={detail.avatarUrl} />
          <AppText
            color="neutral"
            style={styles.personName}
            variant="headingMd"
          >
            {detail.personName}
          </AppText>
          <AppText color="neutralMuted" variant="bodySm">
            {`${detail.roleLabel} · ${detail.teamName}`}
          </AppText>
        </View>

        <View style={styles.fields}>
          <JoinLinkFieldRow
            label={JOIN_LINKS_COPY.enteredViaField}
            value={enteredVia}
          />
          <JoinLinkFieldRow
            label={JOIN_LINKS_COPY.connectedOnField}
            value={connectedOn}
          />
        </View>

        <Button
          fullWidth
          label={JOIN_LINKS_COPY.viewProfile}
          onPress={openProfile}
          style={styles.viewProfileButton}
          testID="join-link-view-profile"
          variant="primary"
        />

        {detail.canRemoveRole && detail.isActive ? (
          <View style={styles.removeBlock}>
            <Button
              fullWidth
              label={JOIN_LINKS_COPY.removeRole}
              onPress={() => {
                setMutationError(null);
                setSheetOpen(true);
              }}
              testID="join-link-remove-role"
              variant="danger"
            />
            <AppText
              color="neutralMuted"
              style={styles.removeHelper}
              variant="meta"
            >
              {JOIN_LINKS_COPY.removeHelper}
            </AppText>
            {mutationError ? (
              <AppText
                accessibilityRole="alert"
                color="danger"
                style={styles.removeError}
                variant="meta"
              >
                {mutationError}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <JoinLinkRemoveRoleSheet
        clubName={detail.clubName}
        isBusy={removeMutation.isPending}
        onClose={() => setSheetOpen(false)}
        onConfirm={confirmRemove}
        personName={detail.personName}
        roleLabel={detail.roleLabel}
        teamName={detail.teamName}
        visible={sheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  personBlock: {
    alignItems: "center",
    paddingTop: spacing[24],
  },
  personName: {
    marginTop: spacing[12],
  },
  fields: {
    marginTop: spacing[24],
  },
  viewProfileButton: {
    marginTop: spacing[24],
  },
  removeBlock: {
    marginTop: spacing[32],
  },
  removeHelper: {
    marginTop: spacing[8],
  },
  removeError: {
    marginTop: spacing[8],
  },
});
