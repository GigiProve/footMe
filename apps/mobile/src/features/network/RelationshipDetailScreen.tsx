/**
 * Dettaglio del collegamento (master 08 e 09) e dettaglio storico (da 10).
 *
 * Un solo renderer per attivo e concluso (§23: «Tap apre il dettaglio
 * storico, riutilizzando il renderer dello screen 08 con data di inizio e
 * fine, stato contestuale e dati read-only»), e un solo renderer per tutti i
 * tipi (§21: «Nessun componente hardcoded distinto per ogni tipo»): la
 * differenza fra un'affiliazione e una partnership è una frase che arriva dal
 * catalogo, non un componente.
 *
 * Le azioni sono quelle che il server dichiara in `allowedActions`. §5 chiede
 * di «omettere le azioni non autorizzate» e non di disabilitarle, quindi qui
 * non esiste un pulsante disabled per mancanza di permesso.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../theme/tokens";
import { AppText, BottomSheet, Button, useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../dashboard/components/DashboardStates";
import { STALE_MS } from "../dashboard/cache/freshness-policy";
import { NetworkNavBar } from "./components/NetworkNavBar";
import { NetworkFieldRow } from "./components/NetworkFieldRow";
import { SocietyIdentityRow } from "./components/SocietyIdentityRow";
import { NETWORK_QK, NETWORK_QK_PREFIXES } from "./network-keys";
import {
  describeNetworkError,
  historyPeriodLabel,
  locationLabel,
  longDateLabel,
} from "./network-presentation";
import {
  decideRelationship,
  fetchRelationshipDetail,
  toNetworkError,
} from "./network-service";
import { newNetworkOperationKey } from "./operation-key";
import { trackNetworkEvent } from "./network-analytics";

type Props = {
  clubId: string;
  relationshipId: string;
};

export function RelationshipDetailScreen({ clubId, relationshipId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [operationKey, setOperationKey] = useState(() => newNetworkOperationKey());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    enabled: !!clubId && !!relationshipId && !!actorId,
    queryFn: () => fetchRelationshipDetail(relationshipId, clubId),
    queryKey: NETWORK_QK.detail(actorId, clubId, relationshipId),
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  const terminate = useMutation({
    mutationFn: () =>
      decideRelationship({
        clubId,
        decision: "end",
        idempotencyKey: operationKey,
        relationshipId,
        version: detail?.version ?? null,
      }),
    onError: (error) => {
      const parsed = toNetworkError(error);
      setErrorMessage(describeNetworkError(parsed.code));
      trackNetworkEvent("network_decision_result", {
        decision: "end",
        error_code: parsed.code,
        outcome: "error",
      });

      // §26: la stessa chiave identifica lo stesso tentativo. Si rigenera solo
      // quando la decisione cambia — qui il contenuto è cambiato sotto, non
      // il gesto, quindi la conferma va ripresa da capo.
      if (parsed.code === "PROPOSAL_CHANGED" || parsed.code === "OPERATION_CONTENT_CHANGED") {
        setOperationKey(newNetworkOperationKey());
      }

      void queryClient.invalidateQueries({
        queryKey: NETWORK_QK.detail(actorId, clubId, relationshipId),
      });
    },
    onSuccess: () => {
      trackNetworkEvent("network_decision_result", {
        decision: "end",
        outcome: "ok",
      });
      setSheetOpen(false);
      showToast({ message: "Collegamento terminato" });
      invalidateNetwork(queryClient);
      // §22: «tornare al Centro, tab Collegate, con la relazione rimossa».
      router.back();
    },
  });

  const openProfile = useCallback(() => {
    if (!detail) {
      return;
    }

    trackNetworkEvent("network_profile_opened", {});
    // §21: il profilo **pubblico** della controparte, mai la sua Dashboard.
    router.push(`/club/${detail.counterpart.clubId}`);
  }, [detail, router]);

  if (detailQuery.isLoading && !detail) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Dettaglio collegamento" />
        <DashboardSkeleton />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Dettaglio collegamento" />
        <DashboardGlobalError
          body="Riprova tra poco."
          onRetry={() => void detailQuery.refetch()}
          title="Questo collegamento non è più disponibile"
        />
      </View>
    );
  }

  const isHistory = detail.status === "ended";
  const canTerminate = detail.allowedActions.includes("end");
  const period = historyPeriodLabel(detail);

  return (
    <View style={styles.root}>
      <NetworkNavBar
        onBack={() => router.back()}
        title={isHistory ? "Dettaglio storico" : "Dettaglio collegamento"}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* §21: «due identità leggibili allo stesso livello». */}
        <SocietyIdentityRow
          society={detail.viewerSide === "a" ? detail.clubA : detail.clubB}
          subtitle="Società corrente"
          testID="relationship-current"
        />

        <SocietyIdentityRow
          society={detail.counterpart}
          subtitle={locationLabel(
            detail.counterpart.city,
            detail.counterpart.province,
            detail.counterpart.region,
          )}
          testID="relationship-counterpart"
        />

        {/* Read-only: §21 «Il tipo e la direzione sono read-only. Sono termini
            accettati da entrambe le parti e non possono essere cambiati
            unilateralmente.» */}
        <NetworkFieldRow
          label="Tipo di collegamento"
          testID="relationship-type"
          value={detail.typeLabel}
        />

        {detail.activeSentence ? (
          <View style={styles.block}>
            <AppText color="neutralMuted" variant="meta">
              Relazione
            </AppText>
            <AppText color="neutral" variant="bodyLg">
              {detail.activeSentence}
            </AppText>
          </View>
        ) : null}

        <View style={styles.block}>
          <AppText color="neutralMuted" variant="meta">
            {isHistory ? "Periodo" : "Collegamento attivo dal"}
          </AppText>
          <AppText color="neutral" variant="bodyLg">
            {isHistory
              ? (period ?? "—")
              : (longDateLabel(detail.acceptedAt) ?? "—")}
          </AppText>
        </View>

        {/* §3, riga 08 della matrice: navigazione secondaria, fondo bianco,
            bordo neutro, testo nero. */}
        <Button
          fullWidth
          label="Vedi profilo società"
          onPress={openProfile}
          size="lg"
          testID="relationship-open-profile"
          variant="neutralOutline"
        />

        {canTerminate ? (
          /* §3, riga 08: azione testuale distinta, nera neutra, che apre la
             conferma. Non una primaria blu e non un'area rossa. */
          <Pressable
            accessibilityRole="button"
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.danger, pressed ? styles.pressed : null]}
            testID="relationship-terminate"
          >
            <AppText color="neutral" variant="actionLabel">
              Termina collegamento
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomSheet
        onClose={() => setSheetOpen(false)}
        visible={sheetOpen}
      >
        <View style={styles.sheet}>
          <AppText color="neutral" variant="titleMd">
            {`Terminare il collegamento con ${detail.counterpart.name}?`}
          </AppText>

          <AppText color="neutralMuted" variant="bodySm">
            La relazione passerà nello storico. Le società, le squadre e i dati
            rimarranno invariati.
          </AppText>

          {errorMessage ? (
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {errorMessage}
            </AppText>
          ) : null}

          {/* §3, riga 09: conferma distruttiva sobria — fondo bianco, bordo
              neutro, testo nero. Mai il blu della primaria positiva. */}
          <Button
            fullWidth
            label="Termina collegamento"
            loading={terminate.isPending}
            onPress={() => terminate.mutate()}
            size="lg"
            testID="relationship-terminate-confirm"
            variant="neutralOutline"
          />

          <Pressable
            accessibilityRole="button"
            disabled={terminate.isPending}
            onPress={() => setSheetOpen(false)}
            style={styles.keep}
            testID="relationship-terminate-keep"
          >
            <AppText color="accent" variant="actionLabel">
              Mantieni collegamento
            </AppText>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

export function invalidateNetwork(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  for (const prefix of NETWORK_QK_PREFIXES) {
    void queryClient.invalidateQueries({ queryKey: [prefix] });
  }
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    gap: spacing[20],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  block: {
    gap: spacing[6],
  },
  danger: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  sheet: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  keep: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.7,
  },
});
