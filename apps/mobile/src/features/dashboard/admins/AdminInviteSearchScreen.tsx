/**
 * Cerca persona (DAS-REV-13, screen 02).
 *
 * «Riutilizza la ricerca canonica delle PERSON, rispettando visibility e
 * blocking del dominio» (§8). Il backend aggiunge lo stato amministrativo
 * minimo rispetto alla Società — già amministratore, invito già inviato — e
 * quelle righe non sono selezionabili.
 *
 * «Una mancata corrispondenza per nome non prova che la persona non abbia
 * account: il percorso esterno deve funzionare anche per chi è già
 * registrato» (§8). Per questo "Invitala su PROLINK" è sempre presente, non
 * solo quando la ricerca è vuota.
 *
 * Flusso focalizzato: nessuna bottom navigation (§6).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { SearchField } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { formatRole } from "../../profiles/profile-display-helpers";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardModuleEmpty,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { DashboardModuleError } from "../components/DashboardSection";
import { SocietyIdentityHeader } from "../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { AdminPersonRow } from "./components/AdminPersonRow";
import { ADMINS_QK } from "./admins-keys";
import { ADMIN_HREFS } from "./admins-routes";
import { trackAdminEvent } from "./admins-analytics";
import {
  ADMIN_COPY,
  CANDIDATE_STATUS_LABEL,
} from "./admins-presentation";
import { fetchAdminCenter, searchAdminCandidates } from "./admins-service";

/** §8: «Debounce secondo il componente standard, default centralizzato 300 ms». */
const DEBOUNCE_MS = 300;

export function AdminInviteSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [query]);

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAdminCenter(clubId as string),
    queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  /**
   * §8: «Una query precedente lenta non sovrascrive quella più recente.»
   * La query sta nella chiave: TanStack tiene una cache per termine e
   * applica solo la risposta della chiave corrente, quindi una response in
   * ritardo non può riscrivere i risultati di un'altra parola.
   */
  const results = useQuery({
    enabled: !!clubId && !!actorId && debounced.length > 0,
    queryFn: () =>
      searchAdminCandidates({ clubId: clubId as string, query: debounced }),
    queryKey: ADMINS_QK.candidates(actorId, clubId ?? "", debounced),
    staleTime: STALE_MS.operational,
  });

  useEffect(() => {
    if (debounced.length > 0 && results.isSuccess) {
      /* §32: si traccia che una ricerca è avvenuta e quanti risultati ha
         prodotto. Mai la query digitata. */
      trackAdminEvent("admin_invite_search_performed", {
        results: results.data?.rows.length ?? 0,
      });
    }
  }, [debounced, results.data?.rows.length, results.isSuccess]);

  const openExternal = useCallback(() => {
    trackAdminEvent("admin_invite_started", { path: "external" });
    router.push(ADMIN_HREFS.external({ query: debounced }) as never);
  }, [debounced, router]);

  const center = centerQuery.data ?? null;

  if (!clubId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna alla Dashboard",
            body: "Seleziona la società da amministrare.",
            icon: "business-outline",
            title: "Nessuna società selezionata",
          }}
          onAction={() => router.replace("/(tabs)/dashboard" as never)}
        />
      </View>
    );
  }

  const rows = results.data?.rows ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <NetworkNavBar
          onBack={() => router.back()}
          title={ADMIN_COPY.searchTitle}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="admin-search-scroll"
      >
        {center ? (
          <SocietyIdentityHeader
            isVerified={center.clubIsVerified}
            logoUrl={center.clubLogoUrl}
            name={center.clubName}
          />
        ) : null}

        <SearchField
          autoFocus
          onChangeText={setQuery}
          onClear={() => setQuery("")}
          placeholder={ADMIN_COPY.searchPlaceholder}
          testID="admin-search-field"
          value={query}
        />

        {/* §8: «Alla query vuota usa il normale stato iniziale leggero, senza
            suggerimenti di persone inventate.» */}
        {debounced.length === 0 ? null : results.isLoading ? (
          <DashboardSkeleton />
        ) : results.error ? (
          /* §8: «Errore ricerca: conserva query e struttura.» Il retry
             riguarda la ricerca, non la pagina. */
          <DashboardModuleError
            isRetrying={results.isRefetching}
            message="Non siamo riusciti a cercare le persone. Riprova."
            onRetry={() => void results.refetch()}
          />
        ) : rows.length === 0 ? (
          <DashboardModuleEmpty message={ADMIN_COPY.emptySearch} />
        ) : (
          <View>
            {rows.map((row, index) => {
              const status = CANDIDATE_STATUS_LABEL[row.status];

              return (
                <AdminPersonRow
                  avatarUrl={row.avatarUrl}
                  key={row.profileId}
                  /* Il descrittore pubblico per chi è eleggibile; il ruolo
                     amministrativo per chi è già dentro — è ciò che mostra
                     il master, e sono due informazioni diverse (§9). */
                  meta={row.adminRole ?? formatRole(row.role)}
                  onPress={
                    row.status === "eligible"
                      ? () => {
                          trackAdminEvent("admin_invite_candidate_selected");
                          router.push(
                            ADMIN_HREFS.configure({
                              profileId: row.profileId,
                              query: debounced,
                            }) as never,
                          );
                        }
                      : undefined
                  }
                  showDivider={index > 0}
                  status={status}
                  testID={`admin-candidate-${row.profileId}`}
                  title={row.fullName}
                />
              );
            })}
          </View>
        )}

        {/* §8: «Mantieni "Non trovi la persona?" e l'azione "Invitala su
            PROLINK".» Vale anche a risultati presenti: un nome che non
            compare non prova che l'account non esista. */}
        <View style={styles.external}>
          <AppText color="neutralMuted" variant="bodySm">
            {ADMIN_COPY.notFoundQuestion}
          </AppText>

          <Button
            label={ADMIN_COPY.externalCta}
            onPress={openExternal}
            size="md"
            testID="admin-search-external"
            variant="link"
          />
        </View>
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
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  external: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingTop: spacing[16],
  },
});
