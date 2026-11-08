/**
 * Dettaglio di una Lista personalizzata (DAS-REV-27 §9, §15, §16, §18 —
 * screen 04, 05, 07, 10, 11, 14, 15).
 *
 * Sostituisce la schermata di RET-07 dentro la tab Dashboard: §9 —
 * «Dettaglio CUSTOM: nome come titolo, società, scope, count, descrizione
 * solo quando presente e sintesi discreta di accesso.» Righe, filtri,
 * conteggi e scheda della entry sono quelli della 25 (`useShortlistPool`,
 * `ShortlistPoolList`, `ShortlistFilterSheet`): §3 vieta un secondo pool.
 *
 * Il menu «Gestisci lista» compare solo se il server concede almeno una
 * azione (§8): un collaboratore senza Gestire liste non lo vede (screen 07).
 *
 * Revoca (§18): un «non disponibile» da qualunque lettura o comando rimuove
 * dalla cache dettaglio, contesto e pool di questa lista, chiude sheet e
 * form, e mostra lo screen 11 senza nome, owner o motivo. Un errore di rete
 * resta un errore con Riprova.
 */
import { useEffect, useRef, useState } from "react";
import {
  InteractionManager,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, BottomSheet, ConfirmModal, useToast } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
} from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { useAccessWindow } from "../../state/use-access-window";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { ShortlistFilterSheet } from "../components/ShortlistFilterSheet";
import { ShortlistPoolList } from "../components/ShortlistPoolList";
import { ShortlistSectionSkeleton } from "../components/ShortlistSection";
import { useIntentKeys } from "../profile/use-intent-key";
import { SHORTLIST_CROSS_PREFIXES, SHORTLIST_QK, SHORTLIST_QK_PREFIXES } from "../shortlist-keys";
import {
  EMPTY_FILTERS,
  SHORTLIST_COPY,
  filterControlLabel,
  filtersAreActive,
  poolCountLabel,
  poolPresentation,
} from "../shortlist-presentation";
import { SHORTLIST_HREFS } from "../shortlist-routes";
import { fetchShortlistContext } from "../shortlist-service";
import { ShortlistError, type ShortlistFilters } from "../shortlist-types";
import { useShortlistPool } from "../use-shortlist-pool";
import { EditListModal } from "./EditListModal";
import { ManageAccessModal } from "./ManageAccessModal";
import {
  CUSTOM_COPY,
  accessSummary,
  deleteBody,
  governanceErrorCopy,
  isRevocation,
  manageActions,
  type ManageAction,
} from "./custom-shortlist-presentation";
import { deleteCustomShortlist, fetchCustomShortlistDetail } from "./custom-shortlist-service";

const notAvailable = (error: unknown) => error instanceof ShortlistError && isRevocation(error.kind);

type Props = { shortlistId: string };

