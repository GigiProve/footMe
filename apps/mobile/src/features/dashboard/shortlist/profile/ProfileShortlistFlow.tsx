/**
 * Flusso della stella Shortlist sul profilo (DAS-REV-26 — screen 02-16).
 *
 * Un **coordinatore unico** per selector, riepilogo, azioni e recupero: §22
 * — «Gli sheet usano un coordinatore unico o uno stack equivalente
 * controllato … Non accumulare pannelli sovrapposti identici a ogni add.»
 * Le quattro viste sono passi dello stesso pannello, non quattro Modal; i
 * due form focalizzati — Nuova lista e Modifica valutazione — sono modali a
 * schermo intero sopra il profilo, senza bottom navigation (§4).
 *
 * Ritorni (§22):
 *
 *   · ☆ → selector; ★ → riepilogo;
 *   · riga del riepilogo → azioni; back → riepilogo; X → profilo;
 *   · Aggiungi ad altra lista → selector; back → riepilogo;
 *   · add riuscito → riepilogo con la entry confermata;
 *   · Crea e aggiungi riuscito → riepilogo con la nuova lista;
 *   · Annulla del form → selector, con lo scroll recuperato;
 *   · Salva valutazione → riepilogo; Annulla senza modifiche → azioni;
 *   · rimozione parziale → riepilogo; ultima rimozione → profilo;
 *   · Vedi nella shortlist / Apri lista → route canoniche, e al ritorno sul
 *     profilo il pannello riprende dov'era.
 *
 * Il pannello sotto un form si nasconde prima che il form si apra, e il
 * form si apre soltanto a pannello chiuso: due Modal RN in transizione
 * contemporanea sono il guasto noto di iOS che `AddToShortlistFlow` (RET-07)
 * aveva già documentato. Lo stesso handoff qui.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  InteractionManager,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";

import { BottomSheet, ConfirmModal, useToast } from "../../../../ui";
import { CreateListModal } from "../../../shortlist/components/CreateListModal";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { ShortlistEvaluationEditor } from "../components/ShortlistEvaluationEditor";
import { SHORTLIST_CROSS_PREFIXES, SHORTLIST_QK, SHORTLIST_QK_PREFIXES } from "../shortlist-keys";
import { saveErrorCopy } from "../shortlist-presentation";
import { SHORTLIST_HREFS } from "../shortlist-routes";
import { fetchShortlistEntry, removeShortlistEntry, saveShortlistEvaluation } from "../shortlist-service";
import {
  ShortlistError,
  type ShortlistEntryDetail,
  type ShortlistErrorKind,
  type ShortlistEvaluationPatch,
} from "../shortlist-types";
import { FlowSheetHeader } from "./components/FlowSheetHeader";
import { ProfileShortlistActions } from "./components/ProfileShortlistActions";
import { ProfileShortlistRecovery } from "./components/ProfileShortlistRecovery";
import { ProfileShortlistSelector, destinationKey } from "./components/ProfileShortlistSelector";
import { ProfileShortlistSummary } from "./components/ProfileShortlistSummary";
import {
  PROFILE_SHORTLIST_COPY,
  addFailureCopy,
  afterRemove,
  isDefinitiveFailure,
  membershipLines,
  removeBody,
  summaryTitle,
} from "./profile-shortlist-presentation";
import {
  addProfileToShortlist,
  fetchProfileShortlistDestinations,
  fetchProfileShortlistMemberships,
} from "./profile-shortlist-service";
import type {
  CustomCreateOutcome,
  ProfileDestination,
  ProfileDestinationGroup,
  ProfileMembership,
  ProfileShortlistPerson,
  ProfileShortlistSociety,
} from "./profile-shortlist-types";
import { useIntentKeys } from "./use-intent-key";

export type ProfileShortlistStep = "selector" | "summary" | "actions" | "recovery";

type Recovery = { name: string; scopeLabel: string; shortlistId: string };

type Props = {
  actorId: string;
  initialStep: "selector" | "summary";
  onClose: () => void;
  open: boolean;
  person: ProfileShortlistPerson;
  society: ProfileShortlistSociety;
};

function kindOf(error: unknown): ShortlistErrorKind {
  return error instanceof ShortlistError ? error.kind : "network";
}

export function ProfileShortlistFlow({
  actorId,
  initialStep,
  onClose,
  open,
  person,
  society,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { reportFailure, reportSuccess } = useDashboardConnection();
  const { height } = useWindowDimensions();
  const keys = useIntentKeys(`profile-shortlist:${society.id}:${person.id}`);

  const [step, setStep] = useState<ProfileShortlistStep>(initialStep);
  const [selectorFromSummary, setSelectorFromSummary] = useState(false);
  const [selected, setSelected] = useState<ProfileMembership | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  /* Il pannello si nasconde sotto un form focalizzato o una route esterna. */
  const [sheetHidden, setSheetHidden] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editorEntry, setEditorEntry] = useState<ShortlistEntryDetail | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [awayOnRoute, setAwayOnRoute] = useState(false);
  const pendingHandoff = useRef<(() => void) | null>(null);
  const awayRef = useRef(false);
  const selectorScroll = useRef(0);
  /* Offset da ripristinare quando il selector torna dopo il form (§22). Uno
     stato e non il ref: il render non legge ref. */
  const [selectorOffset, setSelectorOffset] = useState(0);

  /* Ogni apertura riparte dal passo che la stella chiede: ☆ → selector,
     ★ → riepilogo (§9). Nessun residuo del flusso precedente. */
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setSelectorFromSummary(false);
      setSelected(null);
      setRemoveOpen(false);
      setRecovery(null);
      setPendingKey(null);
      setSheetHidden(false);
      setCreateOpen(false);
      setEditorOpen(false);
      setEditorEntry(null);
      setAwayOnRoute(false);
      awayRef.current = false;
      selectorScroll.current = 0;
      setSelectorOffset(0);
    }
    // initialStep is read only when the flow opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* §22: «Il ritorno dal pool al profilo ripristina la membership
     selezionata o il riepilogo ancora valido.» Al focus il pannello torna,
     e le letture si rifanno: la entry può non esistere più. */
  /* `useCallback` qui non è un'ottimizzazione: `useFocusEffect` riesegue
     l'effetto a ogni nuova identità della callback, e senza una callback
     stabile il ritorno scatterebbe prima ancora di lasciare il profilo. */
  useFocusEffect(
    useCallback(() => {
      if (awayRef.current) {
        awayRef.current = false;
        setAwayOnRoute(false);
        setSheetHidden(false);
        void queryClient.invalidateQueries({
          queryKey: ["society-shortlist-profile-memberships"],
        });
      }
    }, [queryClient]),
  );

  const sheetActive = open && !sheetHidden && !awayOnRoute;

  const membershipsQuery = useQuery({
    enabled: open && !!actorId && (step === "summary" || step === "actions"),
    queryFn: () => fetchProfileShortlistMemberships(society.id, person.id),
    queryKey: SHORTLIST_QK.profileMemberships(actorId, society.id, person.id),
  });

  const destinationsQuery = (group: ProfileDestinationGroup) => ({
    enabled: open && !!actorId && step === "selector",
    getNextPageParam: (page: { nextCursor: string | null }) => page.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchProfileShortlistDestinations(society.id, person.id, group, pageParam),
    queryKey: SHORTLIST_QK.profileDestinations(actorId, society.id, person.id, group),
  });

  const positionQuery = useInfiniteQuery(destinationsQuery("position"));
  const customQuery = useInfiniteQuery(destinationsQuery("custom"));

  /* Se la entry aperta nella subview non c'è più — rimossa altrove, accesso
     revocato — le azioni non valide spariscono e si torna al riepilogo
     (§15: «Un vecchio pannello non deve colpire una nuova generazione»). */
  useEffect(() => {
    if (step !== "actions" || !selected || !membershipsQuery.data) {
      return;
    }

    const fresh = membershipsQuery.data.items.find((item) => item.entryId === selected.entryId);

    if (!fresh) {
      setSelected(null);
      setStep("summary");
    } else if (fresh !== selected) {
      setSelected(fresh);
    }
  }, [membershipsQuery.data, selected, step]);

  const reconcile = () => {
    for (const prefix of [...SHORTLIST_QK_PREFIXES, ...SHORTLIST_CROSS_PREFIXES]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };

  const failureToast = (error: unknown, copy: string) => {
    const category = reportFailure(error);
    showToast({
      icon: "alert-circle-outline",
      id: "profile-shortlist-error",
      message: category === "offline" ? PROFILE_SHORTLIST_COPY.offlineMutation : copy,
    });
  };

  /* ---------- handoff pannello → modale a schermo intero ---------- */

  const runHandoff = () => {
    const next = pendingHandoff.current;
    pendingHandoff.current = null;
    next?.();
  };

  const handoff = (next: () => void) => {
    pendingHandoff.current = next;
    setSelectorOffset(selectorScroll.current);
    setSheetHidden(true);

    /* iOS consegna `onDismiss` del Modal; Android e web no in modo
       affidabile. L'esecuzione è idempotente, quindi i due percorsi possono
       correre. */
    if (Platform.OS !== "ios") {
      void InteractionManager.runAfterInteractions(runHandoff);
    }
  };

  /* ---------------------------- add (§13) ---------------------------- */

  const add = useMutation({
    mutationFn: (row: ProfileDestination) =>
      addProfileToShortlist({
        clubId: society.id,
        idempotencyKey: keys.key(`add:${destinationKey(row)}`),
        personId: person.id,
        target:
          row.kind === "position" && row.positionId
            ? { positionId: row.positionId }
            : { shortlistId: row.shortlistId ?? "" },
      }),
    onError: (error, row) => {
      const kind = kindOf(error);

      if (isDefinitiveFailure(kind)) {
        keys.settle(`add:${destinationKey(row)}`);
      }

      setPendingKey(null);
      failureToast(error, addFailureCopy(kind));

      /* §27: «Destinazione non più disponibile: … Aggiorna le destinazioni e
         le azioni.» */
      if (kind === "notFound" || kind === "notAuthorized" || kind === "gone") {
        void positionQuery.refetch();
        void customQuery.refetch();
      }
    },
    onMutate: (row) => setPendingKey(destinationKey(row)),
    onSuccess: (outcome, row) => {
      keys.settle(`add:${destinationKey(row)}`);
      reportSuccess();
      setPendingKey(null);
      reconcile();

      if (outcome.removedSince) {
        /* La ricevuta apparteneva a una membership poi rimossa: il server
           non l'ha ricreata, e non si dichiara un successo che non c'è. */
        showToast({ id: "profile-shortlist-error", message: PROFILE_SHORTLIST_COPY.addError });
        return;
      }

      /* §14: «Solo dopo conferma del commit aggiorna ☆→★ e trasforma il
         selector nel riepilogo.» Nessuna success page. */
      setSelectorFromSummary(false);
      setStep("summary");
    },
  });

  /* ---------------------------- remove (§21) ---------------------------- */

  const remove = useMutation({
    mutationFn: (row: ProfileMembership) =>
      removeShortlistEntry(row.entryId, keys.key(`remove:${row.entryId}`)),
    onError: (error, row) => {
      const kind = kindOf(error);

      if (isDefinitiveFailure(kind)) {
        keys.settle(`remove:${row.entryId}`);
      }

      setRemoveOpen(false);
      failureToast(
        error,
        kind === "gone" ? PROFILE_SHORTLIST_COPY.unavailable : PROFILE_SHORTLIST_COPY.removeError,
      );

      if (kind === "gone" || kind === "notFound") {
        reconcile();
        setSelected(null);
        setStep("summary");
      }
    },
    onSuccess: (outcome, row) => {
      keys.settle(`remove:${row.entryId}`);
      reportSuccess();
      setRemoveOpen(false);
      setSelected(null);
      reconcile();
      showToast({ id: "profile-shortlist-removed", message: PROFILE_SHORTLIST_COPY.removeDone });

      /* §21: la destinazione la decide l'esito del comando, non un refresh. */
      if (afterRemove(outcome.inAnyList) === "summary") {
        setStep("summary");
      } else {
        onClose();
      }
    },
  });

  /* ---------------------------- editor (§20) ---------------------------- */

  const openEditor = async (row: ProfileMembership) => {
    try {
      const entry = await queryClient.fetchQuery({
        queryFn: () => fetchShortlistEntry({ entryId: row.entryId }),
        queryKey: SHORTLIST_QK.entry(actorId, row.entryId),
      });

      setEditorError(null);
      setEditorEntry(entry);
      setEditorRevision(entry.revision);
      handoff(() => setEditorOpen(true));
    } catch (error) {
      failureToast(error, PROFILE_SHORTLIST_COPY.saveError);

      if (kindOf(error) === "gone") {
        reconcile();
        setSelected(null);
        setStep("summary");
      }
    }
  };

  const save = useMutation({
    mutationFn: (patch: ShortlistEvaluationPatch) => {
      const entryId = editorEntry?.entryId ?? "";
      return saveShortlistEvaluation(
        entryId,
        patch,
        editorRevision,
        keys.key(`eval:${entryId}:${editorRevision}:${JSON.stringify(patch)}`),
      );
    },
    onError: async (error, patch) => {
      const kind = kindOf(error);
      const entryId = editorEntry?.entryId ?? "";

      if (isDefinitiveFailure(kind)) {
        keys.settle(`eval:${entryId}:${editorRevision}:${JSON.stringify(patch)}`);
      }

      setEditorError(saveErrorCopy(kind));

      /* §20: «Un conflitto di versione non sovrascrive silenziosamente la
         valutazione di un altro utente. Conserva il draft, recupera i
         valori correnti …» Il draft resta nell'editor (l'`entry` passato
         non cambia, quindi non si azzera); la revisione attesa diventa
         quella corrente, così il prossimo Salva è una scelta esplicita
         sulla versione aggiornata. */
      if (kind === "conflict" && entryId) {
        try {
          const latest = await fetchShortlistEntry({ entryId });
          setEditorRevision(latest.revision);
          queryClient.setQueryData(SHORTLIST_QK.entry(actorId, entryId), latest);
        } catch {
          /* La copy del conflitto resta; il prossimo tentativo rilegge. */
        }
      }
    },
    onSuccess: (_outcome, patch) => {
      const entryId = editorEntry?.entryId ?? "";
      keys.settle(`eval:${entryId}:${editorRevision}:${JSON.stringify(patch)}`);
      reportSuccess();
      setEditorError(null);
      setEditorOpen(false);
      setEditorEntry(null);
      setSelected(null);
      reconcile();
      /* §20: «dopo Salva torna allo stesso profilo con il riepilogo delle
         membership aggiornato … Feedback Valutazione aggiornata.» */
      setStep("summary");
      setSheetHidden(false);
      showToast({ id: "profile-shortlist-saved", message: PROFILE_SHORTLIST_COPY.evaluationDone });
    },
  });

  /* ---------------------- create + add (§16-§19) ---------------------- */

  const onCreateOutcome = (outcome: CustomCreateOutcome) => {
    setCreateOpen(false);
    setSheetHidden(false);
    setSelectorFromSummary(false);

    if (outcome.entryActive) {
      setStep("summary");
      return;
    }

    /* Lista confermata, membership iniziale non attiva: screen 16. */
    setRecovery({
      name: outcome.name,
      scopeLabel: outcome.scopeLabel,
      shortlistId: outcome.shortlistId,
    });
    setStep("recovery");
  };

  const retryAdd = useMutation({
    mutationFn: (target: Recovery) =>
      addProfileToShortlist({
        clubId: society.id,
        idempotencyKey: keys.key(`add:c:${target.shortlistId}`),
        personId: person.id,
        target: { shortlistId: target.shortlistId },
      }),
    onError: (error, target) => {
      const kind = kindOf(error);

      if (isDefinitiveFailure(kind)) {
        keys.settle(`add:c:${target.shortlistId}`);
      }

      failureToast(error, addFailureCopy(kind));

      /* §19: «Se la lista è stata eliminata o l'accesso revocato durante il
         recupero, non ricrearla automaticamente. Chiudi i controlli non
         leciti e torna al profilo/riepilogo con feedback generico.» */
      if (kind === "notFound" || kind === "notAuthorized" || kind === "gone") {
        reconcile();
        onClose();
      }
    },
    onSuccess: (_outcome, target) => {
      keys.settle(`add:c:${target.shortlistId}`);
      reportSuccess();
      reconcile();
      setRecovery(null);
      setStep("summary");
    },
  });

  /* ------------------------------ route ------------------------------ */

  const goTo = (href: string) => {
    awayRef.current = true;
    setAwayOnRoute(true);
    router.push(href as never);
  };

  const seeInShortlist = (row: ProfileMembership) => {
    /* §22: «Vedi nella shortlist riusa la route POSITION o CUSTOM già
       esistente», con il focus della 25 sulla entry per le Position. */
    if (row.kind === "position" && row.positionId) {
      goTo(SHORTLIST_HREFS.positionFocused(row.positionId, row.entryId));
    } else {
      goTo(SHORTLIST_HREFS.customList(row.shortlistId));
    }
  };

  /* ------------------------------ render ------------------------------ */

  const groupView = (query: typeof positionQuery) => ({
    error: query.isError && !query.data,
    hasMore: !!query.hasNextPage,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    loading: query.isPending,
    loadingMore: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(),
    onRetry: () => void query.refetch(),
  });

  const canCreate = customQuery.data?.pages[0]?.canCreate ?? false;
  const memberships = membershipsQuery.data ?? null;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (step === "selector") {
      selectorScroll.current = event.nativeEvent.contentOffset.y;
    }
  };

  let header: ReactNode = null;
  let body: ReactNode = null;

  if (step === "selector") {
    header = (
      <FlowSheetHeader
        contextLine={`${person.fullName} · ${society.name}`}
        logoUrl={society.logoUrl}
        onBack={
          selectorFromSummary
            ? () => {
                setSelectorFromSummary(false);
                setStep("summary");
              }
            : undefined
        }
        onClose={onClose}
        title={PROFILE_SHORTLIST_COPY.selectorTitle}
      />
    );
    body = (
      <ProfileShortlistSelector
        canCreate={canCreate}
        custom={groupView(customQuery)}
        onCreate={() => handoff(() => setCreateOpen(true))}
        onPick={(row) => {
          if (!add.isPending) {
            add.mutate(row);
          }
        }}
        pendingKey={pendingKey}
        position={groupView(positionQuery)}
      />
    );
  } else if (step === "summary") {
    header = (
      <FlowSheetHeader
        contextLine={society.name}
        logoUrl={society.logoUrl}
        onClose={onClose}
        title={summaryTitle(person.fullName)}
      />
    );
    body = (
      <ProfileShortlistSummary
        canAddMore={memberships?.canAddMore ?? false}
        error={membershipsQuery.isError}
        items={memberships?.items ?? null}
        onAddToOther={() => {
          setSelectorFromSummary(true);
          setStep("selector");
        }}
        onOpen={(row) => {
          setSelected(row);
          setStep("actions");
        }}
        onRetry={() => void membershipsQuery.refetch()}
      />
    );
  } else if (step === "actions" && selected) {
    const lines = membershipLines(selected);
    header = (
      <FlowSheetHeader
        onBack={() => {
          setSelected(null);
          setStep("summary");
        }}
        onClose={onClose}
        subtitle={lines.scope}
        title={lines.title}
      />
    );
    body = (
      <ProfileShortlistActions
        membership={selected}
        onEdit={() => void openEditor(selected)}
        onRemove={() => setRemoveOpen(true)}
        onSee={() => seeInShortlist(selected)}
        person={person}
      />
    );
  } else if (step === "recovery" && recovery) {
    header = <FlowSheetHeader onClose={onClose} title="" />;
    body = (
      <ProfileShortlistRecovery
        busy={retryAdd.isPending}
        listName={recovery.name}
        onOpenList={() => goTo(SHORTLIST_HREFS.customList(recovery.shortlistId))}
        onRetry={() => retryAdd.mutate(recovery)}
        personName={person.fullName}
        scopeLabel={recovery.scopeLabel}
      />
    );
  }

  return (
    <>
      <BottomSheet onClose={onClose} onDismiss={runHandoff} visible={sheetActive}>
        {header}
        <ScrollView
          contentOffset={step === "selector" ? { x: 0, y: selectorOffset } : undefined}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={64}
          style={[styles.scroll, { maxHeight: height * 0.72 }]}
        >
          {body}
        </ScrollView>

        {/* Screen 09: la conferma sta sopra il pannello, che resta non
            interattivo sotto. Annidata, così iOS la presenta dal Modal del
            pannello e non in concorrenza con lui. */}
        {selected ? (
          <ConfirmModal
            cancelLabel={PROFILE_SHORTLIST_COPY.removeCancel}
            confirmLabel={PROFILE_SHORTLIST_COPY.removeConfirm}
            destructive
            isBusy={remove.isPending}
            message={removeBody({
              name: person.fullName,
              scopeLabel: selected.scopeLabel,
              title: selected.title,
            })}
            onCancel={() => setRemoveOpen(false)}
            onConfirm={() => remove.mutate(selected)}
            title={PROFILE_SHORTLIST_COPY.removeTitle}
            visible={removeOpen}
          />
        ) : null}
      </BottomSheet>

      <CreateListModal
        clubId={society.id}
        onClose={() => {
          /* §22: «Form → Annulla senza commit: selector precedente con scroll
             recuperato.» */
          setCreateOpen(false);
          setSheetHidden(false);
        }}
        onProfileOutcome={onCreateOutcome}
        profileTarget={{ fullName: person.fullName, personId: person.id }}
        society={{ logoUrl: society.logoUrl, name: society.name }}
        visible={open && createOpen}
      />

      {editorEntry ? (
        <ShortlistEvaluationEditor
          busy={save.isPending}
          entry={editorEntry}
          error={editorError}
          onClose={() => {
            /* §20: «Annulla senza modifiche torna alla subview della
               membership da cui l'editor è stato aperto.» */
            setEditorOpen(false);
            setEditorError(null);
            setSheetHidden(false);
          }}
          onSave={(patch) => save.mutate(patch)}
          visible={open && editorOpen}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
});
