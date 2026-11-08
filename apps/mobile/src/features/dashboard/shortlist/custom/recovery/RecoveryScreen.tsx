/**
 * Recupero amministrativo di una lista (DAS-REV-27 §19 — screen 12, 13).
 *
 * Superficie distinta dal dettaglio ordinario: Società, nome lista, ambito,
 * «Proprietario da riassegnare» e una CTA. Il read model non porta entry,
 * count, note, valutazioni o ACL (Q27-22), e questa schermata non chiama
 * nessuna lettura ordinaria della lista.
 *
 * Screen 13 è un secondo passo dello stesso componente: una radio per
 * candidato, nessuna preselezione (§19: «Non selezionare automaticamente il
 * Super Admin, il primo collaboratore o un utente casuale»), zero candidati
 * espliciti con uscita possibile. Il commit porta la versione osservata e
 * una chiave idempotente; il server rivalida owner ancora non valido,
 * versione e idoneità.
 *
 * Dopo il successo: se l'esecutore è il nuovo owner apre la lista (screen
 * 14); altrimenti torna alla superficie amministrativa con «Proprietario
 * aggiornato», senza dati di scouting (Q27-23).
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar, Button, useToast } from "../../../../../ui";
import { useSession } from "../../../../auth/use-session";
import { DashboardGlobalEmpty, DashboardGlobalError } from "../../../components/DashboardStates";
import { useDashboardIdentity } from "../../../identity/use-dashboard-identity";
import { useDashboardConnection } from "../../../state/use-dashboard-connection";
import { ShortlistSectionSkeleton } from "../../components/ShortlistSection";
import { useIntentKeys } from "../../profile/use-intent-key";
import { SHORTLIST_CROSS_PREFIXES, SHORTLIST_QK, SHORTLIST_QK_PREFIXES } from "../../shortlist-keys";
import { SHORTLIST_COPY } from "../../shortlist-presentation";
import { SHORTLIST_HREFS } from "../../shortlist-routes";
import { ShortlistError } from "../../shortlist-types";
import { ShortlistPersonRow } from "../components/ShortlistPersonRow";
import { CUSTOM_COPY, governanceErrorCopy, isRevocation } from "../custom-shortlist-presentation";
import {
  fetchOwnerCandidates,
  fetchShortlistRecovery,
  reassignShortlistOwner,
} from "../custom-shortlist-service";
import type { PeoplePage } from "../custom-shortlist-types";

export function RecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const { connection } = useDashboardConnection();
  const params = useLocalSearchParams<{ listId?: string }>();
  const shortlistId = typeof params.listId === "string" ? params.listId : "";
  const keys = useIntentKeys(`shortlist-owner:${shortlistId}`);

  const [step, setStep] = useState<"summary" | "choose">("summary");
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recoveryQuery = useQuery({
    enabled: !!actorId && !!shortlistId,
    queryFn: () => fetchShortlistRecovery(shortlistId),
    queryKey: SHORTLIST_QK.recovery(actorId, shortlistId),
    retry: (count, err) => !(err instanceof ShortlistError && err.kind !== "network") && count < 1,
    staleTime: 0,
  });

  const candidatesQuery = useInfiniteQuery<
    PeoplePage,
    Error,
    { pageParams: (string | null)[]; pages: PeoplePage[] },
    readonly unknown[],
    string | null
  >({
    enabled: step === "choose" && !!recoveryQuery.data,
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchOwnerCandidates(shortlistId, pageParam),
    queryKey: SHORTLIST_QK.ownerCandidates(actorId, shortlistId),
    retry: 1,
    staleTime: 0,
  });

  const recovery = recoveryQuery.data ?? null;
  const candidates = candidatesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const signature = JSON.stringify([choice, recovery?.version ?? 0]);

  const reassign = useMutation({
    mutationFn: () =>
      reassignShortlistOwner({
        expectedVersion: recovery?.version ?? 0,
        idempotencyKey: keys.key(signature),
        newOwnerId: choice ?? "",
        shortlistId,
      }),
    onError: (err) => {
      const kind = err instanceof ShortlistError ? err.kind : "network";

      if (kind !== "network") {
        keys.settle(signature);
      }

      if (isRevocation(kind) || kind === "ownerValid") {
        /* Q27-20: il proprietario è tornato valido, o la lista non è più
           recuperabile: si ricarica il contesto amministrativo. */
        queryClient.removeQueries({ queryKey: SHORTLIST_QK.recovery(actorId, shortlistId) });
        void queryClient.invalidateQueries({ queryKey: ["society-shortlist-recoverable"] });
        showToast({
          id: "shortlist-recovery-stale",
          message: kind === "ownerValid" ? CUSTOM_COPY.ownerReturned : SHORTLIST_COPY.unavailableBody,
        });
        router.replace(SHORTLIST_HREFS.recoveryList() as never);
        return;
      }

      if (kind === "versionConflict" || kind === "ownerIneligible") {
        setChoice(null);
        void recoveryQuery.refetch();
        void candidatesQuery.refetch();
      }

      setError(governanceErrorCopy(kind, "recovery", connection === "offline"));
    },
    onSuccess: (outcome) => {
      keys.settle(signature);

      for (const prefix of [...SHORTLIST_QK_PREFIXES, ...SHORTLIST_CROSS_PREFIXES]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      if (outcome.actorIsOwner) {
        router.replace(`${SHORTLIST_HREFS.customList(shortlistId)}?updated=owner` as never);
        return;
      }

      showToast({ id: "shortlist-owner-updated", message: CUSTOM_COPY.ownerUpdated });
      router.replace(SHORTLIST_HREFS.recoveryList() as never);
    },
  });

  const back = () => {
    if (step === "choose" && !reassign.isPending) {
      setStep("summary");
      setChoice(null);
      setError(null);
      return;
    }

    router.back();
  };

  const header = (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={back}
        style={styles.barAction}
        testID="recovery-back"
      >
        <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
      </Pressable>
      <AppText accessibilityRole="header" color="neutral" style={styles.barTitle} variant="titleMd">
        {step === "summary" ? CUSTOM_COPY.recoveryTitle : CUSTOM_COPY.assignNewOwner}
      </AppText>
      <View style={styles.barAction} />
    </View>
  );

  if (recoveryQuery.error instanceof ShortlistError && recoveryQuery.error.kind !== "network") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <DashboardGlobalEmpty
          copy={{
            actionLabel: SHORTLIST_COPY.backToDashboard,
            body: SHORTLIST_COPY.unavailableBody,
            icon: "document-lock-outline",
            title: SHORTLIST_COPY.unavailableTitle,
          }}
          onAction={() => router.replace(SHORTLIST_HREFS.center() as never)}
        />
      </View>
    );
  }

  if (!recovery) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        {recoveryQuery.isError ? (
          <DashboardGlobalError
            body={SHORTLIST_COPY.errorBody}
            onRetry={() => void recoveryQuery.refetch()}
            title={CUSTOM_COPY.recoveryTitle}
          />
        ) : (
          <ShortlistSectionSkeleton rows={3} />
        )}
      </View>
    );
  }

  const listBlock = (
    <View style={styles.listBlock}>
      <Avatar name={current?.name ?? ""} size="md" square tone="ink" uri={current?.avatarUrl ?? undefined} />
      <View style={styles.flex}>
        {step === "summary" ? (
          <View style={styles.societyName}>
            <AppText color="neutral" style={styles.strong} variant="bodySm">
              {current?.name ?? ""}
            </AppText>
            {current?.isVerified ? (
              <Ionicons accessibilityLabel="Società verificata" color={colors.accent} name="checkmark-circle" size={14} />
            ) : null}
          </View>
        ) : null}
        <AppText color="neutral" numberOfLines={2} style={styles.strong} testID="recovery-list-name" variant="bodyLg">
          {recovery.name}
        </AppText>
        <AppText color="neutralMuted" variant="meta">
          {recovery.scopeLabel}
        </AppText>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}

      {step === "summary" ? (
        <>
          <ScrollView contentContainerStyle={styles.body} testID="recovery-summary">
            {listBlock}
            <View style={styles.ownerLine}>
              <Ionicons color={colors.textNeutralMuted} name="person-outline" size={14} />
              <AppText color="neutralMuted" variant="meta">
                {CUSTOM_COPY.ownerToReassign}
              </AppText>
            </View>
            <AppText color="neutralMuted" variant="bodySm">
              {CUSTOM_COPY.ownerInvalidBody}
            </AppText>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: spacing[12] + insets.bottom }]}>
            <Button
              fullWidth
              label={CUSTOM_COPY.assignNewOwner}
              onPress={() => setStep("choose")}
              size="lg"
              testID="recovery-assign"
              variant="primary"
            />
          </View>
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.body} testID="recovery-choose">
            <AppText color="neutralMuted" variant="bodySm">
              {CUSTOM_COPY.chooseOwnerHelper}
            </AppText>
            {listBlock}

            {candidatesQuery.isLoading ? (
              <ShortlistSectionSkeleton rows={2} />
            ) : candidatesQuery.isError && candidates.length === 0 ? (
              <View style={styles.state}>
                <AppText color="neutral" variant="bodySm">
                  {CUSTOM_COPY.peopleLoadError}
                </AppText>
                <Button label="Riprova" onPress={() => void candidatesQuery.refetch()} size="sm" variant="secondary" />
              </View>
            ) : candidates.length === 0 ? (
              <View style={styles.state} testID="recovery-no-candidates">
                <AppText color="neutral" variant="bodySm">
                  {CUSTOM_COPY.noPeopleTitle}
                </AppText>
                <AppText color="neutralMuted" variant="meta">
                  {CUSTOM_COPY.noOwnerCandidatesBody}
                </AppText>
              </View>
            ) : (
              <View accessibilityRole="radiogroup">
                {candidates.map((person, index) => (
                  <ShortlistPersonRow
                    control="radio"
                    disabled={reassign.isPending}
                    key={person.profileId}
                    onPress={() => {
                      setChoice(person.profileId);
                      setError(null);
                    }}
                    person={person}
                    selected={choice === person.profileId}
                    showDivider={index > 0}
                    testID={`recovery-candidate-${person.profileId}`}
                  />
                ))}
                {candidatesQuery.hasNextPage ? (
                  <Button
                    label="Mostra altre persone"
                    loading={candidatesQuery.isFetchingNextPage}
                    onPress={() => void candidatesQuery.fetchNextPage()}
                    size="sm"
                    variant="link"
                  />
                ) : null}
              </View>
            )}

            {error ? (
              <View accessibilityLiveRegion="polite" style={styles.error} testID="recovery-error">
                <AppText color="danger" variant="meta">
                  {error}
                </AppText>
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: spacing[12] + insets.bottom }]}>
            <Button
              disabled={!choice || reassign.isPending}
              fullWidth
              label={CUSTOM_COPY.assignOwner}
              loading={reassign.isPending}
              onPress={() => {
                setError(null);
                reassign.mutate();
              }}
              size="lg"
              testID="recovery-confirm"
              variant="primary"
            />
          </View>
        </>
      )}
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
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  barTitle: {
    flex: 1,
    textAlign: "center",
  },
  body: {
    gap: spacing[16],
    paddingVertical: spacing[16],
  },
  listBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  societyName: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  flex: {
    flex: 1,
    gap: spacing[4],
  },
  strong: {
    fontWeight: "600",
  },
  ownerLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[6],
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  footer: {
    paddingTop: spacing[12],
  },
});
