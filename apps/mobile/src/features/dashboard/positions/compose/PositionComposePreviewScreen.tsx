/**
 * Anteprima singola (DAS-REV-16 §23, mockup screen 12).
 *
 * «L'anteprima usa quanto più possibile lo stesso renderer del dettaglio
 * pubblico Position con una modalità privata di preview»: il contenuto è
 * `PositionPublicContent`, lo stesso componente del dettaglio pubblico.
 * Qui intorno ci sono solo la scadenza — che è un controllo **owner** — e
 * le due CTA.
 *
 * Cosa non c'è, deliberatamente (§23): nessun «Candidati», nessuna data di
 * pubblicazione simulata, nessuna readiness tecnica, nessun dato privato
 * dell'actor. La preview non entra in Cerca né in una URL pubblica.
 */
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { trackComposeEvent } from "./compose-analytics";
import { COMPOSE_QK } from "./compose-keys";
import {
  describeBlocker,
  describeComposeError,
  isPublishable,
} from "./compose-presentation";
import { COMPOSE_HREFS } from "./compose-routes";
import {
  fetchCatalogs,
  fetchComposerContext,
  fetchPositionDrafts,
  setPositionDeadline,
  toComposeError,
} from "./compose-service";
import { ComposerFooter } from "./components/ComposerFooter";
import { ComposerNavBar } from "./components/ComposerNavBar";
import { ComposerStepHeader } from "./components/ComposerStepHeader";
import { DeadlineControl } from "./components/DeadlineControl";
import { PositionPublicContent } from "./components/PositionPublicContent";
import { useComposeSession } from "./ComposeSessionProvider";
import { usePublishPositions } from "./use-publish-positions";

export function PositionComposePreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ positionId?: string }>();
  const positionId =
    typeof params.positionId === "string" ? params.positionId : "";

  const { createdIds, publishOperationKey } = useComposeSession();
  const [error, setError] = useState<string | null>(null);

  const draftsQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchPositionDrafts([positionId]),
    queryKey: COMPOSE_QK.drafts(actorId, [positionId]),
    staleTime: STALE_MS.operational,
  });

  const draft = draftsQuery.data?.[0] ?? null;
  const profileType = draft?.profileType ?? null;

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const catalogsQuery = useQuery({
    enabled: profileType !== null,
    queryFn: () => fetchCatalogs(profileType ?? "player"),
    queryKey: COMPOSE_QK.catalogs(profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  /* La scadenza persiste sulla **stessa** bozza con patch e versione: §23
     — «non pubblica e non crea una copia della bozza». */
  const deadlineMutation = useMutation({
    mutationFn: (deadlineDate: string | null) =>
      setPositionDeadline({
        deadlineDate,
        expectedVersion: draft?.resourceVersion ?? null,
        positionId,
      }),
    onError: (mutationError) =>
      setError(describeComposeError(toComposeError(mutationError))),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["position-compose-drafts"] });
    },
  });

  const publishMutation = usePublishPositions({
    onError: (_composeError, message) => setError(message),
    operationKey: publishOperationKey,
  });

  if (draftsQuery.isLoading || contextQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna indietro",
            body: "Potrebbe essere stata eliminata o non essere più nel tuo perimetro.",
            icon: "briefcase-outline",
            title: "Questa posizione non è più disponibile.",
          }}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  /* §23: «Per chi può preparare ma non pubblicare, la preview resta
     utilizzabile quando autorizzata e offre salvataggio/ritorno alle
     bozze.» Non una primaria disabilitata per sempre. */
  const canPublish = draft.canPublish;
  const publishable = isPublishable(draft);
  const blocker = draft.blockers[0] ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={draft.clubIsVerified}
        logoUrl={draft.clubLogoUrl}
        name={draft.clubName}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <ComposerStepHeader step={3} title="Anteprima" />

        <PositionPublicContent
          catalogs={
            catalogsQuery.data ?? {
              categories: [],
              experiences: [],
              qualifications: [],
              roles: [],
              seasons: [],
            }
          }
          draft={draft}
        />

        {/* §23: il controllo sta dopo il contenuto e prima delle CTA, ed è
            owner-only — il renderer candidato non lo conosce. */}
        {canPublish ? (
          <DeadlineControl
            busy={deadlineMutation.isPending}
            onChange={(value) => deadlineMutation.mutate(value)}
            value={draft.deadlineDate}
          />
        ) : null}

        {blocker ? (
          <AppText accessibilityRole="alert" color="danger" variant="meta">
            {describeBlocker(blocker)}
          </AppText>
        ) : null}

        {error ? (
          <AppText accessibilityRole="alert" color="danger" variant="meta">
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      {canPublish ? (
        <ComposerFooter
          inlineSecondary={
            <View style={styles.editButton}>
              {/* §4: «Modifica nell'anteprima singola — secondaria
                  outlined, distinta da Pubblica posizione.» */}
              <Button
                fullWidth
                label="Modifica"
                onPress={() =>
                  router.replace(
                    COMPOSE_HREFS.details(draft.id, { from: "single" }) as never,
                  )
                }
                testID="compose-preview-edit"
                variant="neutralOutline"
              />
            </View>
          }
          onPrimary={() => {
            setError(null);
            trackComposeEvent("position_compose_preview_opened", {
              mode: "single",
              profileType: draft.profileType,
              scope: draft.scope,
            });
            publishMutation.mutate({
              expectedVersions: [draft.resourceVersion],
              positionIds: [draft.id],
              /* Le altre bozze della sessione restano tali (§26). */
              remaining: Math.max(createdIds.length - 1, 0),
            });
          }}
          primaryDisabled={!publishable}
          primaryLabel="Pubblica posizione"
          primaryLoading={publishMutation.isPending}
          primaryTestID="compose-publish-single"
        />
      ) : (
        /* Senza capability di pubblicazione la bozza resta preparabile e
           l'uscita conserva quanto salvato: §23 vieta sia una primaria
           disabilitata permanente sia un'approvazione editoriale. */
        <ComposerFooter
          helper="Puoi preparare questa posizione, ma non pubblicarla."
          onPrimary={() =>
            router.replace(COMPOSE_HREFS.details(draft.id, { from: "single" }) as never)
          }
          primaryLabel="Modifica"
          secondaryLabel={BACK_TO_DRAFTS_LABEL}
          secondaryOnPress={() => {
            router.dismissAll();
            router.replace("/(tabs)/dashboard/positions" as never);
          }}
        />
      )}
    </View>
  );
}

const BACK_TO_DRAFTS_LABEL = "Torna alle bozze";

const styles = StyleSheet.create({
  content: {
    gap: spacing[12],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  editButton: {
    flex: 1,
  },
  /* §4: «il footer resta sopra safe area e tastiera, con spazio di
     scorrimento sufficiente dopo l'ultimo campo.» Senza `flex: 1` la
     ScrollView si dimensiona sul contenuto e il footer risale sotto
     l'ultimo campo invece di restare in fondo. */
  scroll: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
