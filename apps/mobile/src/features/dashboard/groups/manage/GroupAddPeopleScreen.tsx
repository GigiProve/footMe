/**
 * Aggiungi persone a un gruppo esistente (DAS-REV-33 §13; PNG 08).
 *
 * Riusa il selector della 32 (`GroupPeopleStep`): la Squadra del gruppo prima,
 * poi «Altre persone della Società»; check nelle righe, nessun chip o doppio
 * elenco; footer «N selezionati» e «Aggiungi · N», disabilitato con zero.
 * Chi è eleggibile lo decide il server dalla conversazione, dalla Squadra e
 * dallo scope dell'actor (§13, QA-049/050): il client seleziona solo ID.
 *
 * «Seleziona tutti» copre l'intero set eleggibile della Squadra, anche oltre la
 * pagina, con ricerca vuota; conserva le deselezioni manuali e non tronca in
 * silenzio al massimo centrale (§13, QA-057/058).
 *
 * Il batch è atomico: se qualcuno non è più disponibile il server non aggiunge
 * nessuno; le selezioni ancora valide restano per la revisione e non c'è un
 * secondo invio automatico (§13, QA-059). Un retry dello stesso intento riusa
 * la chiave: un solo periodo e un solo evento (QA-060).
 */
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { GroupComposeFooter, GroupNotice } from "../compose/components/GroupComposeChrome";
import { GroupPeopleStep } from "../compose/components/GroupPeopleStep";
import { trackGroupAddPeopleOpened } from "../groups-analytics";
import { GROUP_MANAGE_COPY as C, GROUPS_COPY } from "../groups-copy";
import { GROUPS_QK } from "../groups-keys";
import { addExceedsMax, canConfirmAdd, selectionAfterTargetsFailure } from "../groups-manage-presentation";
import { addToSelection, showSelectAll, toggleSelection } from "../groups-presentation";
import { GROUP_MANAGE_HREFS } from "../groups-routes";
import { addGroupPeople, fetchGroupEligiblePage, fetchGroupEligibleTeamIds, toGroupsError } from "../groups-service";
import { DEFAULT_GROUP_LIMITS, type GroupEligiblePage, type GroupManageOrigin } from "../groups-types";
import { GroupManageHeader } from "./components/GroupManageChrome";
import { invalidateGroupQueries } from "./group-cache";
import { useGroupCommand } from "./use-group-command";
import { useGroupFailureHandler, useGroupManagement } from "./use-group-management";

const SEARCH_DEBOUNCE_MS = 300;

/** Nessun creator da escludere: l'actor è già nel gruppo e il server non lo propone. */
const NO_CREATOR = "";

