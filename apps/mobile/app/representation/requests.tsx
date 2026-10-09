/**
 * SCREEN 8 — Richieste e inviti (REV-PROF-14).
 *
 * Richieste di collegamento e inviti sono cose diverse e restano separate:
 * una aspetta la risposta di un profilo che esiste, l'altro aspetta che un
 * profilo nasca. Mescolarle farebbe sembrare il portfolio più pieno di quanto
 * sia, ed è esattamente quello che i conteggi pubblici non devono fare.
 */
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../src/components/ui/screen";
import {
  AppText,
  Avatar,
  Button,
  ConfirmModal,
  EmptyState,
  ScreenHeader,
  TabBar,
  useToast,
} from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { cancelRequest } from "../../src/features/relationships/agent-representation-service";
import { trackAssistitiEvent } from "../../src/features/relationships/assistiti/assistiti-analytics";
import {
  describeAssistitiError,
  formatRelativeDay,
  getInviteChannelLabel,
  getInviteStatusLabel,
  isClosedRow,
  REQUESTS_TABS,
  type AssistitoRow,
  type RequestsTab,
} from "../../src/features/relationships/assistiti/assistiti-model";
import {
  assistitiQueryKeys,
  fetchAssistitiOverview,
  issueInvite,
  markInviteShared,
  revokeInvite,
} from "../../src/features/relationships/assistiti/assistiti-service";
import {
  buildAssistitoInviteUrl,
  copyInviteLink,
} from "../../src/features/relationships/assistiti/assistiti-invite-link";
import {
  AssistitiSkeleton,
  BackButton,
  InfoCallout,
  SectionError,
} from "../../src/features/relationships/assistiti/assistiti-ui";
import { colors, radius, spacing } from "../../src/theme/tokens";

type PendingConfirm =
  | { kind: "cancelRequest"; row: AssistitoRow }
  | { kind: "revokeInvite"; row: AssistitoRow }
  | { kind: "rotateInvite"; row: AssistitoRow };

