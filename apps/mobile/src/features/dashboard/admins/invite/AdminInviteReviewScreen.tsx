/**
 * Invito ricevuto (DAS-REV-13, screen 04).
 *
 * «Gli stessi componenti devono rendere un invito interno e uno arrivato
 * tramite link esterno» (§16): questa schermata non sa da dove arriva la
 * proposta, legge sempre `fetch_my_admin_invite`.
 *
 * È il contesto della **persona**, non della Società: la label è «Società
 * invitante» e il guard è quello del destinatario, non quello gestionale
 * (§6, §23). Nessuna bottom navigation.
 *
 * «Non aggiungere un secondo popup generico dopo Accetta: la pagina
 * esplicita costituisce la conferma» (§16).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { DASHBOARD_QK } from "../../dashboard-keys";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { AdminFieldRow } from "../components/AdminFieldRow";
import { ADMINS_QK } from "../admins-keys";
import { trackAdminEvent } from "../admins-analytics";
import {
  ADMIN_COPY,
  describeAdminError,
  describeMyInviteState,
  reviewBody,
} from "../admins-presentation";
import {
  fetchMyAdminInvite,
  respondToAdminInvite,
  toAdminError,
} from "../admins-service";
import { newAdminOperationKey } from "../admin-invite-link";

export function AdminInviteReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const params = useLocalSearchParams<{ inviteId?: string }>();
  const inviteId = typeof params.inviteId === "string" ? params.inviteId : null;

  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"accept" | "reject" | null>(null);

  const inviteQuery = useQuery({
    enabled: !!inviteId && !!actorId,
    queryFn: () => fetchMyAdminInvite(inviteId as string),
    queryKey: ADMINS_QK.myInvite(actorId, inviteId ?? ""),
    /* §26: «la conferma richiede sempre una verifica online aggiornata». La
       proposta non si serve da cache: si rilegge a ogni ingresso. */
    staleTime: 0,
  });

  const invite = inviteQuery.data ?? null;

  /**
   * §19: la chiave è legata alla **revisione** della proposta. Una proposta
   * aggiornata è un'altra decisione, e deve avere un'altra chiave; un retry
   * della stessa decisione riusa questa.
   */
  const operationKey = useMemo(
    () => newAdminOperationKey(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invite?.revision],
  );

  useEffect(() => {
    if (invite) {
      trackAdminEvent("admin_invite_review_opened", { state: invite.state });
    }
  }, [invite]);

  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      respondToAdminInvite({
        accept,
        idempotencyKey: operationKey,
        inviteId: inviteId as string,
        revision: invite?.revision ?? 1,
      }),
    onError: (raw) => {
      const parsed = toAdminError(raw);
      setError(describeAdminError(parsed.code));
      setDecision(null);
      trackAdminEvent("admin_invite_decision_result", {
        error_code: parsed.code,
        outcome: "error",
      });
      /* §17: «La risposta perdente ricarica lo stato reale.» */
      void inviteQuery.refetch();
    },
    onSuccess: (result) => {
      trackAdminEvent("admin_invite_decision_result", {
        outcome: result.state,
      });
      setDecision(null);

      if (result.state === "accepted") {
        /* §22: «Dopo l'accettazione aggiorna l'elenco delle Dashboard
           autorizzate del destinatario.» Nessuno switch globale di identità:
           la Società comparirà nel selector al prossimo accesso. */
        void queryClient.invalidateQueries({
          queryKey: DASHBOARD_QK.identities(actorId),
        });
        showToast({ message: "Invito accettato", tone: "success" });
      } else if (result.state === "rejected") {
        showToast({ message: "Invito rifiutato", tone: "neutral" });
      }

      void inviteQuery.refetch();

      /* §24: «Ricezione da link senza stack preesistente → destinazione
         personale sicura, senza creare un finto stack amministrativo.» */
      if (router.canGoBack()) {
        router.back();

        return;
      }

      router.replace("/(tabs)/dashboard" as never);
    },
  });

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard" as never);
  }, [router]);

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <NetworkNavBar onBack={close} title={ADMIN_COPY.reviewTitle} />
      </View>
      {body}
    </View>
  );

  if (!inviteId) {
    return shell(
      <DashboardGlobalError
        body="Riprova."
        onRetry={close}
        title="Non siamo riusciti a caricare l'invito."
      />,
    );
  }

  if (inviteQuery.isLoading && !invite) {
    return shell(<DashboardSkeleton />);
  }

  if (!invite) {
    return shell(
      <DashboardGlobalError
        body="Riprova."
        onRetry={() => void inviteQuery.refetch()}
        title="Non siamo riusciti a caricare l'invito."
      />,
    );
  }

  const terminal = describeMyInviteState(invite.state, invite.membershipActive);
  const isBusy = respond.isPending;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <NetworkNavBar onBack={close} title={ADMIN_COPY.reviewTitle} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        testID="admin-review-scroll"
      >
        {/* §6: «Non selezionare implicitamente AC Como come identità
            amministrativa del destinatario prima dell'accettazione.» */}
        <SocietyIdentityHeader
          isVerified={invite.clubIsVerified}
          kindLabel={ADMIN_COPY.invitingSociety}
          logoUrl={invite.clubLogoUrl}
          name={invite.clubName}
        />

        <AppText color="neutral" variant="headingLg">
          {reviewBody(invite.clubName)}
        </AppText>

        {/* §16: ruolo e ambito in sola lettura. Descrivono ciò che verrà
            effettivamente assegnato, non il testo del link. */}
        <AdminFieldRow
          label={ADMIN_COPY.roleLabel}
          testID="admin-review-role"
          value={invite.roleLabel}
        />

        <AdminFieldRow
          label={ADMIN_COPY.scopeLabel}
          testID="admin-review-scope"
          value={invite.scopeLabel}
        />

        {terminal ? (
          <AppText color="neutralMuted" variant="bodySm">
            {terminal}
          </AppText>
        ) : (
          <AppText color="neutralSoft" variant="bodySm">
            {ADMIN_COPY.reviewHelper}
          </AppText>
        )}

        {error ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySm">
            {error}
          </AppText>
        ) : null}

        {invite.state === "pending" ? (
          <View style={styles.actions}>
            <Button
              disabled={isBusy}
              fullWidth
              label={ADMIN_COPY.acceptCta}
              loading={isBusy && decision === "accept"}
              onPress={() => {
                setError(null);
                setDecision("accept");
                trackAdminEvent("admin_invite_decision_submitted", {
                  decision: "accept",
                });
                respond.mutate(true);
              }}
              size="lg"
              testID="admin-review-accept"
              variant="primary"
            />

            {/* §4: secondaria testuale, come nel master. */}
            <Button
              disabled={isBusy}
              fullWidth
              label={ADMIN_COPY.rejectCta}
              loading={isBusy && decision === "reject"}
              onPress={() => {
                setError(null);
                setDecision("reject");
                trackAdminEvent("admin_invite_decision_submitted", {
                  decision: "reject",
                });
                respond.mutate(false);
              }}
              size="lg"
              testID="admin-review-reject"
              variant="link"
            />
          </View>
        ) : invite.state === "accepted" && invite.membershipActive ? (
          <Button
            fullWidth
            label="Apri Dashboard"
            onPress={() => router.replace("/(tabs)/dashboard" as never)}
            size="lg"
            testID="admin-review-dashboard"
            variant="neutralOutline"
          />
        ) : null}
      </ScrollView>
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
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  actions: {
    gap: spacing[8],
  },
});