export function GroupAddPeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ conversationId?: string; origin?: string }>();
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const origin: GroupManageOrigin = params.origin === "dashboard" ? "dashboard" : "messages";
  /* Dopo la revoca le query si spengono: nessun refetch le ricrea (§17, §26). */
  const [leaving, setLeaving] = useState(false);
  const { actorId, management } = useGroupManagement(conversationId, !leaving);
  const limits = management?.limits ?? DEFAULT_GROUP_LIMITS;
  const { pending, run } = useGroupCommand({ limits, origin });
  const { handleFailure } = useGroupFailureHandler({
    actorId,
    conversationId,
    onExiting: () => setLeaving(true),
    origin,
  });

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    trackGroupAddPeopleOpened(origin);
  }, [origin]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const eligible = useInfiniteQuery<
    GroupEligiblePage,
    Error,
    InfiniteData<GroupEligiblePage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !leaving && !!actorId && !!conversationId,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchGroupEligiblePage({ conversationId, cursor: pageParam, query }),
    queryKey: GROUPS_QK.eligible(actorId, conversationId, query),
    retry: (count, failure) => !toGroupsError(failure).isAccessLost && count < 1,
    staleTime: 0,
  });

  const pages = eligible.data?.pages;
  const people = pages?.flatMap((page) => page.items) ?? [];
  const teamTotal = pages?.[0]?.teamTotal ?? 0;
  const activeCount = pages?.[0]?.activeCount ?? management?.peopleCount ?? 0;
  const teamId = management?.teamId ?? null;
  const teamName = teamId ? management?.teamName ?? null : null;
  const count = selected.length;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(GROUP_MANAGE_HREFS.info(conversationId, origin) as never);
  };

  const toggle = (id: string) => {
    if (bulkPending || pending) return;

    setSelected((previous) => toggleSelection(previous, id));
    setBanner(null);
    setBulkError(null);
  };

  const selectAll = async () => {
    if (bulkPending || pending || !teamId) return;

    setBulkPending(true);
    setBulkError(null);
    setBanner(null);

    try {
      const ids = await fetchGroupEligibleTeamIds(conversationId);
      const next = addToSelection(selected, ids, NO_CREATOR);

      /* §13: se «tutti» supera il massimo non si selezionano i primi N. */
      if (addExceedsMax(activeCount, next.length, limits)) {
        setBulkError(GROUPS_COPY.tooMany(limits.maxPeople));
      } else {
        setSelected(next);
      }
    } catch (failure) {
      setBulkError(
        toGroupsError(failure).code === "SOCIETY_GROUP_TOO_MANY_PEOPLE"
          ? GROUPS_COPY.tooMany(limits.maxPeople)
          : GROUPS_COPY.selectAllError,
      );
    } finally {
      setBulkPending(false);
    }
  };

  const submit = async () => {
    if (!canConfirmAdd({ bulkPending, count, pending: pending !== null })) return;

    setBanner(null);

    const outcome = await run({
      command: "add_people",
      count,
      exec: (operationKey) => addGroupPeople({ conversationId, operationKey, personIds: selected }),
      signature: [...selected].sort().join(","),
    });

    if (!outcome) return;

    if (outcome.ok) {
      await invalidateGroupQueries(queryClient, actorId, conversationId);
      goBack();

      return;
    }

    if (outcome.failure.kind === "targets") {
      /* §13: nessuna aggiunta parziale; restano le selezioni ancora valide,
         da rivedere e confermare di nuovo. */
      setSelected((previous) =>
        selectionAfterTargetsFailure(previous, {
          personIds: outcome.error.personIds,
          validIds: outcome.error.validIds,
        }),
      );
    }

    setBanner(handleFailure(outcome));
  };

  const unavailable = management !== null && !management.capabilities.canManagePeople;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GroupManageHeader onBack={goBack} title={C.addPeopleTitle} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        <View style={styles.body}>
          {unavailable ? (
            <View style={styles.unavailable}>
              <GroupNotice testID="group-add-unavailable" text={C.manageNotAllowed} />
            </View>
          ) : (
            <GroupPeopleStep
              banner={banner}
              bulkError={bulkError}
              bulkPending={bulkPending}
              fetchingNext={eligible.isFetchingNextPage}
              hasError={eligible.isError}
              helpText={null}
              loading={eligible.isPending}
              onEndReached={() => {
                if (eligible.hasNextPage && !eligible.isFetchingNextPage) {
                  void eligible.fetchNextPage();
                }
              }}
              onRetry={() => void eligible.refetch()}
              onSearchChange={setSearch}
              onSelectAll={() => void selectAll()}
              onToggle={toggle}
              people={people}
              query={query}
              search={search}
              selected={selected}
              showSelectAll={showSelectAll({ query, teamId, teamTotal })}
              teamName={teamName}
            />
          )}
        </View>

        {unavailable ? null : (
          <GroupComposeFooter
            counter={GROUPS_COPY.selected(count)}
            disabled={!canConfirmAdd({ bulkPending, count, pending: false })}
            label={C.addCta(count)}
            loading={pending === "add_people"}
            onPress={() => void submit()}
            testID="group-add-submit"
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  unavailable: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
});