export default function RequestsAndInvitesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const agentProfileId = profile?.id ?? "";

  const [tab, setTab] = useState<RequestsTab>("requests");
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const overviewQuery = useQuery({
    enabled: Boolean(agentProfileId),
    queryFn: () => fetchAssistitiOverview(agentProfileId),
    queryKey: assistitiQueryKeys.overview(agentProfileId),
  });

  const visibleRows = useMemo(() => {
    const rows = overviewQuery.data ?? [];

    if (tab === "requests") {
      return rows.filter(
        (row) => row.kind === "representation" && row.status === "pending",
      );
    }

    if (tab === "invites") {
      return rows.filter((row) => row.kind === "manual" && !isClosedRow(row));
    }

    /*
      Lambda esplicita: `isClosedRow` ha un secondo parametro opzionale
      (`now`), e passarla direttamente a `filter` le farebbe arrivare l'indice
      dell'elemento al posto della data.
    */
    return rows.filter((row) => isClosedRow(row));
  }, [overviewQuery.data, tab]);

  async function refresh() {
    if (!agentProfileId) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: assistitiQueryKeys.overview(agentProfileId),
    });
    await queryClient.invalidateQueries({
      queryKey: assistitiQueryKeys.counts(agentProfileId),
    });
  }

  async function handleConfirm() {
    if (!confirm) {
      return;
    }

    if (confirm.kind === "rotateInvite") {
      const { row } = confirm;

      setConfirm(null);
      await handleCopyLink(row);

      return;
    }

    setBusy(true);

    try {
      if (confirm.kind === "cancelRequest") {
        await cancelRequest(confirm.row.id);
        trackAssistitiEvent("assistiti_request_cancelled");
      } else if (confirm.row.invite_id) {
        await revokeInvite(confirm.row.invite_id);
        trackAssistitiEvent("assistiti_invite_revoked");
      }

      await refresh();
      setConfirm(null);
    } catch (error) {
      showToast({
        message: describeAssistitiError(
          error,
          confirm.kind === "cancelRequest"
            ? "Non è stato possibile annullare la richiesta. Riprova."
            : "Operazione non riuscita. Riprova.",
        ),
      });
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Copia link" rigenera il segreto, perché il token è salvato con hash e non
   * è più rileggibile dopo l'emissione. Rigenerarlo invalida però il link già
   * mandato su WhatsApp, quindi non può succedere in silenzio: chiediamo
   * conferma e lo diciamo esplicitamente (REV-PROF-14, "non generare un nuovo
   * token senza necessità").
   */
  function handleCopyLinkPress(row: AssistitoRow) {
    setConfirm({ kind: "rotateInvite", row });
  }

  async function handleCopyLink(row: AssistitoRow) {
    setBusyRowId(row.id);

    try {
      const issued = await issueInvite(row.id, { rotate: true });

      if (!issued.invite_token) {
        throw new Error("Non è stato possibile creare l'invito. Riprova.");
      }

      const copied = await copyInviteLink(
        buildAssistitoInviteUrl(issued.invite_token),
      );

      if (copied) {
        await markInviteShared(issued.invite_id, "copy_link");
        trackAssistitiEvent("assistiti_invite_link_copied");
        showToast({ message: "Link copiato.", tone: "success" });
        await refresh();
      }
    } catch (error) {
      showToast({
        message: describeAssistitiError(
          error,
          "Non è stato possibile creare l'invito. Riprova.",
        ),
      });
    } finally {
      setBusyRowId(null);
    }
  }

  function handleResend(row: AssistitoRow) {
    trackAssistitiEvent("assistiti_invite_resent");
    router.push(`/representation/invite/${row.id}` as never);
  }

  function emptyStateFor(current: RequestsTab) {
    if (current === "requests") {
      return {
        description: "Le richieste inviate compariranno qui.",
        title: "Nessuna richiesta in attesa",
      };
    }

    if (current === "invites") {
      return {
        description:
          "Gli inviti creati per i Calciatori non ancora registrati compariranno qui.",
        title: "Nessun invito attivo",
      };
    }

    return { description: undefined, title: "Nessun rapporto concluso" };
  }

  const empty = emptyStateFor(tab);

  return (
    <Screen>
      <ScreenHeader
        leading={<BackButton onPress={() => router.back()} />}
        title="Richieste e inviti"
      />

      <FlatList
        ListEmptyComponent={
          overviewQuery.isLoading || overviewQuery.isError ? null : (
            <EmptyState
              description={empty.description}
              icon="paper-plane-outline"
              title={empty.title}
            />
          )
        }
        ListFooterComponent={
          tab === "invites" && visibleRows.length > 0 ? (
            <InfoCallout testID="assistiti-reconcile-note">
              <AppText color="secondary" variant="bodySm">
                Quando il Calciatore si registra, potrai collegare il nuovo
                profilo senza duplicare l&apos;assistito.
              </AppText>
            </InfoCallout>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {/*
              Richieste/Inviti/Conclusi sono tab, non chip: cambiano la
              superficie sotto, non filtrano una lista. La regola del design
              system è netta — "Tabs are never buttons: TabBar only".
            */}
            <TabBar
              active={tab}
              items={REQUESTS_TABS}
              onChange={(value) => {
                setTab(value);
                trackAssistitiEvent("assistiti_requests_tab_changed", {
                  tab: value,
                });
              }}
              testID="assistiti-requests-tabs"
            />

            <AppText color="muted" variant="eyebrow">
              {tab === "requests"
                ? "Richieste in attesa"
                : tab === "invites"
                  ? "Inviti inviati"
                  : "Storico"}
            </AppText>

            {overviewQuery.isError ? (
              <SectionError
                message="Non è stato possibile caricare richieste e inviti."
                onRetry={() => void overviewQuery.refetch()}
              />
            ) : null}

            {overviewQuery.isLoading ? <AssistitiSkeleton rows={2} /> : null}
          </View>
        }
        contentContainerStyle={styles.listContent}
        data={overviewQuery.isLoading || overviewQuery.isError ? [] : visibleRows}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`assistiti-request-${item.id}`}>
            <Avatar name={item.full_name ?? "Assistito"} size="md" uri={item.avatar_url ?? undefined} />
            <View style={styles.cardBody}>
              <AppText numberOfLines={1} variant="titleSm">
                {item.full_name ?? "Assistito"}
              </AppText>
              <AppText color="muted" numberOfLines={1} variant="caption">
                {item.kind === "representation"
                  ? `Richiesta inviata • ${formatRelativeDay(item.created_at)}`
                  : `${getInviteChannelLabel(item.invite_channel)} • ${getInviteStatusLabel(item.invite_status)}${
                      item.invite_shared_at
                        ? ` • ${formatRelativeDay(item.invite_shared_at)}`
                        : ""
                    }`}
              </AppText>

              {tab === "closed" ? null : item.kind === "representation" ? (
                <Button
                  label="Annulla richiesta"
                  onPress={() => setConfirm({ kind: "cancelRequest", row: item })}
                  size="sm"
                  variant="outline"
                />
              ) : (
                <View style={styles.actions}>
                  {/*
                    Azione di riga, non la CTA della schermata: la primaria
                    qui è "Fine" nel footer, e averne una per ogni riga
                    toglieva all'utente il riferimento di cosa stia facendo
                    la pagina (§ design system, una primaria per schermata).
                  */}
                  <Button
                    label="Invia di nuovo"
                    onPress={() => handleResend(item)}
                    size="sm"
                    variant="outline"
                  />
                  <Button
                    label="Copia link"
                    loading={busyRowId === item.id}
                    onPress={() => handleCopyLinkPress(item)}
                    size="sm"
                    variant="outline"
                  />
                  <Button
                    label="Revoca"
                    onPress={() => setConfirm({ kind: "revokeInvite", row: item })}
                    size="sm"
                    variant="ghost"
                  />
                </View>
              )}
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Button fullWidth label="Fine" onPress={() => router.back()} />
      </View>

      <ConfirmModal
        cancelLabel={
          confirm?.kind === "cancelRequest"
            ? "Continua ad attendere"
            : "Annulla"
        }
        confirmLabel={
          confirm?.kind === "cancelRequest"
            ? "Annulla richiesta"
            : confirm?.kind === "rotateInvite"
              ? "Genera e copia"
              : "Revoca invito"
        }
        destructive={confirm?.kind !== "rotateInvite"}
        isBusy={isBusy}
        message={
          confirm?.kind === "cancelRequest"
            ? "Il Calciatore non potrà più accettare questa richiesta."
            : confirm?.kind === "rotateInvite"
              ? "Per motivi di sicurezza il link non è rileggibile: ne verrà generato uno nuovo e quello già condiviso smetterà di funzionare."
              : "Il link non potrà più essere utilizzato."
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleConfirm()}
        title={
          confirm?.kind === "cancelRequest"
            ? "Annullare la richiesta?"
            : confirm?.kind === "rotateInvite"
              ? "Generare un nuovo link?"
              : "Revocare questo invito?"
        }
        visible={confirm != null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  card: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  cardBody: {
    flex: 1,
    gap: spacing[8],
    minWidth: 0,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing[12],
  },
  header: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  listContent: {
    gap: spacing[8],
    paddingBottom: spacing[16],
  },
});
