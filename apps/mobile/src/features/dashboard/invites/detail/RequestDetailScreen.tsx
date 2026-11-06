/**
 * Dettaglio consultabile della richiesta ricevuta (§15).
 *
 * «Il tap apre il dettaglio canonico della richiesta con richiedente,
 * società, ruolo, ambito, Team quando pertinente, stato e date reali.»
 *
 * Nessuna azione, e non è una dimenticanza: §15 è esplicito — «Se non è
 * ancora disponibile, implementa la lettura reale sullo stesso oggetto/route
 * estendibile, senza Approva/Rifiuta non funzionanti o finte conferme». La
 * gestione arriva con DAS-REV-21, sulla **stessa** destinazione.
 *
 * La lettura viene marcata qui, dopo l'apertura riuscita, con l'operazione
 * esplicita e idempotente che §15 richiede: non da una GET dell'hub, non da
 * una prefetch, e per il solo actor che sta guardando.
 */
import { useCallback, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { InviteFieldRow } from "../components/InviteFieldRow";
import { InvitePersonHeader } from "../components/InvitePersonHeader";
import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_QK } from "../invites-keys";
import {
  INVITES_COPY,
  formatLongDate,
  stateLabel,
} from "../invites-presentation";
import {
  InvitesAccessError,
  fetchReceivedRequest,
  markRequestRead,
} from "../invites-service";

export function RequestDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;

  const requestQuery = useQuery({
    enabled: !!requestId && !!actorId,
    queryFn: () => fetchReceivedRequest(requestId as string),
    queryKey: INVITES_QK.request(actorId, requestId ?? ""),
    retry: (failureCount, raw) =>
      !(raw instanceof InvitesAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const request = requestQuery.data ?? null;

  const markRead = useMutation({
    mutationFn: () => markRequestRead(requestId as string),
    onSuccess: () => {
      /* La lista e i suoi count si riconciliano; lo stato PENDING non
         cambia (§15). */
      void queryClient.invalidateQueries({ queryKey: ["society-invites-list"] });
      void queryClient.invalidateQueries({ queryKey: ["society-invites-center"] });
    },
  });

  const { isSuccess } = requestQuery;
  const isUnread = request?.isUnread ?? false;
  const { mutate: markReadMutate } = markRead;

  useEffect(() => {
    /* Solo dopo un'apertura riuscita, e una sola volta: l'operazione è
       idempotente lato server, ma non c'è motivo di ripeterla. */
    if (isSuccess && isUnread && requestId) {
      markReadMutate();
    }
  }, [isSuccess, isUnread, markReadMutate, requestId]);

  useEffect(() => {
    if (isSuccess) {
      trackInvitesEvent("invite_request_opened");
    }
  }, [isSuccess]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard/invites?tab=received" as never);
  }, [router]);

  const header = (
    <View style={styles.navWrap}>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={goBack}
          style={styles.back}
          testID="invite-request-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          color="neutral"
          style={styles.barTitle}
          variant="titleMd"
        >
          {INVITES_COPY.requestTitle}
        </AppText>
      </View>
    </View>
  );

  if (!requestId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <DashboardGlobalError
          body="Riapri la richiesta dal Centro."
          onRetry={goBack}
          title="Richiesta non disponibile"
        />
      </View>
    );
  }

  if (requestQuery.isLoading && !request) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.content}>
          <DashboardSkeleton />
        </View>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <DashboardGlobalError
          body="Non siamo riusciti a caricare la richiesta. Riprova."
          onRetry={() => void requestQuery.refetch()}
          title="Richiesta non disponibile"
        />
      </View>
    );
  }

  const resolved = formatLongDate(request.resolvedAt);
  const created = formatLongDate(request.createdAt);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
      >
        <InvitePersonHeader
          avatarUrl={request.personAvatarUrl}
          name={request.personName}
          subtitle={request.contextLabel}
        />

        <AppText color="neutralMuted" style={styles.section} variant="metaStrong">
          {INVITES_COPY.linkSection}
        </AppText>

        <InviteFieldRow label="Ruolo" value={request.roleLabel} />

        {request.scopeType === "society" ? (
          <InviteFieldRow
            label={INVITES_COPY.scopeFieldLabel}
            showDivider
            value={INVITES_COPY.societyScope}
          />
        ) : (
          <InviteFieldRow
            label={INVITES_COPY.teamFieldLabel}
            showDivider
            value={request.contextLabel}
          />
        )}

        <InviteFieldRow
          label="Stato"
          showDivider
          value={
            resolved
              ? `${stateLabel(request.state)} · ${resolved}`
              : stateLabel(request.state)
          }
        />

        {created ? (
          <InviteFieldRow label="Ricevuta" showDivider value={created} />
        ) : null}

        {request.state === "pending" ? (
          /*
           * Questa è una riga `club_members.self_request` **storica**: non
           * ha ruolo strutturato, ambito né versione, e DAS-REV-21 §48 vieta
           * di «reinterpretare record terminali validi» inventandoglieli.
           * Le proposte canoniche hanno la propria destinazione, con Approva
           * e Rifiuta, sulla stessa route con `kind=role`.
           */
          <AppText color="neutralMuted" style={styles.helper} variant="meta">
            Questa richiesta è stata inviata prima della gestione dei ruoli e
            può essere risolta soltanto dall'organico della squadra.
          </AppText>
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
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  barTitle: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  section: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  helper: {
    paddingTop: spacing[24],
  },
});
