/**
 * Scheda interna «Profilo in shortlist» (DAS-REV-25 §15 — screen 05, 08,
 * 14, 15).
 *
 * «Mostra una scheda interna nel contesto Society, distinta dal profilo
 * pubblico.» È la destinazione che la 24 aveva lasciato al profilo pubblico
 * come ripiego e che §3 della 25 chiude: «Il tap della riga del pool apre
 * ora Profilo in shortlist … Non utilizzare più il profilo pubblico come
 * fallback ordinario di quel tap.»
 *
 * Tiene insieme due cose che §15 vuole **distinte**: i dati pubblici della
 * persona, che sono live e vengono dal profilo canonico, e i dati privati
 * della membership — valutazione, nota, origine, autore — che appartengono
 * a questa lista e a nessun'altra.
 *
 * Le azioni non autorizzate non si disabilitano, spariscono (§8). In sola
 * lettura resta il solo «Apri profilo completo», che diventa la primaria:
 * §4 — «In sola lettura, quando è l'unica azione principale, Apri profilo
 * completo è blu piena.»
 */
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { formatRole } from "../../profiles/profile-display-helpers";
import { getPlayerPositionLabel } from "../../profiles/player-sports";
import { APPLICATIONS_HREFS } from "../applications/applications-routes";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { formatShortDate } from "../personal/saved-positions-presentation";
import { useOperationKey } from "../roles/use-operation-key";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { ShortlistEntryIdentity } from "./components/ShortlistEntryIdentity";
import { ShortlistEvaluationEditor } from "./components/ShortlistEvaluationEditor";
import { ShortlistRemoveConfirm } from "./components/ShortlistRemoveConfirm";
import { ShortlistSectionSkeleton } from "./components/ShortlistSection";
import { SHORTLIST_QK, SHORTLIST_CROSS_PREFIXES } from "./shortlist-keys";
import {
  EVALUATION_LABELS,
  SHORTLIST_COPY,
  addedByLine,
  evaluationLine,
  originAuditLabel,
  priorityLabel,
  removeErrorCopy,
  saveErrorCopy,
} from "./shortlist-presentation";
import {
  fetchShortlistEntry,
  removeShortlistEntry,
  saveShortlistEvaluation,
} from "./shortlist-service";
import {
  ShortlistError,
  type ShortlistEvaluationPatch,
} from "./shortlist-types";

type Props = {
  entryId: string;
};

