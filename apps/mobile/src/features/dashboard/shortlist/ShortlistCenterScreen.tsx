/**
 * Centro Shortlist della Dashboard Società (DAS-REV-24, screen 02-08).
 *
 * Una sola pagina per i sette stati della tavola: cambiano dati, accessi e
 * stato, non il layout. «Per posizione» sopra, «Liste personalizzate» sotto,
 * nello **stesso scroll** — §9 vieta tab switcher, pannelli alternativi e
 * pagine separate per tipo.
 *
 * I due gruppi hanno provider, cursore e stato di errore **indipendenti**:
 * §12 — «Se un solo gruppo fallisce e l'altro è utilizzabile, gestisci un
 * errore locale nel gruppo, non un vuoto», e «Il vuoto globale richiede
 * entrambi i gruppi risolti con successo e vuoti». La decisione di quale
 * superficie mostrare non vive qui ma in `centerPresentation`, che i test
 * possono interrogare senza montare la schermata.
 *
 * La bottom navigation resta visibile con Dashboard selezionata: la route
 * vive nello Stack annidato della tab.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { CreateListModal } from "../../shortlist/components/CreateListModal";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardOfflineNotice,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { ShortlistRow } from "./components/ShortlistRow";
import { CUSTOM_COPY } from "./custom/custom-shortlist-presentation";
import { fetchShortlistGovernanceCaps } from "./custom/custom-shortlist-service";
import {
  ShortlistSection,
  ShortlistSectionEmpty,
  ShortlistSectionError,
  ShortlistSectionSkeleton,
} from "./components/ShortlistSection";
import { SHORTLIST_QK } from "./shortlist-keys";
import { SHORTLIST_COPY, centerPresentation, type GroupState } from "./shortlist-presentation";
import { SHORTLIST_HREFS } from "./shortlist-routes";
import {
  fetchShortlistCenterHeader,
  fetchShortlistCustomGroup,
  fetchShortlistPositionGroup,
} from "./shortlist-service";
import { ShortlistError } from "./shortlist-types";

const DOUBLE_TAP_MS = 600;

function groupState(query: {
  data: unknown;
  isError: boolean;
  isLoading: boolean;
}): GroupState {
  if (query.data) {
    return "ready";
  }

  return query.isError ? "error" : "loading";
}

export function ShortlistCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);

  /* DAS-REV-27 §19: la voce «Recupera liste» dipende da una capability
     amministrativa propria, non da quelle Shortlist: si legge a parte e non
     blocca il Centro se fallisce. */
  const capsQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchShortlistGovernanceCaps(clubId as string),
    queryKey: SHORTLIST_QK.governanceCaps(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });
  const headerMenu = capsQuery.data?.canRecover
    ? { accessibilityLabel: "Altre azioni Shortlist", onPress: () => setMenuOpen(true) }
    : null;

  // ── Eligibility prima dei dati (§5, §12) ──────────────────────────────
  //
  // §12: «Prima della validazione di accesso non mostrare header
  // organizzativo proveniente da cache non più affidabile.» I due gruppi
  // restano disabilitati finché la testata non ha risposto.
  const headerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchShortlistCenterHeader(clubId as string),
    queryKey: SHORTLIST_QK.header(actorId, clubId ?? ""),
    retry: (failureCount, error) =>
      !(error instanceof ShortlistError && error.kind !== "network") &&
      failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loadedHeader = headerQuery.data ?? null;

  /* §22: «Dati organizzativi con autorizzazioni troppo vecchie non restano
     accessibili offline indefinitamente. Riutilizza la policy di validità
     dei permessi della Foundation.» */
  const accessWindow = useAccessWindow({
    accessVerifiedAt: loadedHeader?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const header = accessWindow.isValid ? loadedHeader : null;
  const canLoadGroups = !!header?.canView;

  useEffect(() => {
    if (!accessWindow.isValid && loadedHeader && !headerQuery.isFetching) {
      void headerQuery.refetch();
    }
    // Solo la transizione di validità deve rivalidare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  const positionQuery = useQuery({
    enabled: !!clubId && !!actorId && canLoadGroups,
    queryFn: () => fetchShortlistPositionGroup(clubId as string),
    queryKey: SHORTLIST_QK.positionGroup(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const customQuery = useQuery({
    enabled: !!clubId && !!actorId && canLoadGroups,
    queryFn: () => fetchShortlistCustomGroup(clubId as string),
    queryKey: SHORTLIST_QK.customGroup(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  useEffect(() => {
    if (headerQuery.error) {
      reportFailure(headerQuery.error);
    } else if (headerQuery.isSuccess) {
      reportSuccess();
    }
  }, [headerQuery.error, headerQuery.isSuccess, reportFailure, reportSuccess]);

  // ── Navigazione ───────────────────────────────────────────────────────

  const lastPushRef = useRef<{ at: number; href: string } | null>(null);

  const go = useCallback(
    (href: string) => {
      const now = Date.now();
      const last = lastPushRef.current;

      if (last && last.href === href && now - last.at < DOUBLE_TAP_MS) {
        return;
      }

      lastPushRef.current = { at: now, href };
      router.push(href as never);
    },
    [router],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.header(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.positionGroup(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.customGroup(actorId, clubId ?? ""),
      }),
    ]);
  }, [actorId, clubId, queryClient]);

  /* §28: «Riordina nei safe point: ingresso, ritorno da un'azione esplicita,
     refresh completato.» Il ritorno da un dettaglio o dalla creazione di una
     CUSTOM è uno di quei punti; la prima apertura no. */
  const hasFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;

        return;
      }

      void refresh();
    }, [refresh]),
  );

  // ── Shell ─────────────────────────────────────────────────────────────

  const recoveryMenu = (
    <BottomSheet onClose={() => setMenuOpen(false)} visible={isMenuOpen}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMenuOpen(false);
          router.push(SHORTLIST_HREFS.recoveryList() as never);
        }}
        style={({ pressed }) => [styles.menuRow, pressed ? styles.menuPressed : null]}
        testID="shortlist-menu-recover"
      >
        <Ionicons color={colors.textNeutral} name="person-add-outline" size={20} />
        <AppText color="neutral" style={styles.menuLabel} variant="bodyLg">
          {CUSTOM_COPY.menuRecover}
        </AppText>
        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      </Pressable>
    </BottomSheet>
  );

  const shell = (children: React.ReactNode, headerProps?: { name: string; logoUrl: string | null; isVerified: boolean }) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        isVerified={headerProps?.isVerified ?? false}
        logoUrl={headerProps?.logoUrl ?? null}
        menu={headerMenu}
        name={headerProps?.name ?? (current?.name ?? "")}
        onBack={() => router.back()}
        title={SHORTLIST_COPY.title}
      />

      {children}
      {recoveryMenu}
    </View>
  );

  if (!clubId) {
    /* §5: «Non compare nella Dashboard PERSON o MEDIA come se fosse uno
       strumento personale.» Un deep link non aggira il controllo (§8). */
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: SHORTLIST_COPY.unavailableBody,
          icon: "lock-closed-outline",
          title: SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  const authError =
    headerQuery.error instanceof ShortlistError &&
    (headerQuery.error.kind === "notAuthorized" ||
      headerQuery.error.kind === "notFound");

  if (authError || (loadedHeader && !loadedHeader.canView)) {
    /* §22: «Deep link non disponibile: Contenuto non disponibile / Non hai
       accesso a questa shortlist oppure non è più disponibile. / Torna alla
       Dashboard.» Senza rivelare nome della lista o Society. */
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: SHORTLIST_COPY.unavailableBody,
          icon: "lock-closed-outline",
          title: SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  if (!header) {
    /* §12, screen 07: «mantieni header già noto e heading Shortlist. Mostra
       skeleton di due gruppi di righe». L'identità della Dashboard è già
       verificata: non è una cache organizzativa non affidabile. */
    /**
     * §27: «Senza cache utilizzabile: Sei offline / Connettiti a Internet
     * per caricare le shortlist. / Riprova», e «Retry read con backoff e
     * limiti condivisi; niente loop infinito o **skeleton eterno**.»
     *
     * La condizione era `isError && offline`, e offline la query non va mai
     * in errore: TanStack la mette in pausa (`fetchStatus: "paused"`) e
     * `isError` resta falso. Il risultato era proprio lo skeleton eterno
     * che §27 vieta — trovato montando la schermata nell'harness, dove il
     * browser headless è offline per costruzione.
     */
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={SHORTLIST_COPY.offlineBody}
          onRetry={() => void refresh()}
        />,
      );
    }

    if (headerQuery.isError) {
      return shell(
        <DashboardGlobalError
          body={SHORTLIST_COPY.errorBody}
          onRetry={() => void refresh()}
          title={SHORTLIST_COPY.errorTitle}
        />,
      );
    }

    return shell(
      <View style={styles.content}>
        <ShortlistSection title={SHORTLIST_COPY.positionsSection}>
          <ShortlistSectionSkeleton rows={3} />
        </ShortlistSection>

        <ShortlistSection title={SHORTLIST_COPY.customSection}>
          <ShortlistSectionSkeleton rows={1} />
        </ShortlistSection>
      </View>,
    );
  }

  const positionState = groupState(positionQuery);
  const customState = groupState(customQuery);
  const positionRows = positionQuery.data?.rows ?? [];
  const customRows = customQuery.data?.rows ?? [];

  const presentation = centerPresentation({
    capabilities: header,
    customCount: customRows.length,
    customState,
    positionCount: positionRows.length,
    positionState,
  });

  const headerProps = {
    isVerified: header.clubIsVerified,
    logoUrl: header.clubLogoUrl,
    name: header.clubName,
  };

  if (presentation.kind === "globalError") {
    return shell(
      connection === "offline" ? (
        <DashboardGlobalOffline
          body={SHORTLIST_COPY.offlineBody}
          onRetry={() => void refresh()}
        />
      ) : (
        <DashboardGlobalError
          body={SHORTLIST_COPY.errorBody}
          onRetry={() => void refresh()}
          title={SHORTLIST_COPY.errorTitle}
        />
      ),
      headerProps,
    );
  }

  if (presentation.kind === "globalEmpty") {
    return shell(
      <View style={styles.globalEmpty} testID="shortlist-global-empty">
        <Ionicons
          color={colors.textNeutralSoft}
          name="document-text-outline"
          size={44}
        />

        <AppText align="center" color="neutral" variant="headingSm">
          {SHORTLIST_COPY.globalEmptyTitle}
        </AppText>

        <AppText align="center" color="neutralMuted" variant="bodySm">
          {presentation.body}
        </AppText>

        {/* §4: «Le primarie piene del mockup sono Crea lista personalizzata
            nello stato vuoto globale, Riprova nell'errore globale e Aggiungi
            alla shortlist nella candidatura.» */}
        {presentation.showCreate ? (
          <Button
            label={SHORTLIST_COPY.createCustom}
            onPress={() => setCreateOpen(true)}
            size="lg"
            style={styles.globalEmptyCta}
            testID="shortlist-empty-create"
            variant="primary"
          />
        ) : null}

        {clubId && profile ? (
          <CreateListModal
            clubId={clubId}
            createdByProfileId={profile.id}
            onClose={() => setCreateOpen(false)}
            onCreated={(listId) => {
              setCreateOpen(false);
              go(SHORTLIST_HREFS.customList(listId));
            }}
            society={{ logoUrl: header.clubLogoUrl, name: header.clubName }}
            successMode="skip"
            visible={isCreateOpen}
          />
        ) : null}
      </View>,
      headerProps,
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        {...headerProps}
        menu={headerMenu}
        onBack={() => router.back()}
        title={SHORTLIST_COPY.title}
      />

      {/* §27: «offline mantiene leggibili i dati con feedback Sei offline ·
          Dati non aggiornati. Non disabilitare visivamente tutta la pagina.» */}
      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      {header.scopeLabel ? (
        <AppText color="neutralMuted" style={styles.scope} variant="meta">
          {`Ambito: ${header.scopeLabel}`}
        </AppText>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={headerQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="shortlist-center-scroll"
      >
        <ShortlistSection
          testID="shortlist-position-section"
          title={SHORTLIST_COPY.positionsSection}
        >
          {positionState === "loading" ? <ShortlistSectionSkeleton rows={3} /> : null}

          {positionState === "error" ? (
            <ShortlistSectionError
              isRetrying={positionQuery.isFetching}
              onRetry={() => void positionQuery.refetch()}
              sectionTitle={SHORTLIST_COPY.positionsSection}
              testID="shortlist-position-error"
            />
          ) : null}

          {positionState === "ready" && positionRows.length === 0 ? (
            <ShortlistSectionEmpty message={SHORTLIST_COPY.positionsEmpty} />
          ) : null}

          {positionRows.map((row, index) => (
            <ShortlistRow
              isClosed={row.isClosed}
              isDraft={row.isDraft}
              key={row.shortlistId}
              onPress={() => go(SHORTLIST_HREFS.position(row.positionId))}
              profilesCount={row.profilesCount}
              scopeLabel={row.scopeLabel}
              showDivider={index > 0}
              testID={`shortlist-position-${row.positionId}`}
              title={row.title}
            />
          ))}

          {positionQuery.data?.nextCursor ? (
            <LoadMore
              onPress={() => void loadMorePositions(queryClient, actorId, clubId)}
            />
          ) : null}
        </ShortlistSection>

        <ShortlistSection
          testID="shortlist-custom-section"
          title={SHORTLIST_COPY.customSection}
        >
          {customState === "loading" ? <ShortlistSectionSkeleton rows={2} /> : null}

          {customState === "error" ? (
            <ShortlistSectionError
              isRetrying={customQuery.isFetching}
              onRetry={() => void customQuery.refetch()}
              sectionTitle={SHORTLIST_COPY.customSection}
              testID="shortlist-custom-error"
            />
          ) : null}

          {customState === "ready" && customRows.length === 0 ? (
            <ShortlistSectionEmpty message={SHORTLIST_COPY.customEmpty} />
          ) : null}

          {customRows.map((row, index) => (
            <ShortlistRow
              key={row.shortlistId}
              onPress={() => go(SHORTLIST_HREFS.customList(row.shortlistId))}
              profilesCount={row.profilesCount}
              scopeLabel={row.scopeLabel}
              showDivider={index > 0}
              testID={`shortlist-custom-${row.shortlistId}`}
              title={row.name}
            />
          ))}

          {/* §9: «Alla fine della sezione CUSTOM mostra + Crea lista
              personalizzata se consentito. Il link apre direttamente il
              flusso manuale esistente.» §4 vieta di convertirlo in un grande
              pulsante globale sopra entrambe le sezioni. */}
          {header.canCreateLists ? (
            <CreateLink onPress={() => setCreateOpen(true)} />
          ) : null}
        </ShortlistSection>
      </ScrollView>

      {clubId && profile ? (
        <CreateListModal
          clubId={clubId}
          createdByProfileId={profile.id}
          onClose={() => setCreateOpen(false)}
          onCreated={(listId) => {
            /* DAS-REV-27 §10: «Successo confermato apre la stessa nuova
               CUSTOM, vuota se creata dal Centro.» */
            setCreateOpen(false);
            go(SHORTLIST_HREFS.customList(listId));
          }}
          society={{ logoUrl: header.clubLogoUrl, name: header.clubName }}
          successMode="skip"
          visible={isCreateOpen}
        />
      ) : null}
      {recoveryMenu}
    </View>
  );
}

/**
 * §24: «mostra entrambi i gruppi con pagine indipendenti e caricamento
 * esplicito o progressivo non intrusivo. Nessuna nuova tab e nessun
 * conteggio basato sul dataset parziale.»
 */
function LoadMore({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.loadMore}>
      <AppText
        accessibilityRole="button"
        color="accent"
        onPress={onPress}
        testID="shortlist-load-more"
        variant="actionLabel"
      >
        Carica altre
      </AppText>
    </View>
  );
}

function CreateLink({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.createLink}>
      <AppText
        accessibilityLabel={SHORTLIST_COPY.createCustom}
        accessibilityRole="button"
        color="accent"
        onPress={onPress}
        testID="shortlist-create-link"
        variant="actionLabel"
      >
        {`+ ${SHORTLIST_COPY.createCustom}`}
      </AppText>
    </View>
  );
}

/**
 * Pagina successiva del gruppo Position.
 *
 * Vive fuori dal componente perché §24 chiede pagine **per gruppo**: la
 * cache del gruppo è la sola cosa che cambia, e il resto del centro non si
 * rimonta.
 */
async function loadMorePositions(
  queryClient: ReturnType<typeof useQueryClient>,
  actorId: string,
  clubId: string,
) {
  const key = SHORTLIST_QK.positionGroup(actorId, clubId);
  const current = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchShortlistPositionGroup>>
  >(key);

  if (!current?.nextCursor) {
    return;
  }

  const next = await fetchShortlistPositionGroup(clubId, current.nextCursor);

  queryClient.setQueryData(key, {
    nextCursor: next.nextCursor,
    rows: [...current.rows, ...next.rows],
  });
}

const styles = StyleSheet.create({
  menuRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
    minHeight: sizes.touchTarget + spacing[8],
  },
  menuLabel: {
    flex: 1,
  },
  menuPressed: {
    opacity: 0.6,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  content: {
    gap: spacing[24],
    paddingBottom: spacing[32],
    paddingTop: spacing[4],
  },
  scope: {
    paddingBottom: spacing[8],
  },
  globalEmpty: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    paddingBottom: spacing[48],
    paddingHorizontal: spacing[16],
  },
  globalEmptyCta: {
    alignSelf: "stretch",
    marginTop: spacing[8],
  },
  createLink: {
    paddingTop: spacing[12],
  },
  loadMore: {
    paddingTop: spacing[12],
  },
});
