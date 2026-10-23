/**
 * Anteprima dell'annuncio prima della pubblicazione (DAS-REV-17 §15).
 *
 * «"Vedi anteprima annuncio" riutilizza il renderer pubblico del composer,
 * con tutti i dati della versione candidata alla pubblicazione.» Il
 * contenuto è infatti `PositionPublicContent`, lo stesso componente del
 * dettaglio pubblico: non una seconda resa che può divergere.
 *
 * «Sheet e anteprima sono due alternative per la conferma finale della
 * stessa operazione, non due step obbligatori»: pubblicare da qui esegue
 * direttamente il comando, «senza riaprire un altro popup».
 *
 * Non c'è «Candidati», non c'è una data di pubblicazione simulata, non ci
 * sono readiness tecniche: l'anteprima mostra l'annuncio, non la sua
 * gestione.
 */
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { COMPOSE_QK } from "../compose/compose-keys";
import {
  createSessionNonce,
  operationKeyOf,
} from "../compose/compose-operation-key";
import { describeBlocker } from "../compose/compose-presentation";
import { fetchCatalogs } from "../compose/compose-service";
import { ComposerFooter } from "../compose/components/ComposerFooter";
import { ComposerNavBar } from "../compose/components/ComposerNavBar";
import { PositionPublicContent } from "../compose/components/PositionPublicContent";
import { usePublishPositions } from "../compose/use-publish-positions";
import { POSITIONS_QK } from "../positions-keys";
import { MANAGE_COPY } from "./manage-presentation";
import { MANAGE_HREFS } from "./manage-routes";
import { fetchPositionManageDetail } from "./manage-service";

const EMPTY_CATALOGS = {
  categories: [],
  experiences: [],
  qualifications: [],
  roles: [],
  seasons: [],
};

export function PositionManagePreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const positionId = typeof id === "string" ? id : "";

  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(createSessionNonce);

  const detailQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchPositionManageDetail(positionId),
    queryKey: POSITIONS_QK.detail(actorId, positionId),
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  const catalogsQuery = useQuery({
    enabled: !!detail,
    queryFn: () => fetchCatalogs(detail?.profileType ?? "player"),
    queryKey: COMPOSE_QK.catalogs(detail?.profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  const publishMutation = usePublishPositions({
    onError: (_composeError, message) => setError(message),
    /* §16: si torna al dettaglio dello stesso oggetto, che dopo il commit
       è la posizione attiva. `dismissAll` chiuderebbe anche il dettaglio. */
    onSuccessNavigate: () => router.back(),
    operationKey: operationKeyOf(
      nonce,
      `publish:${positionId}:${detail?.resourceVersion ?? 0}`,
    ),
    successMessage: () => MANAGE_COPY.publishSuccess,
  });

  if (detailQuery.isLoading && !detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna indietro",
            body: "Potrebbe essere stata eliminata o non essere più nel tuo perimetro.",
            icon: "briefcase-outline",
            title: MANAGE_COPY.gone,
          }}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const publishable = detail.canPublish && detail.blockers.length === 0;
  const blocker = detail.blockers[0] ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* §15: «Il back torna allo sheet.» Il dettaglio è rimasto montato e
          riapre la conferma quando riprende il focus. */}
      <ComposerNavBar
        isVerified={detail.clubIsVerified}
        logoUrl={detail.clubLogoUrl}
        name={detail.clubName}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        testID="position-manage-preview"
      >
        <PositionPublicContent
          catalogs={catalogsQuery.data ?? EMPTY_CATALOGS}
          draft={detail}
        />

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

      <ComposerFooter
        inlineSecondary={
          detail.canEdit ? (
            <View style={styles.editButton}>
              {/* §15: «"Modifica" apre l'editor della bozza e invalida la
                  precedente anteprima dopo un cambiamento.» Il ritorno
                  rilegge la versione corrente. */}
              <Button
                fullWidth
                label="Modifica"
                onPress={() =>
                  router.replace(MANAGE_HREFS.edit(detail.id) as never)
                }
                testID="position-preview-edit"
                variant="neutralOutline"
              />
            </View>
          ) : undefined
        }
        onPrimary={() => {
          setError(null);
          publishMutation.mutate({
            expectedVersions: [detail.resourceVersion],
            positionIds: [detail.id],
            remaining: 0,
          });
        }}
        primaryDisabled={!publishable}
        primaryLabel={MANAGE_COPY.publishAction}
        primaryLoading={publishMutation.isPending}
        primaryTestID="position-preview-publish"
      />
    </View>
  );
}

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
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
});
