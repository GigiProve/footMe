/**
 * Passo 1 del composer — ricerca della persona (§17, §18, screen 04).
 *
 * «Cerca una persona già registrata su PROLINK.» La ricerca è del backend:
 * eleggibilità, blocking e dati pubblici restituiti sono decisi lì, e questa
 * schermata non filtra né decora niente che il server non abbia già deciso.
 *
 * Il debounce e l'annullamento delle risposte obsolete non sono scritti a
 * mano: la query key contiene il termine, quindi TanStack Query tiene
 * separate le risposte e §17 — «Una query precedente lenta non deve
 * sovrascrivere quella corrente» — è vera per costruzione.
 */
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, SearchField } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardModuleError } from "../../components/DashboardSection";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { InvitesCenterHeader } from "../components/InvitesCenterHeader";
import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_QK } from "../invites-keys";
import { INVITES_COPY } from "../invites-presentation";
import { INVITES_HREFS } from "../invites-routes";
import {
  fetchInvitesCenter,
  searchInviteCandidates,
} from "../invites-service";
import type { InviteCandidate } from "../invites-types";
import { useInviteCompose } from "./InviteComposeProvider";
import { useComposeExitGuard } from "./use-compose-exit-guard";

/** Lunghezza minima, allineata a quella applicata dalla RPC. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

const PROFILE_TYPE_LABELS: Record<InviteCandidate["profileType"], string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

/** «Staff · Match analyst · Monza»: solo i dati pubblici che esistono (§17). */
function candidateMeta(candidate: InviteCandidate): string {
  return [
    PROFILE_TYPE_LABELS[candidate.profileType],
    candidate.specialty,
    candidate.city,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function InviteSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { draft, isDirty, setPerson } = useInviteCompose();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchInvitesCenter(clubId as string),
    queryKey: INVITES_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const center = centerQuery.data ?? null;

  const resultsQuery = useQuery({
    enabled: !!clubId && !!actorId && debounced.length >= MIN_QUERY,
    queryFn: () =>
      searchInviteCandidates({ clubId: clubId as string, query: debounced }),
    queryKey: INVITES_QK.candidates(actorId, clubId ?? "", debounced),
    staleTime: STALE_MS.operational,
  });

  useEffect(() => {
    if (resultsQuery.isSuccess && debounced.length >= MIN_QUERY) {
      trackInvitesEvent("invite_search_performed", {
        results: resultsQuery.data.rows.length > 0 ? "some" : "none",
      });
    }
  }, [debounced, resultsQuery.data, resultsQuery.isSuccess]);

  const confirmExit = useComposeExitGuard({ isDirty });

  const select = useCallback(
    (candidate: InviteCandidate) => {
      trackInvitesEvent("invite_candidate_selected", {
        profile_type: candidate.profileType,
      });
      setPerson(candidate);
    },
    [setPerson],
  );

  const goNext = useCallback(() => {
    trackInvitesEvent("invite_step_advanced", { step: "person" });
    router.push(INVITES_HREFS.composeConfigure as never);
  }, [router]);

  const rows = resultsQuery.data?.rows ?? [];
  const searching = debounced.length >= MIN_QUERY;
  const empty = searching && resultsQuery.isSuccess && rows.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <InvitesCenterHeader
          isVerified={center?.clubIsVerified ?? false}
          logoUrl={center?.clubLogoUrl ?? null}
          name={center?.clubName ?? ""}
          onBack={confirmExit}
          onCancel={confirmExit}
          step="1 di 3 · Persona"
          title={INVITES_COPY.searchTitle}
        />
      </View>

      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[48] + spacing[40] + insets.bottom },
        ]}
        data={rows}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.profileId}
        ListHeaderComponent={
          <View>
            <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
              {INVITES_COPY.searchHelper}
            </AppText>

            <SearchField
              autoFocus
              onChangeText={setQuery}
              onClear={() => setQuery("")}
              placeholder={INVITES_COPY.searchPlaceholder}
              testID="invite-search-field"
              value={query}
            />

            {searching && resultsQuery.isLoading ? (
              <View style={styles.state}>
                <DashboardSkeleton />
              </View>
            ) : null}

            {resultsQuery.error ? (
              <View style={styles.state}>
                <DashboardModuleError
                  isRetrying={resultsQuery.isRefetching}
                  message={INVITES_COPY.searchError}
                  onRetry={() => void resultsQuery.refetch()}
                />
              </View>
            ) : null}

            {empty ? (
              <View style={styles.state}>
                {/* §18: nessuna persona dimostrativa, nessun fallback
                    tecnico, e nessuna CTA verso un percorso esterno che in
                    questa build non esiste (DAS-REV-20). */}
                <DashboardGlobalEmpty
                  copy={{
                    actionLabel: "",
                    body: INVITES_COPY.searchEmptyBody,
                    icon: "search-outline",
                    title: INVITES_COPY.searchEmpty,
                  }}
                  onAction={null}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ index, item }) => {
          const selected = draft.person?.profileId === item.profileId;

          return (
            <Pressable
              accessibilityLabel={`${item.fullName}, ${candidateMeta(item)}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => select(item)}
              style={({ pressed }) => [
                styles.row,
                index > 0 ? styles.divided : null,
                pressed ? styles.pressed : null,
              ]}
              testID={`invite-candidate-${item.profileId}`}
            >
              <Avatar
                name={item.fullName}
                size="md"
                uri={item.avatarUrl ?? undefined}
              />

              <View style={styles.body}>
                <AppText color="neutral" numberOfLines={1} style={styles.name} variant="titleSm">
                  {item.fullName}
                </AppText>
                <AppText color="neutralMuted" numberOfLines={1} variant="bodySm">
                  {candidateMeta(item)}
                </AppText>
              </View>

              {/* §5: il controllo selezionato è riconoscibile anche tramite
                  check, non dal solo colore. */}
              <Ionicons
                color={selected ? colors.accent : colors.borderNeutral}
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={24}
              />
            </Pressable>
          );
        }}
        testID="invite-search-results"
      />

      <View style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}>
        <Button
          disabled={!draft.person}
          fullWidth
          label={INVITES_COPY.continueLabel}
          onPress={goNext}
          size="md"
          testID="invite-search-continue"
          variant="primary"
        />
      </View>
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
    paddingHorizontal: spacing[20],
  },
  helper: {
    paddingBottom: spacing[12],
  },
  state: {
    paddingTop: spacing[24],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  name: {
    fontWeight: "600",
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
});
