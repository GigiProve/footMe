/**
 * Ultimo amministratore: nomina e uscita atomiche (DAS-REV-33 §19; PNG 13).
 *
 * Per l'unico ADMIN di un gruppo ACTIVE il tap su «Lascia gruppo» arriva qui.
 * Elenca i MEMBER attivi diversi dall'actor e ancora idonei (dal server),
 * multiselezione con check — minimo uno, contatore reale: due selezioni sono
 * «2 selezionati», non il numero dei candidati — e un solo comando: promuove i
 * successori e chiude il periodo dell'actor nella stessa transazione. Niente
 * «Promuovi» e «Lascia» separati.
 *
 * Se un sostituto perde validità il server fa rollback completo: l'actor resta,
 * nessuna promozione parziale; restano le selezioni ancora valide e serve una
 * nuova conferma (§19). Se nel frattempo c'è un altro ADMIN, o il gruppo è
 * stato archiviato, il comando non reinterpreta la selezione: si ritorna alla
 * pagina Info, che propone l'uscita ordinaria.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button, SearchField, useToast } from "../../../../ui";
import { purgeConversationCache } from "../../../messaging/use-group-chat-access";
import { GroupNotice } from "../compose/components/GroupComposeChrome";
import { PersonCheckRow } from "../compose/components/GroupPeopleStep";
import { trackGroupRetry } from "../groups-analytics";
import { GROUP_MANAGE_COPY as C, GROUPS_COPY } from "../groups-copy";
import { GROUPS_QK } from "../groups-keys";
import { canConfirmHandover, leaveOutcomeOf, selectionAfterTargetsFailure } from "../groups-manage-presentation";
import { toggleSelection } from "../groups-presentation";
import { GROUP_MANAGE_HREFS } from "../groups-routes";
import { fetchHandoverCandidatesPage, leaveGroupWithHandover, toGroupsError } from "../groups-service";
import { DEFAULT_GROUP_LIMITS, type GroupManageOrigin, type HandoverCandidatesPage } from "../groups-types";
import { GroupManageHeader, GroupRowsSkeleton } from "./components/GroupManageChrome";
import { invalidateGroupQueries } from "./group-cache";
import { useGroupCommand } from "./use-group-command";
import { useGroupFailureHandler, useGroupManagement } from "./use-group-management";

const SEARCH_DEBOUNCE_MS = 300;

export function GroupHandoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ conversationId?: string; origin?: string }>();
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const origin: GroupManageOrigin = params.origin === "dashboard" ? "dashboard" : "messages";
  /* Dopo l'uscita le query si spengono: nessun refetch le ricrea (§17, §26). */
  const [leaving, setLeaving] = useState(false);
  const { actorId, management } = useGroupManagement(conversationId, !leaving);
  const { pending, run } = useGroupCommand({ limits: management?.limits ?? DEFAULT_GROUP_LIMITS, origin });
  const { exit, handleFailure } = useGroupFailureHandler({
    actorId,
    conversationId,
    onExiting: () => setLeaving(true),
    origin,
  });

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  /* Lo stato è cambiato mentre la pagina era aperta (altro ADMIN, archivio):
     la successione non è più necessaria (§19). Non si reinterpreta la
     selezione: si dice e si torna a Info, che propone l'uscita ordinaria. */
  const staleByManagement = management !== null && management.leavePath !== "handover";

  const candidates = useInfiniteQuery<
    HandoverCandidatesPage,
    Error,
    InfiniteData<HandoverCandidatesPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !leaving && !!actorId && !!conversationId && !staleByManagement,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchHandoverCandidatesPage({ conversationId, cursor: pageParam, query }),
    queryKey: GROUPS_QK.handover(actorId, conversationId, query),
    retry: (count, failure) => !toGroupsError(failure).isAccessLost && count < 1,
    staleTime: 0,
  });

  const error = candidates.error ? toGroupsError(candidates.error) : null;
  const people = candidates.data?.pages.flatMap((page) => page.items) ?? [];
  const count = selected.length;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(GROUP_MANAGE_HREFS.info(conversationId, origin) as never);
  };

  const errorCode = error?.code ?? null;
  /* Derivato dall'errore durante il render: nessun setState in un effetto. */
  const stale = staleByManagement || errorCode === "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED";

  /* La lettura dice «non serve» (altro ADMIN o archivio): si rilegge Info, così
     il prossimo «Lascia gruppo» è già quello ordinario. */
  useEffect(() => {
    if (errorCode === "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED") {
      void invalidateGroupQueries(queryClient, actorId, conversationId);
    }
  }, [actorId, conversationId, errorCode, queryClient]);

  /* `exit` è ricreata a ogni render ma protetta da un ref: agisce una volta sola. */
  useEffect(() => {
    if (errorCode === "SOCIETY_GROUP_DELETED") {
      void exit("deleted");
    } else if (errorCode === "SOCIETY_GROUP_NOT_MEMBER") {
      void exit("ended");
    }
  }, [errorCode, exit]);

  const toggle = (id: string) => {
    if (pending) return;

    setSelected((previous) => toggleSelection(previous, id));
    setBanner(null);
  };

  const submit = async () => {
    const periodId = management?.myPeriodId;

    if (!periodId || !canConfirmHandover({ count, pending: pending !== null })) return;

    setBanner(null);

    const outcome = await run({
      command: "handover",
      count,
      exec: (operationKey) =>
        leaveGroupWithHandover({ conversationId, operationKey, periodId, successorIds: selected }),
      signature: `${periodId}:${[...selected].sort().join(",")}`,
    });

    if (!outcome) return;

    if (!outcome.ok) {
      if (outcome.failure.kind === "targets") {
        /* Rollback completo: l'actor resta, nessuna promozione parziale. Le
           selezioni valide si conservano e si ricontrolla il set (§19). */
        setSelected((previous) =>
          selectionAfterTargetsFailure(previous, {
            personIds: outcome.error.personIds,
            validIds: outcome.error.validIds,
          }),
        );
      }

      const message = handleFailure(outcome);

      if (outcome.failure.kind === "handover_not_required") {
        showToast({ id: "group-handover-state", message: C.stateChanged, tone: "neutral" });
        goBack();

        return;
      }

      setBanner(message);

      return;
    }

    if (leaveOutcomeOf(outcome.value) === "stale") {
      /* Un nuovo ingresso dopo la schermata: nessuna uscita (§18). */
      void invalidateGroupQueries(queryClient, actorId, conversationId);
      goBack();

      return;
    }

    if (origin === "messages") {
      void exit("done");
    } else {
      await purgeConversationCache(queryClient, conversationId);
      await invalidateGroupQueries(queryClient, actorId, conversationId);
      goBack();
    }
  };

  const retry = () => {
    trackGroupRetry("handover");
    void candidates.refetch();
  };

  const header = (
    <View style={styles.listHeader}>
      <AppText color="neutralMuted" variant="bodySm">
        {C.handoverBody}
      </AppText>
      {banner ? <GroupNotice testID="group-handover-banner" text={banner} /> : null}
      {stale ? <GroupNotice testID="group-handover-stale" text={C.stateChanged} tone="info" /> : null}
      <SearchField
        onChangeText={setSearch}
        onClear={() => setSearch("")}
        placeholder={GROUPS_COPY.searchPeople}
        testID="group-handover-search"
        value={search}
      />
    </View>
  );

  let empty: React.ReactNode = null;

  if (!candidates.data) {
    empty =
      error && !error.isAccessLost ? (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            {error.code === "NETWORK" ? C.offline : C.peopleLoadError}
          </AppText>
          <Button label={C.retry} onPress={retry} size="sm" style={styles.retry} variant="neutralOutline" />
        </View>
      ) : stale ? null : (
        <GroupRowsSkeleton />
      );
  } else if (people.length === 0) {
    empty = (
      <AppText color="neutralMuted" style={styles.state} variant="bodySm">
        {query.length > 0 ? C.peopleSearchEmpty : C.handoverEmpty}
      </AppText>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GroupManageHeader onBack={goBack} title={C.handoverTitle} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        <FlatList
          ListEmptyComponent={empty}
          ListFooterComponent={
            candidates.isFetchingNextPage ? <ActivityIndicator color={colors.textNeutralMuted} style={styles.footerSpinner} /> : null
          }
          ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          data={people}
          keyExtractor={(person) => person.profileId}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (candidates.hasNextPage && !candidates.isFetchingNextPage) {
              void candidates.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <PersonCheckRow checked={selected.includes(item.profileId)} onToggle={toggle} person={item} />
          )}
          testID="group-handover-list"
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
          {stale ? null : (
            <>
              <AppText
                accessibilityLiveRegion="polite"
                align="center"
                color="neutral"
                testID="group-handover-counter"
                variant="metaStrong"
              >
                {GROUPS_COPY.selected(count)}
              </AppText>
              <Button
                disabled={!canConfirmHandover({ count, pending: false })}
                fullWidth
                label={C.handoverCta}
                loading={pending === "handover"}
                onPress={() => void submit()}
                testID="group-handover-submit"
              />
            </>
          )}
          <Button
            disabled={pending === "handover"}
            fullWidth
            label={C.cancel}
            onPress={goBack}
            testID="group-handover-cancel"
            variant="secondary"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[20],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  footerSpinner: {
    paddingVertical: spacing[16],
  },
  listHeader: {
    gap: spacing[12],
    paddingBottom: spacing[8],
    paddingTop: spacing[4],
  },
  retry: {
    alignSelf: "flex-start",
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  state: {
    gap: spacing[8],
    paddingVertical: spacing[24],
  },
});