export function ShortlistEntryScreen({ entryId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const { connection } = useDashboardConnection();

  const [editorOpen, setEditorOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const entryQuery = useQuery({
    enabled: !!actorId && !!entryId,
    queryFn: () => fetchShortlistEntry({ entryId }),
    queryKey: SHORTLIST_QK.entry(actorId, entryId),
    retry: (failureCount, error) =>
      !(error instanceof ShortlistError && error.kind !== "network") &&
      failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const entry = entryQuery.data ?? null;

  /* §27: «Rimozione → Pool/count, entry non più apribile, row Position,
     centro, Application e stella.» Una sola funzione, perché le due
     mutazioni toccano lo stesso insieme. */
  const reconcile = useCallback(() => {
    for (const prefix of [
      "society-shortlist-pool",
      "society-shortlist-context",
      "society-shortlist-position-group",
      "society-shortlist-custom-group",
      "society-shortlist-entry",
      "society-shortlist-application-entry",
      "society-shortlist-membership",
      ...SHORTLIST_CROSS_PREFIXES,
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }, [queryClient]);

  /* §19: la chiave idempotente segue il **contenuto** e la revisione attesa.
     Un retry dello stesso tentativo è la stessa operazione; un tentativo
     con valori diversi è un'operazione nuova, e il server la distingue. */
  const saveKey = useOperationKey(
    `shortlist-evaluate:${entryId}:${entry?.revision ?? 0}`,
  );
  const removeKey = useOperationKey(`shortlist-remove:${entryId}`);

  const save = useMutation({
    mutationFn: (patch: ShortlistEvaluationPatch) =>
      saveShortlistEvaluation(
        entryId,
        patch,
        entry?.revision ?? 0,
        saveKey(),
      ),
    onError: (error) => {
      /* §19: «preserva draft e contesto». L'editor resta aperto con il
         testo dentro; cambia solo il messaggio. */
      setSaveError(
        saveErrorCopy(
          error instanceof ShortlistError ? error.kind : "network",
        ),
      );
    },
    onSuccess: () => {
      setSaveError(null);
      setEditorOpen(false);
      reconcile();
      /* §19: «Conferma Valutazione aggiornata.» §4: feedback discreto, non
         un badge verde permanente. */
      showToast({
        id: "shortlist-evaluation-saved",
        message: SHORTLIST_COPY.saveDone,
      });
    },
  });

  const remove = useMutation({
    mutationFn: () => removeShortlistEntry(entryId, removeKey()),
    onError: (error) => {
      setRemoveOpen(false);
      showToast({
        id: "shortlist-remove-error",
        icon: "alert-circle-outline",
        message: removeErrorCopy(
          error instanceof ShortlistError ? error.kind : "network",
        ),
      });

      /* §26: una entry già rimossa altrove non è un guasto: si riconcilia e
         si torna a una destinazione lecita. */
      if (error instanceof ShortlistError && error.kind === "gone") {
        reconcile();
        router.back();
      }
    },
    onSuccess: () => {
      setRemoveOpen(false);
      reconcile();
      showToast({
        id: "shortlist-removed",
        message: SHORTLIST_COPY.removeDone,
      });
      /* §21: «dal dettaglio entry torna al pool conservando i filtri.» Il
         back nativo lo fa: il pool è ancora nello stack con il suo stato. */
      router.back();
    },
  });

  const header = (title: string | null) => (
    <SocietyContextHeader
      isVerified={current?.isVerified ?? false}
      logoUrl={current?.avatarUrl ?? null}
      name={current?.name ?? ""}
      onBack={() => router.back()}
      title={title}
    />
  );

  const shell = (children: React.ReactNode, title: string | null = null) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header(title)}
      {children}
    </View>
  );

  if (entryQuery.error instanceof ShortlistError &&
      entryQuery.error.kind !== "network") {
    /* §28: «Questo profilo non è più presente nella shortlist.» soltanto
       quando il motivo è noto e divulgabile; per tutto il resto il
       contenuto non disponibile, che non rivela risorse altrui. */
    const gone = entryQuery.error.kind === "gone";

    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: gone ? SHORTLIST_COPY.entryGone : SHORTLIST_COPY.unavailableBody,
          icon: gone ? "star-outline" : "lock-closed-outline",
          title: gone
            ? SHORTLIST_COPY.poolEmptyTitle
            : SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  if (entryQuery.isError) {
    return shell(
      <DashboardGlobalError
        body={SHORTLIST_COPY.entryErrorBody}
        onRetry={() => void entryQuery.refetch()}
        title={SHORTLIST_COPY.poolErrorTitle}
      />,
    );
  }

  if (!entry) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={SHORTLIST_COPY.poolOfflineBody}
          onRetry={() => void entryQuery.refetch()}
        />,
      );
    }

    return shell(
      <View style={styles.content}>
        <ShortlistSectionSkeleton rows={3} />
      </View>,
    );
  }

  const identity = [
    entry.role ? formatRole(entry.role) : null,
    entry.primaryPosition
      ? getPlayerPositionLabel(entry.primaryPosition, "")
      : null,
  ]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  const context = [entry.positionTitle, entry.scopeLabel]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  const canEdit = entry.canEditStatus || entry.canEditNote;
  const origin = originAuditLabel(entry.createdSource);
  const added = addedByLine({
    addedByName: entry.addedByName,
    createdAtLabel: formatShortDate(entry.createdAt),
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header(SHORTLIST_COPY.entryTitle)}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            onRefresh={() => void entryQuery.refetch()}
            refreshing={entryQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="shortlist-entry-scroll"
      >
        <ShortlistEntryIdentity
          avatarUrl={entry.avatarUrl}
          identity={identity}
          name={entry.name}
          situation={entry.situation}
        />

        {/* §15.2: «In shortlist per: Position e Team/scope.» */}
        <View style={styles.block}>
          <AppText variant="eyebrow">
            {SHORTLIST_COPY.entryInShortlistFor}
          </AppText>

          <AppText color="neutral" variant="bodyLg">
            {context}
          </AppText>
        </View>

        {/* §15.3: priorità e stato leggibili. §15 — «Priorità null può usare
            un trattino neutro senza avviso di errore.» */}
        <View style={styles.block}>
          <AppText variant="eyebrow">{SHORTLIST_COPY.entryEvaluation}</AppText>

          <View style={styles.pair}>
            <AppText color="neutralMuted" style={styles.pairLabel} variant="meta">
              {SHORTLIST_COPY.entryPriority}
            </AppText>

            <AppText color="neutral" variant="bodySm">
              {priorityLabel(entry.priority) ?? "—"}
            </AppText>
          </View>

          <View style={styles.pair}>
            <AppText color="neutralMuted" style={styles.pairLabel} variant="meta">
              {SHORTLIST_COPY.entryStatus}
            </AppText>

            <AppText
              accessibilityLabel={evaluationLine(entry)}
              color="neutral"
              variant="bodySm"
            >
              {EVALUATION_LABELS[entry.evaluationStatus]}
            </AppText>
          </View>
        </View>

        {/* §15.4: il testo **completo**, con le interruzioni di riga. Senza
            lettura nota il blocco non esiste: §12 — «Senza lettura note
            ometti testo, snippet, tooltip e attributi accessibili.» */}
        {entry.canViewNotes ? (
          <View style={styles.block}>
            <AppText variant="eyebrow">{SHORTLIST_COPY.entryNote}</AppText>

            <AppText
              color={entry.note ? "neutral" : "neutralMuted"}
              variant="bodySm"
            >
              {entry.note ?? SHORTLIST_COPY.entryNoteEmpty}
            </AppText>

            <AppText color="neutralMuted" variant="meta">
              {SHORTLIST_COPY.entryNoteHelper}
            </AppText>
          </View>
        ) : null}

        {/* §15.5 e §16: l'origine storica, poi il collegamento attuale, poi
            l'audit di aggiunta. Tre informazioni distinte, nessuna dedotta
            dalle altre. */}
        {origin || entry.applicationId || added ? (
          <View style={styles.block}>
            <AppText variant="eyebrow">{SHORTLIST_COPY.entryOrigin}</AppText>

            {origin ? (
              <AppText color="neutral" variant="bodySm">
                {origin}
              </AppText>
            ) : null}

            {entry.applicationId ? (
              <AppText
                accessibilityHint="Apre il dettaglio della candidatura"
                accessibilityRole="link"
                color="accent"
                onPress={() =>
                  router.push(
                    APPLICATIONS_HREFS.detail(
                      entry.applicationId as string,
                    ) as never,
                  )
                }
                style={styles.link}
                testID="shortlist-entry-application"
                variant="bodySm"
              >
                {SHORTLIST_COPY.entryViewApplication}
              </AppText>
            ) : null}

            {/* §16: «se WITHDRAWN, mostra la label neutra Candidatura
                ritirata». Neutra: non è un esito negativo della
                valutazione. */}
            {entry.applicationState === "withdrawn" ? (
              <AppText color="neutralMuted" variant="bodySm">
                {SHORTLIST_COPY.entryApplicationWithdrawn}
              </AppText>
            ) : null}

            {added ? (
              <AppText color="neutralMuted" variant="meta">
                {added}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {/* §15.7: azioni effettive, nell'ordine del PNG. */}
        <View style={styles.actions}>
          {canEdit ? (
            <Button
              fullWidth
              label={SHORTLIST_COPY.entryEdit}
              onPress={() => {
                setSaveError(null);
                setEditorOpen(true);
              }}
              size="lg"
              testID="shortlist-entry-edit"
              variant="primary"
            />
          ) : null}

          <Button
            fullWidth
            label={SHORTLIST_COPY.entryOpenProfile}
            onPress={() =>
              router.push(
                `/profile/${encodeURIComponent(entry.personId)}` as never,
              )
            }
            size="lg"
            testID="shortlist-entry-profile"
            /* §4: secondaria accanto a «Modifica valutazione»; primaria blu
               piena quando è l'unica azione principale (screen 15). */
            variant={canEdit ? "secondary" : "primary"}
          />

          {entry.canRemove ? (
            <Button
              destructive
              fullWidth
              label={SHORTLIST_COPY.entryRemove}
              onPress={() => setRemoveOpen(true)}
              size="lg"
              testID="shortlist-entry-remove"
              variant="link"
            />
          ) : null}
        </View>
      </ScrollView>

      <ShortlistEvaluationEditor
        busy={save.isPending}
        entry={entry}
        error={saveError}
        onClose={() => {
          setSaveError(null);
          setEditorOpen(false);
        }}
        onSave={(patch) => save.mutate(patch)}
        visible={editorOpen}
      />

      <ShortlistRemoveConfirm
        busy={remove.isPending}
        name={entry.name}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => remove.mutate()}
        positionTitle={entry.positionTitle}
        scopeLabel={entry.scopeLabel}
        visible={removeOpen}
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
  content: {
    gap: spacing[24],
  },
  block: {
    gap: spacing[4],
  },
  pair: {
    flexDirection: "row",
    gap: spacing[12],
  },
  pairLabel: {
    width: 76,
  },
  link: {
    paddingVertical: spacing[4],
  },
  actions: {
    gap: spacing[8],
    paddingTop: spacing[8],
  },
});
