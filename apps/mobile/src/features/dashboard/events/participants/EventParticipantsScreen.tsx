/**
 * Centro Partecipanti di un evento (DAS-REV-30 §21–§26; screen 11-19, 23).
 *
 * Un'unica schermata: contesto evento, «Cerca partecipante», un filtro
 * compatto a sheet (mai tab orizzontali per stato, §5), count contestuale
 * dal server, righe paginate. Nessun count calcolato sulle pagine caricate
 * (§21) e nessuno zero inventato da un errore (§29, screen 19).
 *
 * Comandi: conferma e non accettazione riusano quelli della 29 (§23);
 * revoca e rimozione sono i comandi nuovi. Dopo un esito la riga esce dal
 * filtro se ha cambiato stato e la lista si riallinea dal server (§21).
 * Nessun optimistic update prima del commit (§29).
 *
 * Accesso: Società attiva nella Dashboard e lettura partecipanti (§12). Il
 * server rivalida tutto: un diniego svuota la schermata invece di tenere
 * dati privati dietro un banner (§19).
 */
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, ConfirmModal, EmptyState, SearchField } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { DashboardSkeleton } from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { createSessionNonce, operationKeyOf } from "../../positions/compose/compose-operation-key";
import { ProfileShortlistFlow } from "../../shortlist/profile/ProfileShortlistFlow";
import { eventProfileHref } from "../../shortlist/profile/profile-shortlist-presentation";
import { EventClubBar, EventUnavailableState } from "../detail/components/EventDetailParts";
import {
  DETAIL_COPY,
  capacityLine,
  commandErrorCopy,
  eventSubtitle,
  venueLines,
  whenInline,
  whenLines,
} from "../detail/event-detail-presentation";
import {
  confirmEventParticipation,
  fetchSelectionEventDetail,
  rejectEventParticipation,
} from "../detail/event-detail-service";
import { SELECTION_EVENTS_QK, SELECTION_EVENTS_QK_PREFIXES } from "../events-keys";
import { SELECTION_EVENTS_HREFS } from "../events-routes";
import { SelectionEventsError } from "../events-service";
import { RejectRequestSheet } from "../requests/RejectRequestSheet";
import { ParticipantListRow } from "./components/ParticipantListRow";
import { FilterSheet, ParticipantActionsSheet, RemoveParticipantSheet } from "./components/ParticipantSheets";
import {
  PARTICIPANTS_COPY,
  belongsToFilter,
  countLabel,
  emptyCopy,
  filterLabel,
  normalizeMessage,
  readOnlyNotice,
} from "./participants-presentation";
import {
  fetchEventParticipants,
  parseFilter,
  removeEventParticipant,
  revokeEventInvitation,
} from "./participants-service";
import type { ParticipantRow, ParticipantsFilter, ParticipantsPage } from "./participants-types";

/** Limite centrale della 29 per i messaggi brevi (`selection_event_limits`). */
const MESSAGE_LIMIT = 500;
const SEARCH_DEBOUNCE_MS = 300;

type Command = "confirm" | "reject" | "revoke" | "remove";

