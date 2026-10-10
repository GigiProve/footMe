/**
 * Valuta una richiesta (master 05) e dettaglio di una richiesta inviata.
 *
 * Una sola schermata per i due lati: §9 dice che «tap su una inviata apre lo
 * stesso dettaglio adattato: dati della proposta, controparte, data e In
 * attesa, senza Accetta/Rifiuta». La differenza non è il rendering, sono le
 * azioni — e quelle le dichiara il server.
 *
 * §13: «La review è la conferma esplicita della proposta visualizzata; non
 * aggiungere una seconda modal generica dopo Accetta.» Accetta quindi agisce
 * direttamente, portando con sé la `version` letta: se nel frattempo la
 * proposta è cambiata il server rifiuta e si torna a leggere.
 */
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sizes } from "../../../theme/tokens";
import { AppText, ConfirmModal, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import { NetworkScaffold } from "../components/NetworkScaffold";
import { NetworkFieldRow } from "../components/NetworkFieldRow";
import { SocietyIdentityRow } from "../components/SocietyIdentityRow";
import { NETWORK_QK } from "../network-keys";
import { describeNetworkError, locationLabel } from "../network-presentation";
import {
  decideRelationship,
  fetchRelationshipDetail,
  toNetworkError,
} from "../network-service";
import { invalidateNetwork } from "../RelationshipDetailScreen";
import { newNetworkOperationKey } from "../operation-key";
import { trackNetworkEvent } from "../network-analytics";
import type { RelationshipAction } from "../network-types";

type Props = {
  clubId: string;
  relationshipId: string;
};

const SUCCESS_COPY: Record<RelationshipAction, string> = {
  accept: "Collegamento attivato",
  cancel: "Richiesta annullata",
  end: "Collegamento terminato",
  reject: "Richiesta rifiutata",
};

export function RequestReviewScreen({ clubId, relationshipId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const operationKeyRef = useRef<Record<string, string>>({});

  const detailQuery = useQuery({
    enabled: !!clubId && !!relationshipId && !!actorId,
    queryFn: () => fetchRelationshipDetail(relationshipId, clubId),
    queryKey: NETWORK_QK.detail(actorId, clubId, relationshipId),
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  const decide = useMutation({
    mutationFn: (decision: RelationshipAction) => {
      // §26: una chiave per decisione, stabile fra i retry dello stesso gesto.
      operationKeyRef.current[decision] =
        operationKeyRef.current[decision] ?? newNetworkOperationKey();

      return decideRelationship({
        clubId,
        decision,
        idempotencyKey: operationKeyRef.current[decision],
        relationshipId,
        version: detail?.version ?? null,
      });
    },
    onError: (error, decision) => {
      const parsed = toNetworkError(error);
      setErrorMessage(describeNetworkError(parsed.code));
      trackNetworkEvent("network_decision_result", {
        decision,
        error_code: parsed.code,
        outcome: "error",
      });

      if (parsed.code === "PROPOSAL_CHANGED" || parsed.code === "OPERATION_CONTENT_CHANGED") {
        // I termini sono cambiati: il gesto successivo è un'altra operazione
        // e richiede una nuova lettura (§14).
        operationKeyRef.current = {};
      }

      void queryClient.invalidateQueries({
        queryKey: NETWORK_QK.detail(actorId, clubId, relationshipId),
      });
    },
    onSuccess: (_result, decision) => {
      trackNetworkEvent("network_decision_result", { decision, outcome: "ok" });
      showToast({ message: SUCCESS_COPY[decision] });
      invalidateNetwork(queryClient);
      router.back();
    },
  });

  const run = useCallback(
    (decision: RelationshipAction) => {
      setErrorMessage(null);
      trackNetworkEvent("network_decision_submitted", { decision });
      decide.mutate(decision);
    },
    [decide],
  );

  if (detailQuery.isLoading && !detail) {
    return <DashboardSkeleton />;
  }

  if (!detail) {
    return (
      <DashboardGlobalError
        body="Riprova tra poco."
        onRetry={() => void detailQuery.refetch()}
        title="Questa richiesta non è più disponibile"
      />
    );
  }

  const canAccept = detail.allowedActions.includes("accept");
  const canReject = detail.allowedActions.includes("reject");
  const canCancel = detail.allowedActions.includes("cancel");
  const isIncoming = detail.recipientClubId === clubId;
  const viewerSociety = detail.viewerSide === "a" ? detail.clubA : detail.clubB;

  return (
    <>
      <NetworkScaffold
        errorMessage={errorMessage}
        onBack={() => router.back()}
        onPrimary={canAccept ? () => run("accept") : undefined}
        primaryDisabled={decide.isPending}
        primaryLabel="Accetta"
        primaryLoading={decide.isPending}
        testID="network-review"
        title="Richiesta di collegamento"
      >
        <SocietyIdentityRow
          society={viewerSociety}
          subtitle={isIncoming ? "Società destinataria" : "Società richiedente"}
        />

        <SocietyIdentityRow
          society={detail.counterpart}
          subtitle={
            isIncoming
              ? "Società richiedente"
              : (locationLabel(
                  detail.counterpart.city,
                  detail.counterpart.province,
                  detail.counterpart.region,
                ) ?? "Società destinataria")
          }
        />

        {detail.proposalSentence ? (
          <AppText color="neutral" testID="network-review-proposal" variant="bodyLg">
            {detail.proposalSentence}
          </AppText>
        ) : null}

        {/* §13: tipo e ruoli sono read-only — il campo non è tappabile. */}
        <NetworkFieldRow
          label="Tipo di collegamento"
          testID="network-review-type"
          value={detail.typeLabel}
        />

        {detail.draftSentence ? (
          <AppText color="neutralMuted" testID="network-review-sentence" variant="bodySm">
            {detail.draftSentence}
          </AppText>
        ) : null}

        <AppText color="neutralSoft" variant="meta">
          Ogni società mantiene i propri amministratori e dati.
        </AppText>

        {!canAccept && !canCancel ? (
          <AppText color="neutralSoft" variant="meta">
            {detail.status === "pending" ? "In attesa." : "Richiesta già gestita."}
          </AppText>
        ) : null}

        {canReject ? (
          /* §3: azione secondaria = link testuale blu, senza riempimento. */
          <Pressable
            accessibilityRole="button"
            disabled={decide.isPending}
            onPress={() => run("reject")}
            style={styles.secondary}
            testID="network-review-reject"
          >
            <AppText color="accent" variant="actionLabel">
              Rifiuta
            </AppText>
          </Pressable>
        ) : null}

        {canCancel ? (
          /* §15: l'annullamento è del solo mittente autorizzato e solo finché
             pending. Non è un rifiuto e non è una terminazione. */
          <Pressable
            accessibilityRole="button"
            disabled={decide.isPending}
            onPress={() => setCancelPrompt(true)}
            style={styles.secondary}
            testID="network-review-cancel"
          >
            <AppText color="accent" variant="actionLabel">
              Annulla richiesta
            </AppText>
          </Pressable>
        ) : null}
      </NetworkScaffold>

      <ConfirmModal
        cancelLabel="Mantieni richiesta"
        confirmLabel="Annulla richiesta"
        isBusy={decide.isPending}
        onCancel={() => setCancelPrompt(false)}
        onConfirm={() => {
          setCancelPrompt(false);
          run("cancel");
        }}
        title="Annullare la richiesta di collegamento?"
        visible={cancelPrompt}
      />
    </>
  );
}

const styles = StyleSheet.create({
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