export function CustomShortlistScreen({ shortlistId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const { connection } = useDashboardConnection();
  const params = useLocalSearchParams<{ focus?: string; updated?: string }>();
  const focusEntryId = typeof params.focus === "string" ? params.focus : null;
  const ownerUpdated = params.updated === "owner";
  const keys = useIntentKeys(`shortlist-delete:${shortlistId}`);

  const [filters, setFilters] = useState<ShortlistFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ManageAction | null>(null);
  const [revoked, setRevoked] = useState(false);
  const pending = useRef<ManageAction | null>(null);

  /* Screen 14: arrivo dal recupero come nuovo proprietario. Esito discreto,
     una volta sola (§24: «Successi discreti … Proprietario aggiornato»). */
  useEffect(() => {
    if (ownerUpdated) {
      showToast({ id: "shortlist-owner-updated", message: CUSTOM_COPY.ownerUpdated });
    }
  }, [ownerUpdated, showToast]);

  const retryNetworkOnly = (count: number, error: Error) =>
    !(error instanceof ShortlistError && error.kind !== "network") && count < 1;

  const detailQuery = useQuery({
    enabled: !!actorId && !revoked,
    queryFn: () => fetchCustomShortlistDetail(shortlistId),
    queryKey: SHORTLIST_QK.customDetail(actorId, shortlistId),
    retry: retryNetworkOnly,
    staleTime: STALE_MS.operational,
  });

  const contextQuery = useQuery({
    enabled: !!actorId && !revoked,
    queryFn: () => fetchShortlistContext({ shortlistId }),
    queryKey: SHORTLIST_QK.context(actorId, shortlistId),
    retry: retryNetworkOnly,
    staleTime: STALE_MS.operational,
  });

  /* §23: «il fallback di autorizzazione locale … è massimo 15 minuti
     dall'ultima verifica server». Oltre, i dati privati non si mostrano
     più: si rivalida, e offline si chiede la connessione (Q27-29). */
  const verifiedAt = detailQuery.data?.accessVerifiedAt ? Date.parse(detailQuery.data.accessVerifiedAt) : null;
  const accessWindow = useAccessWindow({ accessVerifiedAt: verifiedAt, isOrganizational: true });
  const { isFetching: detailFetching, refetch: refetchDetail } = detailQuery;

  useEffect(() => {
    if (!accessWindow.isValid && verifiedAt !== null && !detailFetching && connection !== "offline") {
      void refetchDetail();
    }
  }, [accessWindow.isValid, connection, detailFetching, refetchDetail, verifiedAt]);

  const detail = revoked || !accessWindow.isValid ? null : detailQuery.data ?? null;
  const context = revoked ? null : contextQuery.data ?? null;
  const { head, poolQuery, rows } = useShortlistPool({
    actorId,
    filters,
    focusEntryId,
    listId: detail && context ? shortlistId : null,
  });

  /**
   * §18: «rimuovi i dati riservati dalla UI e dalle cache attive, chiudi
   * sheet/form pertinenti e torna a una route valida o allo screen 11».
   * Idempotente: più letture possono segnalarlo insieme.
   */
  const revoke = () => {
    setRevoked(true);
    setMenuOpen(false);
    setModal(null);
    setFilterOpen(false);
    queryClient.removeQueries({ queryKey: SHORTLIST_QK.customDetail(actorId, shortlistId) });
    queryClient.removeQueries({ queryKey: SHORTLIST_QK.customAccess(actorId, shortlistId) });
    queryClient.removeQueries({ queryKey: SHORTLIST_QK.context(actorId, shortlistId) });
    queryClient.removeQueries({ queryKey: ["society-shortlist-pool", actorId, shortlistId] });
    void queryClient.invalidateQueries({ queryKey: SHORTLIST_QK.customGroup(actorId, current?.id ?? "") });
  };

  const isRevoked =
    revoked ||
    notAvailable(detailQuery.error) ||
    notAvailable(contextQuery.error) ||
    notAvailable(poolQuery.error);

  const reconcileAll = () => {
    for (const prefix of [...SHORTLIST_QK_PREFIXES, ...SHORTLIST_CROSS_PREFIXES]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };

  const deletion = useMutation({
    mutationFn: () => deleteCustomShortlist({ idempotencyKey: keys.key("delete"), shortlistId }),
    onError: (error) => {
      const kind = error instanceof ShortlistError ? error.kind : "network";

      if (kind !== "network") {
        keys.settle("delete");
      }

      setModal(null);

      if (isRevocation(kind)) {
        revoke();
        return;
      }

      if (kind === "notAuthorized") {
        void detailQuery.refetch();
      }

      showToast({
        id: "shortlist-delete-error",
        message: governanceErrorCopy(kind, "delete", connection === "offline"),
      });
    },
    onSuccess: () => {
      keys.settle("delete");
      setRevoked(true);
      setModal(null);
      reconcileAll();
      showToast({ id: "shortlist-deleted", message: CUSTOM_COPY.deleted });
      /* §16: «Dopo conferma torna al Centro o alla provenienza valida;
         nessuna route verso la lista eliminata resta utilizzabile.» */
      router.replace(SHORTLIST_HREFS.center() as never);
    },
  });

  const flushPending = () => {
    const next = pending.current;
    pending.current = null;

    if (next) {
      setModal(next);
    }
  };

  /* Sheet → modale: come il flusso profilo della 26, iOS consegna
     `onDismiss`, Android e web no in modo affidabile. */
  const openFromMenu = (action: ManageAction) => {
    pending.current = action;
    setMenuOpen(false);

    if (Platform.OS !== "ios") {
      void InteractionManager.runAfterInteractions(flushPending);
    }
  };

  const refresh = async () => {
    await Promise.all([detailQuery.refetch(), contextQuery.refetch(), poolQuery.refetch()]);
  };

  const backToDashboard = () => router.replace(SHORTLIST_HREFS.center() as never);

  const bar = (title: string | null, menu: boolean) => (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.back()}
        style={styles.barAction}
        testID="custom-list-back"
      >
        <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
      </Pressable>
      <AppText
        accessibilityRole="header"
        color="neutral"
        numberOfLines={1}
        style={styles.barTitle}
        variant="titleMd"
      >
        {title ?? ""}
      </AppText>
      {menu ? (
        <Pressable
          accessibilityLabel={CUSTOM_COPY.manageLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={[styles.barAction, styles.barMenu]}
          testID="custom-list-menu"
        >
          <Ionicons color={colors.textNeutral} name="ellipsis-horizontal" size={22} />
        </Pressable>
      ) : (
        <View style={styles.barAction} />
      )}
    </View>
  );

  const shell = (title: string | null, children: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {bar(title, false)}
      {children}
    </View>
  );

  if (isRevoked) {
    /* Screen 11: nessun dettaglio riservato, nessun motivo. */
    return shell(
      SHORTLIST_COPY.title,
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: SHORTLIST_COPY.unavailableBody,
          icon: "document-lock-outline",
          title: SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={backToDashboard}
      />,
    );
  }

  if (!detail || !context) {
    if (detailQuery.isError || contextQuery.isError) {
      return shell(
        null,
        <DashboardGlobalError
          body={SHORTLIST_COPY.errorBody}
          onRetry={() => void refresh()}
          title={SHORTLIST_COPY.poolErrorTitle}
        />,
      );
    }

    if (connection === "offline") {
      return shell(
        null,
        <DashboardGlobalOffline body={SHORTLIST_COPY.poolOfflineBody} onRetry={() => void refresh()} />,
      );
    }

    return shell(
      null,
      <View style={styles.content}>
        <ShortlistSectionSkeleton rows={4} />
      </View>,
    );
  }

  const total = head?.total ?? context.profilesCount;
  const filtersApplied = head?.filtersApplied ?? filtersAreActive(filters);
  const filtered = head?.filtered ?? total;
  const surface = poolPresentation({ filtersApplied, rowCount: rows.length, total });
  const access = accessSummary(detail);
  const actions = manageActions(detail);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {bar(detail.name, actions.length > 0)}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}
        onMomentumScrollEnd={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

          if (
            poolQuery.hasNextPage &&
            !poolQuery.isFetchingNextPage &&
            contentOffset.y + layoutMeasurement.height >= contentSize.height - 120
          ) {
            void poolQuery.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={poolQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="custom-list-scroll"
      >
        <View style={styles.summary} testID="custom-list-summary">
          <View style={styles.society}>
            <Avatar
              name={current?.name ?? ""}
              size="sm"
              square
              tone="ink"
              uri={current?.avatarUrl ?? undefined}
            />
            <View style={styles.flex}>
              <View style={styles.societyName}>
                <AppText color="neutral" numberOfLines={1} style={styles.strong} variant="bodySm">
                  {current?.name ?? ""}
                </AppText>
                {current?.isVerified ? (
                  <Ionicons
                    accessibilityLabel="Società verificata"
                    color={colors.accent}
                    name="checkmark-circle"
                    size={14}
                  />
                ) : null}
              </View>
              <AppText
                accessibilityLiveRegion="polite"
                color="neutralMuted"
                testID="custom-list-meta"
                variant="meta"
              >
                {`${detail.scopeLabel} · ${poolCountLabel({ filtered, filtersApplied, total })}`}
              </AppText>
            </View>
          </View>

          {detail.description ? (
            <AppText color="neutralMuted" testID="custom-list-description" variant="bodySm">
              {detail.description}
            </AppText>
          ) : null}

          {/* §4: «La privacy è un'informazione discreta, non una grande area
              colorata.» Testo + icona, leggibile senza colore (§27). */}
          <View accessible style={styles.access} testID="custom-list-access">
            <Ionicons color={colors.textNeutralMuted} name={access.icon} size={14} />
            <AppText color="neutralMuted" variant="meta">
              {access.label}
            </AppText>
          </View>
        </View>

        {total > 0 ? (
          <Pressable
            accessibilityHint="Apre i filtri per priorità e stato"
            accessibilityLabel={`${SHORTLIST_COPY.filterTitle}: ${filterControlLabel(filtersApplied)}`}
            accessibilityRole="button"
            onPress={() => setFilterOpen(true)}
            style={({ pressed }) => [styles.filterRow, pressed ? styles.pressed : null]}
            testID="shortlist-filter-control"
          >
            <AppText color="neutral" style={styles.flex} variant="bodySm">
              {filterControlLabel(filtersApplied)}
            </AppText>
            <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
          </Pressable>
        ) : null}

        <ShortlistPoolList
          emptyBody={CUSTOM_COPY.emptyBody}
          focusEntryId={focusEntryId}
          isError={poolQuery.isError}
          isFetchingNextPage={poolQuery.isFetchingNextPage}
          isLoading={poolQuery.isLoading}
          onClearFilters={() => setFilters(EMPTY_FILTERS)}
          onRetry={() => void poolQuery.refetch()}
          onRowPress={(row) => router.push(SHORTLIST_HREFS.entry(row.entryId) as never)}
          rows={rows}
          surface={surface}
        />
      </ScrollView>

      <ShortlistFilterSheet
        applied={filters}
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
        visible={filterOpen}
      />

      {/* Screen 05: tre voci al massimo, ognuna solo con la capability. */}
      <BottomSheet
        onClose={() => setMenuOpen(false)}
        onDismiss={flushPending}
        title={CUSTOM_COPY.manageTitle}
        visible={menuOpen}
      >
        <View testID="custom-list-manage-sheet">
          {actions.map((action, index) => {
            const destructive = action === "delete";
            const icon =
              action === "edit" ? "create-outline" : action === "access" ? "people-outline" : "trash-outline";
            const label =
              action === "edit"
                ? CUSTOM_COPY.editList
                : action === "access"
                  ? CUSTOM_COPY.manageAccess
                  : CUSTOM_COPY.deleteList;

            return (
              <Pressable
                accessibilityRole="button"
                key={action}
                onPress={() => openFromMenu(action)}
                style={({ pressed }) => [
                  styles.menuRow,
                  index > 0 ? styles.menuDivider : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`custom-list-action-${action}`}
              >
                <Ionicons color={destructive ? colors.danger : colors.textNeutral} name={icon} size={20} />
                <AppText color={destructive ? "danger" : "neutral"} style={styles.flex} variant="bodyLg">
                  {label}
                </AppText>
                {destructive ? null : (
                  <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
                )}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {current && modal === "access" ? (
        <ManageAccessModal
          actorId={actorId}
          clubId={detail.clubId}
          onClose={() => setModal(null)}
          onRevoked={revoke}
          onSaved={() => setModal(null)}
          shortlistId={shortlistId}
          society={{ logoUrl: current.avatarUrl ?? null, name: current.name }}
          visible={modal === "access"}
        />
      ) : null}

      {modal === "edit" ? (
        <EditListModal
          actorId={actorId}
          detail={detail}
          onClose={() => setModal(null)}
          onRevoked={revoke}
          onSaved={() => setModal(null)}
          visible
        />
      ) : null}

      {/* Screen 10: conferma distruttiva sobria (§4, §16). */}
      <ConfirmModal
        cancelLabel={CUSTOM_COPY.cancel}
        confirmLabel={CUSTOM_COPY.deleteList}
        confirmVariant="neutralOutline"
        destructive
        isBusy={deletion.isPending}
        message={deleteBody(detail.name)}
        onCancel={() => setModal(null)}
        onConfirm={() => deletion.mutate()}
        title={CUSTOM_COPY.deleteTitle}
        visible={modal === "delete"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget + spacing[4],
  },
  barAction: {
    alignItems: "flex-start",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  barMenu: {
    alignItems: "flex-end",
    marginLeft: 0,
    marginRight: -spacing[6],
  },
  barTitle: {
    flex: 1,
    textAlign: "center",
  },
  content: {
    gap: 0,
  },
  summary: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[10],
    paddingBottom: spacing[14],
    paddingTop: spacing[8],
  },
  society: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
  },
  societyName: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  flex: {
    flex: 1,
  },
  strong: {
    fontWeight: "600",
  },
  access: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  filterRow: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: sizes.touchTarget + spacing[4],
  },
  menuRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
    minHeight: sizes.touchTarget + spacing[8],
  },
  menuDivider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