export function EventParticipantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current, identities, selectIdentity } = useDashboardIdentity();
  const params = useLocalSearchParams<{ asSociety?: string; eventId?: string; filter?: string }>();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const society = current?.kind === "society" ? current : null;
  /* DAS-REV-31 §25: dalla notifica della Società si passa alla sua identità
     con il percorso canonico del selector, una volta sola e solo se l'actor
     la possiede: un'identità non autorizzata non esiste in `identities`, e
     la vista resta «Contenuto non disponibile». */
  const wanted = identities.find(
    (identity) => identity.kind === "society" && identity.id === params.asSociety,
  );
  const switchPending = !!wanted && current?.id !== wanted.id;
  const switchedRef = useRef(false);

  useEffect(() => {
    if (switchPending && wanted && !switchedRef.current) {
      switchedRef.current = true;
      selectIdentity(wanted.id);
    }
  }, [selectIdentity, switchPending, wanted]);
  const clubId = society?.id ?? "";

  const [filter, setFilter] = useState<ParticipantsFilter>(() => parseFilter(params.filter));
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  /* §21: debounce; la chiave della query protegge dalle risposte vecchie. */
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const detailQuery = useQuery({
    enabled: !!actorId && !!eventId,
    queryFn: () => fetchSelectionEventDetail({ eventId }),
    queryKey: SELECTION_EVENTS_QK.detail(actorId, eventId),
    retry: (count, error) => !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
  });
  const detail = detailQuery.data ?? null;
  /* §12: la vista esiste solo per la Società attiva che possiede l'evento. */
  const contextOk = !!society && !!detail && detail.clubId === society.id;

  const listKey = SELECTION_EVENTS_QK.participants(actorId, clubId, eventId, filter, debounced);
  const listQuery = useInfiniteQuery({
    enabled: !!actorId && !!eventId && contextOk,
    getNextPageParam: (last: ParticipantsPage) => last.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchEventParticipants({ cursor: pageParam, eventId, filter, query: debounced }),
    queryKey: listKey,
    retry: (count, error) => !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
  });

  const pages = listQuery.data?.pages ?? [];
  const first = pages[0] ?? null;
  const rows = pages.flatMap((page) => page.items);

  // ── Comandi ───────────────────────────────────────────────────────────────
  const [nonce] = useState(createSessionNonce);
  const [selected, setSelected] = useState<ParticipantRow | null>(null);
  const [busy, setBusy] = useState<Command | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  /* §15 della 29 / §25: il testo resta anche se il comando fallisce. */
  const [message, setMessage] = useState("");
  const keyRef = useRef<string | null>(null);
  const [starFor, setStarFor] = useState<ParticipantRow | null>(null);

  const invalidate = () => {
    for (const prefix of SELECTION_EVENTS_QK_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };

  const dropFromFilter = (participationId: string, status: ParticipantRow["status"] | null) => {
    if (status && belongsToFilter(status, filter)) {
      return;
    }

    queryClient.setQueryData<InfiniteData<ParticipantsPage>>(listKey, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.participationId !== participationId),
            })),
          }
        : data,
    );
  };

  const closeAll = () => {
    setSelected(null);
    setRejectOpen(false);
    setRevokeOpen(false);
    setRemoveOpen(false);
    setMessage("");
  };

  const run = async (command: Command) => {
    const row = selected;

    if (!row) {
      return;
    }

    const text = command === "reject" || command === "remove" ? normalizeMessage(message) : null;
    /* §27: stessa chiave per i retry della stessa intenzione sulla stessa
       versione; un testo diverso è un intento diverso. */
    const key =
      keyRef.current ?? operationKeyOf(nonce, `${command}|${row.participationId}|${row.version}|${text ?? ""}`);

    keyRef.current = key;
    setBusy(command);

    try {
      const input = { expectedVersion: row.version, idempotencyKey: key, participationId: row.participationId };
      const result =
        command === "confirm"
          ? await confirmEventParticipation(input)
          : command === "reject"
            ? await rejectEventParticipation({ ...input, message: text })
            : command === "revoke"
              ? await revokeEventInvitation(input)
              : await removeEventParticipant({ ...input, message: text });

      keyRef.current = null;
      closeAll();
      dropFromFilter(row.participationId, result.status);
      showToast({
        icon: "checkmark-circle-outline",
        id: `participant-${command}`,
        message:
          command === "confirm"
            ? PARTICIPANTS_COPY.confirmed
            : command === "reject"
              ? PARTICIPANTS_COPY.rejected
              : command === "revoke"
                ? PARTICIPANTS_COPY.revoked
                : PARTICIPANTS_COPY.removed,
      });
      invalidate();
    } catch (error) {
      const copy = commandErrorCopy(error, command === "revoke" ? "invitation" : "decision");

      if (!copy.uncertain) {
        keyRef.current = null;
        /* Stale o già cambiato: si rilegge lo stato e si chiude, senza
           applicare un'altra azione (§29). */
        if (copy.refresh) {
          closeAll();
        }
      }

      showToast({
        icon: "alert-circle-outline",
        id: "participant-command-error",
        message:
          error instanceof SelectionEventsError && error.code === "SELECTION_EVENT_PARTICIPATION_CHANGED"
            ? PARTICIPANTS_COPY.changed
            : copy.refresh || copy.uncertain
              ? copy.message
              : command === "revoke"
                ? PARTICIPANTS_COPY.invitationError
                : PARTICIPANTS_COPY.updateError,
      });

      if (copy.refresh) {
        invalidate();
      }
    } finally {
      setBusy(null);
    }
  };

  /* DAS-REV-31 §8: nome/avatar/chevron aprono il profilo live con il
     contesto evento legato a **questa** persona e a questa Società, nei
     parametri della route — mai uno stato globale. Il push tiene montata
     questa schermata: al ritorno filtro, query e scroll sono quelli di
     prima. */
  const openProfile = (row: ParticipantRow) => {
    setSelected(null);
    router.push(
      (clubId
        ? eventProfileHref({ clubId, eventId, personId: row.personId })
        : `/profile/${encodeURIComponent(row.personId)}`) as never,
    );
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(SELECTION_EVENTS_HREFS.detail(eventId) as never);
    }
  };

  // ── Testata ───────────────────────────────────────────────────────────────
  const header = (
    <View style={styles.header}>
      <EventClubBar
        isVerified={detail?.club.isVerified ?? false}
        logoUrl={detail?.club.logoUrl ?? null}
        name={contextOk ? (detail?.club.name ?? "") : ""}
        onBack={goBack}
      />
      <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
        {PARTICIPANTS_COPY.title}
      </AppText>
      {contextOk && detail ? (
        <View style={styles.eventRow}>
          <Avatar name={detail.club.name} size="sm" square tone="ink" uri={detail.club.logoUrl ?? undefined} />
          <View style={styles.flex}>
            <AppText color="neutral" numberOfLines={2} variant="titleSm">
              {detail.title ?? ""}
            </AppText>
            {[eventSubtitle(detail), whenLines(detail).join(" · ")].filter(Boolean).map((line) => (
              <AppText color="neutralMuted" key={line} numberOfLines={1} variant="meta">
                {line}
              </AppText>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  const unavailable =
    !switchPending &&
    ((detailQuery.error instanceof SelectionEventsError && detailQuery.error.isAuthorization) ||
    (!!detail && !contextOk) ||
    (listQuery.error instanceof SelectionEventsError && listQuery.error.isAuthorization));

  if (unavailable) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.content}>{header}</View>
        <EventUnavailableState body={DETAIL_COPY.unavailableBody} title={DETAIL_COPY.unavailableTitle} />
      </View>
    );
  }

  const controls = (
    <View style={styles.controls}>
      <SearchField
        onChangeText={setQuery}
        onClear={() => setQuery("")}
        placeholder={PARTICIPANTS_COPY.search}
        testID="participants-search"
        value={query}
      />
      <Pressable
        accessibilityLabel={PARTICIPANTS_COPY.filterA11y(filterLabel(filter))}
        accessibilityRole="button"
        onPress={() => setFilterOpen(true)}
        style={({ pressed }) => [styles.filter, pressed ? styles.pressed : null]}
        testID="participants-filter"
      >
        <AppText color="neutral" style={styles.flex} variant="bodySm">
          {filterLabel(filter)}
        </AppText>
        <Ionicons color={colors.textNeutral} name="chevron-down" size={18} />
      </Pressable>
      {first && !listQuery.isError ? (
        <AppText color="neutral" testID="participants-count" variant="metaStrong">
          {countLabel(filter, first.total)}
        </AppText>
      ) : null}
      {first && !first.capabilities.operational && detail ? (
        <View style={styles.readOnly} testID="participants-read-only">
          <Ionicons color={colors.textNeutral} name="flag-outline" size={20} />
          <View style={styles.flex}>
            <AppText color="neutral" variant="titleSm">
              {readOnlyNotice(detail.status).title}
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              {readOnlyNotice(detail.status).body}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );

  const body = (() => {
    if (listQuery.isError) {
      /* §29, screen 19: l'errore non simula zero partecipanti. */
      return (
        <View style={styles.state} testID="participants-error">
          <EmptyState icon="alert-circle-outline" title={PARTICIPANTS_COPY.loadError} variant="error" />
          <Button
            fullWidth
            label={PARTICIPANTS_COPY.retry}
            loading={listQuery.isRefetching}
            onPress={() => void listQuery.refetch()}
            size="lg"
            testID="participants-retry"
            variant="primary"
          />
        </View>
      );
    }

    if (!first) {
      return <DashboardSkeleton />;
    }

    const empty = emptyCopy(filter, debounced.length > 0);

    return (
      <View style={styles.state} testID="participants-empty">
        <EmptyState description={empty.body ?? undefined} icon="people-outline" title={empty.title} />
      </View>
    );
  })();

  const manageable = first?.capabilities.manage ?? false;
  const capacity = detail ? capacityLine(detail) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}
        data={rows}
        keyExtractor={(row) => row.participationId}
        ListEmptyComponent={body}
        ListHeaderComponent={
          <>
            {header}
            {controls}
          </>
        }
        onEndReached={() => {
          if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
            void listQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        onRefresh={() => void listQuery.refetch()}
        refreshing={listQuery.isRefetching && !listQuery.isFetchingNextPage}
        renderItem={({ index, item }) => (
          <ParticipantListRow
            first={index === 0}
            onManage={
              manageable && item.actions.length > 0
                ? () => {
                    keyRef.current = null;
                    setSelected(item);
                  }
                : null
            }
            onOpenProfile={() => openProfile(item)}
            onStar={item.star === "hidden" || !society ? null : () => setStarFor(item)}
            row={item}
          />
        )}
        testID="participants-list"
      />

      <FilterSheet
        onClose={() => setFilterOpen(false)}
        onSelect={(next) => {
          /* §21: cambio filtro preserva la query e riparte dal primo cursore. */
          setFilter(next);
          setFilterOpen(false);
        }}
        selected={filter}
        visible={filterOpen}
      />

      <ParticipantActionsSheet
        busy={busy !== null}
        capacityLine={capacity}
        eventLines={detail ? [whenInline(detail), ...venueLines(detail).slice(0, 1)].filter((l): l is string => !!l) : []}
        onClose={() => {
          if (!busy) {
            setSelected(null);
          }
        }}
        onConfirm={() => void run("confirm")}
        onOpenProfile={() => selected && openProfile(selected)}
        onReject={() => {
          keyRef.current = null;
          setRejectOpen(true);
        }}
        onRemove={() => {
          keyRef.current = null;
          setRemoveOpen(true);
        }}
        onRevoke={() => {
          keyRef.current = null;
          setRevokeOpen(true);
        }}
        row={rejectOpen || revokeOpen || removeOpen ? null : selected}
      />

      {/* §23: «Non accettare» riusa sheet, limite e copy della 29. */}
      <RejectRequestSheet
        busy={busy === "reject"}
        limit={MESSAGE_LIMIT}
        message={message}
        onCancel={() => {
          if (busy !== "reject") {
            setRejectOpen(false);
          }
        }}
        onChangeMessage={(value) => {
          keyRef.current = null;
          setMessage(value);
        }}
        onConfirm={() => void run("reject")}
        personName={selected?.fullName ?? ""}
        visible={rejectOpen && !!selected}
      />

      {/* §24, screen 15: dialog chiaro, primaria distruttiva. */}
      <ConfirmModal
        cancelLabel={PARTICIPANTS_COPY.cancel}
        confirmLabel={PARTICIPANTS_COPY.revoke}
        destructive
        isBusy={busy === "revoke"}
        message={PARTICIPANTS_COPY.revokeBody(selected?.fullName ?? "")}
        onCancel={() => {
          if (busy !== "revoke") {
            setRevokeOpen(false);
          }
        }}
        onConfirm={() => void run("revoke")}
        title={PARTICIPANTS_COPY.revokeTitle}
        visible={revokeOpen && !!selected}
      />

      <RemoveParticipantSheet
        busy={busy === "remove"}
        limit={MESSAGE_LIMIT}
        message={message}
        onCancel={() => {
          if (busy !== "remove") {
            setRemoveOpen(false);
          }
        }}
        onChangeMessage={(value) => {
          keyRef.current = null;
          setMessage(value);
        }}
        onConfirm={() => void run("remove")}
        personName={selected?.fullName ?? ""}
        visible={removeOpen && !!selected}
      />

      {/* §26: la stella riusa il flusso canonico della 26/27, senza
          collegarlo al lifecycle dell'evento. DAS-REV-31 §8, §11: il nuovo
          add porta questo evento come provenienza; il server lo rivalida e,
          se non vale più, il flusso si chiude senza ricadere su PROFILE. */}
      {starFor && society && actorId ? (
        <ProfileShortlistFlow
          actorId={actorId}
          initialStep={starFor.star === "filled" ? "summary" : "selector"}
          onClose={() => {
            setStarFor(null);
            void listQuery.refetch();
          }}
          open
          person={{ avatarUrl: starFor.avatarUrl, fullName: starFor.fullName, id: starFor.personId }}
          society={{
            id: society.id,
            isVerified: society.isVerified,
            logoUrl: society.avatarUrl,
            name: society.name,
          }}
          sourceEventId={eventId || null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[20],
  },
  controls: {
    gap: spacing[12],
    paddingBottom: spacing[8],
    paddingTop: spacing[16],
  },
  eventRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  filter: {
    alignItems: "center",
    borderColor: colors.borderNeutral,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
  flex: {
    flex: 1,
  },
  header: {
    gap: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
  /* Stesso riquadro neutro di EventNoticeCard: niente badge allarmistici. */
  readOnly: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  state: {
    gap: spacing[16],
    paddingTop: spacing[24],
  },
});
