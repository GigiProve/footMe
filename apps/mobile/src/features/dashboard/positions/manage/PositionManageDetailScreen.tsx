/**
 * Dettaglio gestionale di una Position (DAS-REV-17 §7, §18; screen 01, 04,
 * 06, 07, 11, 12).
 *
 * Una schermata sola per sei stati del mockup. §30 lo chiede
 * esplicitamente: «Gli screen 07 e 11 rappresentano la stessa Position
 * prima e dopo una modifica, non due record. Gli screen 01 e 04
 * rappresentano la stessa bozza. Non creare route o modelli separati per
 * ogni stato fotografato.»
 *
 * È il dettaglio **gestionale**, non la scheda visitor: nessun «Candidati»,
 * e il perimetro è quello dell'amministratore sullo stesso Position ID
 * (§2). Le azioni compaiono solo dove una capability reale le consente —
 * §5: «Nascondi le azioni non consentite. Non mostrare pulsanti disabilitati
 * per spiegare una capability mancante.»
 *
 * Vive dentro la tab Dashboard perché §6 vuole la bottom navigation
 * visibile con Dashboard selezionata; editor e anteprima sono invece flussi
 * focalizzati in `app/position-manage/`.
 */
import { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button, useToast } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { COMPOSE_QK } from "../compose/compose-keys";
import {
  createSessionNonce,
  operationKeyOf,
} from "../compose/compose-operation-key";
import {
  contextSummary,
  describeComposeError,
} from "../compose/compose-presentation";
import {
  fetchCatalogs,
  setPositionDeadline,
  toComposeError,
  type ComposeError,
} from "../compose/compose-service";
import { ComposerNavBar } from "../compose/components/ComposerNavBar";
import { DeadlineControl } from "../compose/components/DeadlineControl";
import { usePublishPositions } from "../compose/use-publish-positions";
import { PositionDeadlineSheet } from "../components/PositionDeadlineSheet";
import { POSITIONS_QK, POSITIONS_QK_PREFIXES } from "../positions-keys";
import {
  POSITIONS_COPY,
  formatCivilDateLabel,
  formatDeadlinePassedLabel,
} from "../positions-presentation";
import { POSITIONS_HREFS } from "../positions-routes";
import { ClosePositionSheet } from "./components/ClosePositionSheet";
import { DeadlineRemoveSheet } from "./components/DeadlineRemoveSheet";
import { PublishConfirmSheet } from "./components/PublishConfirmSheet";
import {
  CLOSE_DRAFT_QK,
  EMPTY_CLOSE_DRAFT,
  clearCloseDraft,
  type CloseDraft,
} from "./close-draft";
import {
  MANAGE_COPY,
  applicationsLine,
  detailSections,
  draftReadiness,
  firstMissingAnchor,
  historyRows,
  lifecycleLabel,
  missingItems,
  readinessBody,
  readinessHeadline,
  readinessLinkLabel,
} from "./manage-presentation";
import { DETAILS_SECTION_ANCHOR, MANAGE_HREFS } from "./manage-routes";
import { closePosition, fetchPositionManageDetail } from "./manage-service";

const EMPTY_CATALOGS = {
  categories: [],
  experiences: [],
  qualifications: [],
  roles: [],
  seasons: [],
};

export function PositionManageDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { connection } = useDashboardConnection();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const positionId = typeof id === "string" ? id : "";

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  /* DAS-REV-18. Tre sheet, tre stati separati e mai due aperti insieme: il
     `BottomSheet` condiviso monta un `Modal` anche da chiuso, e due modali
     sovrapposti si coprirebbero a vicenda. */
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  /** §19: lo sheet resta aperto sotto la scelta del motivo, come l'anteprima. */
  const [reasonOpen, setReasonOpen] = useState(false);
  /** §24: solo una chiusura avvenuta in questa sessione sposta il ritorno. */
  const [closedHere, setClosedHere] = useState(false);
  /**
   * §15: «Il back torna allo sheet.»
   *
   * La conferma non viene annullata quando si apre l'anteprima — sarebbe
   * un secondo step da rifare — ma va nascosta finché l'anteprima è in
   * cima: un `Modal` montato da una schermata più in basso coprirebbe
   * quella sopra. Al ritorno del focus riappare dov'era.
   */
  const [previewOpen, setPreviewOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setPreviewOpen(false);
      /* Stesso meccanismo per la scelta del motivo: al ritorno dalla subview
         lo sheet di chiusura riappare dov'era, con la scelta appena fatta
         (§38 — «Il selector motivo torna allo sheet finale preservando lo
         stato»). */
      setReasonOpen(false);
    }, []),
  );

  /* Il nonce nasce col montaggio della schermata: un retry della stessa
     conferma riusa la chiave, una conferma su una versione diversa ne
     ottiene un'altra (§25). */
  const [nonce] = useState(createSessionNonce);

  const detailQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchPositionManageDetail(positionId),
    queryKey: POSITIONS_QK.detail(actorId, positionId),
    /* Un rifiuto non si ritenta: §5 — il backend rivalida a ogni lettura, e
       insistere non cambia una capability revocata. */
    retry: (failureCount, error) =>
      !isAccessError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  const catalogsQuery = useQuery({
    enabled: !!detail,
    queryFn: () => fetchCatalogs(detail?.profileType ?? "player"),
    queryKey: COMPOSE_QK.catalogs(detail?.profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  /** Latch del singolo invio: si riapre solo su esito, non su render. */
  const submittingRef = useRef(false);

  const publishMutation = usePublishPositions({
    onError: (_error, message) => {
      submittingRef.current = false;
      setPublishError(message);
    },
    /* §16: «Successo: feedback leggero "Posizione pubblicata", passaggio al
       dettaglio Attiva dello stesso oggetto.» Stesso ID, nessuna pagina
       celebrativa, nessun ritorno forzato al Centro. */
    onSuccessNavigate: () => {
      submittingRef.current = false;
      setConfirmVersion(null);
      void detailQuery.refetch();
    },
    operationKey: operationKeyOf(
      nonce,
      `publish:${positionId}:${confirmVersion ?? detail?.resourceVersion ?? 0}`,
    ),
    successMessage: () => MANAGE_COPY.publishSuccess,
  });

  /**
   * La bozza del motivo, in viaggio fra questo sheet e la schermata di §20.
   *
   * È una riga di cache senza `queryFn`: non viene mai fetchata, serve solo
   * perché la scrittura della subview faccia ri-renderizzare questa pagina.
   */
  const closeDraftQuery = useQuery<CloseDraft>({
    enabled: !!positionId,
    initialData: EMPTY_CLOSE_DRAFT,
    queryFn: () => EMPTY_CLOSE_DRAFT,
    queryKey: CLOSE_DRAFT_QK.draft(positionId),
    staleTime: Infinity,
  });

  const closeDraft = closeDraftQuery.data ?? EMPTY_CLOSE_DRAFT;

  /**
   * Le superfici che una scadenza o una chiusura rendono obsolete (§36).
   *
   * «Dopo update deadline o chiusura invalida/riconcilia dettaglio owner,
   * Centro, riepiloghi, dettaglio pubblico, query candidabili e count
   * pertinenti.» Si invalida **per prefisso**: le chiavi portano actor e
   * identità, e ricostruirle qui le farebbe divergere al primo cambio.
   */
  const invalidateAfterWrite = () => {
    const prefixes: readonly unknown[][] = [
      /* Il dettaglio pubblico e le query candidabili: §33 — «Gli indici si
         aggiornano per publish, modifica termine, raggiungimento del cutoff
         e chiusura.» */
      ["position-detail", positionId],
      ["position-compose-drafts"],
      ["search-positions"],
      ["saved-items"],
      ["dashboard-module"],
      ...POSITIONS_QK_PREFIXES.map((prefix) => [prefix]),
    ];

    for (const queryKey of prefixes) {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  /**
   * Salvataggio della scadenza su una Position **attiva** (§13).
   *
   * Stesso comando della bozza — §3 vieta una seconda implementazione — con
   * `expectedVersion` e nessun ottimismo: §13 chiede che «`updated_at` e
   * versione cambiano dopo il salvataggio reale».
   */
  const deadlineMutation = useMutation({
    mutationFn: (deadlineDate: string | null) =>
      setPositionDeadline({
        deadlineDate,
        expectedVersion: detail?.resourceVersion ?? null,
        positionId,
      }),
    onError: (error) => setDeadlineError(describeWriteError(error)),
    onSuccess: (_result, deadlineDate) => {
      setDeadlineError(null);
      setDeadlineOpen(false);
      setRemoveOpen(false);
      void detailQuery.refetch();
      invalidateAfterWrite();

      /* §13 e §16: feedback leggero, e distinto fra aggiornamento e
         rimozione — sono due esiti che il gestore legge diversamente. */
      showToast({
        message: deadlineDate
          ? MANAGE_COPY.deadlineUpdated
          : MANAGE_COPY.deadlineRemoved,
        tone: "success",
      });
    },
  });

  /**
   * La chiusura (§22, §24).
   *
   * Nessun ottimismo: §22 — «Non applicare una chiusura ottimistica prima
   * dell'esito autorevole.» Il lifecycle cambia solo dopo il refetch, e il
   * toast compare solo dopo la risposta.
   */
  const closeMutation = useMutation({
    mutationFn: () =>
      closePosition({
        expectedVersion: detail?.resourceVersion ?? null,
        /* La chiave è legata alla versione confermata all'apertura: un retry
           della stessa chiusura la riusa, una chiusura su una versione
           diversa ne ottiene un'altra (§22). */
        operationKey: operationKeyOf(
          nonce,
          `close:${positionId}:${detail?.resourceVersion ?? 0}`,
        ),
        positionId,
        reason: closeDraft.reason,
        reasonText: closeDraft.reasonText,
      }),
    onError: (error) => {
      submittingRef.current = false;
      setCloseError(describeWriteError(error));
    },
    onSuccess: () => {
      submittingRef.current = false;
      setCloseOpen(false);
      setCloseError(null);
      setClosedHere(true);
      clearCloseDraft(queryClient, positionId);

      /* §24: «Al successo passa al dettaglio storico dello stesso ID e
         mostra il toast "Posizione chiusa".» Stesso ID, stessa route: il
         refetch basta, non serve navigare. */
      void detailQuery.refetch();
      invalidateAfterWrite();
      showToast({ message: MANAGE_COPY.closeSuccess, tone: "success" });
    },
  });

  const goBack = () => {
    /* DAS-REV-18 §24: «quando si torna al Centro dopo questa transizione,
       apri Chiuse per rendere reperibile l'oggetto appena concluso». Vale
       solo dopo una chiusura avvenuta **qui**: il cambio di tab è la
       conseguenza di un'azione dell'utente, non un salto automatico a ogni
       risposta asincrona. Da altre origini resta il normale back. */
    if (closedHere) {
      router.replace(POSITIONS_HREFS.center({ group: "closed" }) as never);

      return;
    }

    if (router.canGoBack()) {
      router.back();

      return;
    }

    /* §6: «Conserva origin, tab, filtri, scroll e identità del Centro nel
       ritorno.» Quando lo stack non ha un indietro — deep link — si torna
       al Centro, non alla Dashboard generica. */
    router.replace(POSITIONS_HREFS.center() as never);
  };

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={detail?.clubIsVerified ?? false}
        logoUrl={detail?.clubLogoUrl ?? null}
        name={detail?.clubName ?? ""}
        onBack={goBack}
      />
      {body}
    </View>
  );

  if (isAccessError(detailQuery.error)) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alle posizioni",
          body: "Torna al Centro per vedere le posizioni ancora disponibili.",
          icon: "alert-circle-outline",
          title: MANAGE_COPY.gone,
        }}
        onAction={goBack}
      />,
    );
  }

  if (detailQuery.isLoading && !detail) {
    /* §27: «Al primo ingresso mostra struttura, identità nota e skeleton
       locali. Non mostrare una pagina bianca o uno spinner gigante.» */
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!detail) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={POSITIONS_COPY.offlineBody}
          onRetry={() => void detailQuery.refetch()}
        />,
      );
    }

    /* §27: «Non costruire un form vuoto capace di sovrascrivere il
       backend.» Qui non c'è niente da aprire finché il dato non arriva. */
    return shell(
      <DashboardGlobalError
        body={MANAGE_COPY.retry}
        onRetry={() => void detailQuery.refetch()}
        title={MANAGE_COPY.loadFailed}
      />,
    );
  }

  const isDraft = detail.lifecycle === "draft";
  const isClosed = detail.lifecycle === "closed";
  const isPublished = detail.lifecycle === "published";
  const readiness = draftReadiness(detail);
  const headline = readinessHeadline(detail);
  const guidance = readinessBody(detail);
  const linkLabel = readinessLinkLabel(detail);
  const missing = isDraft && readiness === "incomplete" ? missingItems(detail) : [];
  const sections = detailSections(detail, catalogsQuery.data ?? EMPTY_CATALOGS);
  const counts = applicationsLine(detail, {
    emphasiseNew: detail.lifecycle !== "closed",
  });

  /* §7: «Pubblicabile» è permesso **più** contenuto valido. Il primo lo dice
     `canPublish`, il secondo l'assenza di blockers: §4 vieta di confonderli
     in un unico flag persistito. */
  const canPublishNow = detail.canPublish && detail.blockers.length === 0;
  const showComplete = isDraft && detail.canEdit && readiness === "incomplete";

  /**
   * Il blocco «Informazioni della posizione» nel dettaglio.
   *
   * Compare quando il dettaglio è l'**unica** superficie che può mostrarlo:
   * in sola consultazione non esiste un editor da aprire (screen 12), e su
   * una bozza ancora senza dettagli la pagina non avrebbe altro da dire
   * (screen 01). Quando invece ci sono sezioni compilate e un editor
   * raggiungibile — screen 04 e 07 — ripeterlo qui aggiungerebbe righe che
   * §18 vuole evitare: «Non presentarla come un form da completare.»
   */
  /**
   * …ma non su una chiusa (DAS-REV-18 §28).
   *
   * «Il contenuto è leggibile come documento, senza campi disabilitati o
   * selector finti»: su una Position conclusa `canEdit` è falso per
   * lifecycle, non per capability, e il blocco «Informazioni della
   * posizione» — che esiste per spiegare *perché* non si può modificare —
   * diventerebbe una spiegazione di una modifica che nessuno sta cercando.
   * Profilo e ambito sono già nel titolo e nella riga di contesto.
   */
  const showIdentityBlock =
    !isClosed && (!detail.canEdit || (isDraft && !detail.hasDetails));

  /* DAS-REV-18 §12: la sezione Scadenza vive sotto le azioni di una
     pubblicata, e sul contenuto storico di una chiusa (§28). Su una bozza
     resta dov'è già, nello step 3 del composer (§9). */
  const deadlineLabel = formatCivilDateLabel(detail.deadlineDate);
  const showDeadlineSection =
    isPublished || (isClosed && detail.deadlineDate !== null);
  /* §12: «Mostra Modifica scadenza solo se autorizzato» — e mai su una
     chiusa, che §25 vuole in sola lettura. Su una bozza il comando esiste
     comunque (§10: la pubblicazione rapida lo espone), ma la sua riga vive
     nello sheet di pubblicazione, non qui. */
  const canEditDeadline = !isClosed && detail.canEdit;
  const history = historyRows(detail);

  /**
   * §10: «Il percorso Completa deve aprire questo controllo se è l'unico
   * problema; non inviare l'utente a compilare età o requisiti già validi.»
   *
   * `DEADLINE_PASSED` non ha un'ancora nell'editor perché la scadenza non
   * è un campo dell'editor: è una configurazione della pubblicazione, e la
   * sua destinazione è lo sheet.
   */
  const deadlineIsOnlyBlocker =
    detail.blockers.length === 1 && detail.blockers[0] === "DEADLINE_PASSED";

  const openEditor = (anchor?: string | null) =>
    router.push(MANAGE_HREFS.edit(detail.id, { anchor }) as never);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={detail.clubIsVerified}
        logoUrl={detail.clubLogoUrl}
        name={detail.clubName}
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void detailQuery.refetch()}
            refreshing={detailQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        style={styles.scroll}
        testID="position-manage-detail"
      >
        <AppText
          accessibilityRole="header"
          color="neutral"
          variant="screenTitle"
        >
          {detail.title ?? POSITIONS_COPY.untitled}
        </AppText>

        <AppText color="neutralMuted" variant="bodySm">
          {contextSummary(detail)}
        </AppText>

        {detail.teamIsInactive ? (
          <AppText color="neutralMuted" variant="meta">
            {POSITIONS_COPY.inactiveTeam}
          </AppText>
        ) : null}

        {/* §31: «"Bozza", "Attiva" … sono stati sobri: niente grandi badge
            verdi.» Testo neutro, nessun colore che porti significato. */}
        <AppText color="neutralMuted" testID="position-manage-status" variant="bodySm">
          {lifecycleLabel(detail)}
        </AppText>

        {/* DAS-REV-18 §14: «Nel dettaglio owner mostra Attiva, poi
            Candidature chiuse come condizione separata, e una data assoluta
            utile.» Due concetti distinti, due righe: lo stato resta Attiva
            anche a termine superato. */}
        {detail.receivingClosed ? (
          <>
            <AppText
              color="neutral"
              testID="position-manage-receiving"
              variant="bodySm"
            >
              {POSITIONS_COPY.receivingClosed}
            </AppText>

            {formatDeadlinePassedLabel(detail.deadlineDate) ? (
              <AppText color="neutralMuted" variant="meta">
                {formatDeadlinePassedLabel(detail.deadlineDate)}
              </AppText>
            ) : null}
          </>
        ) : null}

        {/* §18: «i conteggi possono apparire in una sola riga». Assenti —
            non a zero — quando l'actor non li può vedere o non sono noti.
            Su una chiusa i conteggi stanno nella sezione «Candidature
            ricevute» di §28, non qui in testa. */}
        {/* DAS-REV-22 §23: «Nel dettaglio Position mostra un accesso
            visibile Candidature ricevute con count reali e CTA Gestisci
            candidature.» Prima il conteggio era una riga sciolta in testa e
            l'ingresso un link più in basso: due pezzi della stessa cosa,
            separati. Ora il blocco è lo stesso dello storico (§28 di
            DAS-REV-18), così i due ingressi non divergono.

            Senza diritto all'aggregato il blocco non si disegna affatto:
            §9 di DAS-REV-22 — «Non mostrare un aggregato sensibile a chi non
            può conoscerlo». `applicationsLine` restituisce già `null` in
            quel caso, quindi non resta niente da rendere fuori dal blocco. */}
        {detail.countsAvailable && !isClosed ? (
          <View style={styles.block} testID="position-manage-received-open">
            <AppText color="neutral" variant="metaStrong">
              {MANAGE_COPY.receivedApplications}
            </AppText>

            <AppText
              color="neutral"
              testID="position-manage-counts"
              variant="bodyLg"
            >
              {counts ?? MANAGE_COPY.receivedNone}
            </AppText>

            <InlineAction
              label={MANAGE_COPY.manageApplications}
              onPress={() =>
                router.push(
                  POSITIONS_HREFS.positionApplications(detail.id) as never,
                )
              }
              testID="position-manage-applications"
            />
          </View>
        ) : null}

        {/* §12: «Il gruppo delle azioni contiene Modifica posizione e,
            immediatamente sotto, Chiudi posizione. Non inserire dati,
            divider di sezione o altre CTA fra le due.» Il divider sta
            **sopra** il gruppo, come negli screen 03 e 04: separa le azioni
            dai dati, non le due azioni fra loro. */}
        {isPublished && (detail.canEdit || detail.canClose) ? (
          <View style={styles.actionsDivider} />
        ) : null}

        {detail.canEdit ? (
          <InlineAction
            icon="create-outline"
            label={MANAGE_COPY.editAction}
            onPress={() => openEditor(null)}
            testID="position-manage-edit"
          />
        ) : null}

        {/* §18: solo su una PUBLISHED e solo con capability. §4: «Una sola
            azione secondaria distruttiva, testo rosso sobrio» — niente
            icona cestino, perché chiudere non è eliminare (§18). */}
        {isPublished && detail.canClose ? (
          <Pressable
            accessibilityHint="Apre la conferma di chiusura"
            accessibilityLabel={MANAGE_COPY.closeAction}
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => {
              setCloseError(null);
              setCloseOpen(true);
            }}
            style={({ pressed }) => [
              styles.inlineAction,
              pressed ? styles.pressed : null,
            ]}
            testID="position-manage-close"
          >
            <AppText color="danger" variant="actionLabel">
              {MANAGE_COPY.closeAction}
            </AppText>
          </Pressable>
        ) : null}

        {/* DAS-REV-18 §12: «Sotto il gruppo delle azioni inserisci la sezione
            Scadenza candidature con la data reale oppure Nessuna scadenza.»
            Una riga leggibile; il chevron compare solo dove c'è davvero
            qualcosa da aprire — «Un actor view-only vede il valore leggibile
            senza chevron di modifica». */}
        {isPublished && showDeadlineSection ? (
          <View style={styles.block} testID="position-manage-deadline">
            <Pressable
              accessibilityHint={
                canEditDeadline ? "Apre la modifica della scadenza" : undefined
              }
              accessibilityLabel={`${POSITIONS_COPY.deadlineLabel}: ${deadlineLabel ?? POSITIONS_COPY.deadlineNone}`}
              accessibilityRole={canEditDeadline ? "button" : undefined}
              disabled={!canEditDeadline}
              onPress={() => {
                setDeadlineError(null);
                setDeadlineOpen(true);
              }}
              style={({ pressed }) => [
                styles.deadlineRow,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.deadlineText}>
                <AppText color="neutralMuted" variant="meta">
                  {POSITIONS_COPY.deadlineLabel}
                </AppText>

                <AppText
                  color="neutral"
                  testID="position-manage-deadline-value"
                  variant="bodyLg"
                >
                  {deadlineLabel ?? POSITIONS_COPY.deadlineNone}
                </AppText>
              </View>

              {canEditDeadline ? (
                <Ionicons
                  color={colors.textNeutralSoft}
                  name="chevron-forward"
                  size={18}
                />
              ) : null}
            </Pressable>

            {canEditDeadline ? (
              <InlineAction
                chevron={false}
                label={MANAGE_COPY.deadlineEditAction}
                onPress={() => {
                  setDeadlineError(null);
                  setDeadlineOpen(true);
                }}
                testID="position-manage-deadline-edit"
              />
            ) : null}

            {/* §14: «Estendi o rimuovi la scadenza per ricevere nuove
                candidature.» Solo a chi può farlo: a un lettore sarebbe un
                invito a un'azione che non ha. */}
            {detail.receivingClosed && canEditDeadline ? (
              <AppText color="neutralMuted" variant="meta">
                {POSITIONS_COPY.receivingClosedHelper}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {/* §28: la Cronologia dello storico — tre voci, non una timeline. */}
        {history.length > 0 ? (
          <View style={styles.block} testID="position-manage-history">
            <AppText color="neutral" variant="metaStrong">
              {MANAGE_COPY.historyTitle}
            </AppText>

            {history.map((entry) => (
              <View
                accessible
                accessibilityLabel={`${entry.label}: ${entry.value}${entry.helper ? `. ${entry.helper}` : ""}`}
                key={entry.key}
                style={styles.historyRow}
              >
                <View style={styles.historyLabel}>
                  <AppText color="neutralMuted" variant="bodySm">
                    {entry.label}
                  </AppText>

                  {entry.helper ? (
                    <AppText color="neutralMuted" variant="meta">
                      {entry.helper}
                    </AppText>
                  ) : null}
                </View>

                <AppText
                  color="neutral"
                  style={styles.historyValue}
                  variant="bodySm"
                >
                  {entry.value}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {/* §28: «La sezione Candidature ricevute mostra il totale autorizzato
            e Vedi candidature … Senza diritto al dominio/aggregato, ometti
            dati e azioni; errore di caricamento non equivale a zero.» */}
        {isClosed && detail.countsAvailable ? (
          <View style={styles.block} testID="position-manage-received">
            <AppText color="neutral" variant="metaStrong">
              {MANAGE_COPY.receivedApplications}
            </AppText>

            <AppText color="neutral" variant="bodyLg">
              {counts ?? MANAGE_COPY.receivedNone}
            </AppText>

            {detail.applicationsTotal ? (
              <InlineAction
                label={MANAGE_COPY.viewApplications}
                /* DAS-REV-22 §23: «Per l'ingresso storico da una Position
                   CLOSED apri Tutte, come 13, così le candidature conservate
                   sono immediatamente raggiungibili.» Nuove resterebbe vuota
                   per definizione, e §23 vieta di segnarle lette per
                   ottenere quel risultato. */
                onPress={() =>
                  router.push(
                    POSITIONS_HREFS.positionApplications(detail.id, {
                      tab: "all",
                    }) as never,
                  )
                }
                testID="position-manage-view-applications"
              />
            ) : null}
          </View>
        ) : null}

        {/* §7: «Sola consultazione» è un'indicazione discreta, non un
            avviso. Compare solo quando non c'è davvero nessuna azione. */}
        {/* …e non su una chiusa: lì la sola lettura è il lifecycle, non una
            capability mancante, e lo stato «Chiusa» lo dice già (§28). */}
        {!isClosed && !detail.canEdit && !detail.canPublish ? (
          <AppText color="neutralMuted" testID="position-manage-readonly" variant="bodySm">
            {MANAGE_COPY.readOnly}
          </AppText>
        ) : null}

        {headline ? (
          <View style={styles.block}>
            <View style={styles.headlineRow}>
              {/* §31: «La readiness usa testo e, quando previsto, un check
                  neutro; non una scelta radio.» Il check accompagna solo
                  «Pronta per la pubblicazione» — lo screen 01 non ne ha
                  uno accanto all'invito ad aggiungere dettagli, che è
                  guidance e non una spunta conquistata. */}
              {readiness === "ready" || readiness === "ready_without_details" ? (
                <Ionicons
                  color={colors.textNeutral}
                  name="checkmark"
                  size={18}
                />
              ) : null}

              <AppText color="neutral" style={styles.headline} variant="titleSm">
                {headline}
              </AppText>
            </View>

            {guidance ? (
              <AppText color="neutralMuted" variant="bodySm">
                {guidance}
              </AppText>
            ) : null}

            {linkLabel && detail.canEdit ? (
              <InlineAction
                label={linkLabel}
                onPress={() => openEditor(DETAILS_SECTION_ANCHOR)}
                testID="position-manage-details-link"
              />
            ) : null}

            {/* §7: «L'elenco deve derivare dagli errori reali e permettere
                di raggiungere i campi corretti.» */}
            {missing.map((item) => (
              <Pressable
                accessibilityHint={
                  detail.canEdit ? "Apre il campo da completare" : undefined
                }
                accessibilityLabel={`${item.label}${item.value ? `, ${item.value}` : ""}. ${item.hint}`}
                accessibilityRole={detail.canEdit ? "button" : undefined}
                disabled={!detail.canEdit}
                key={item.label}
                onPress={() => {
                  /* §10: la riga della scadenza porta al suo controllo, non
                     a un editor che non la contiene. */
                  if (item.label === POSITIONS_COPY.deadlineLabel) {
                    setDeadlineError(null);
                    setDeadlineOpen(true);

                    return;
                  }

                  openEditor(item.anchor);
                }}
                style={({ pressed }) => [
                  styles.missing,
                  pressed ? styles.pressed : null,
                ]}
                testID={`position-manage-missing-${item.anchor ?? item.label}`}
              >
                <View style={styles.missingText}>
                  <AppText color="neutralMuted" variant="meta">
                    {item.label}
                  </AppText>

                  <AppText color="neutral" variant="bodyLg">
                    {item.value ?? MANAGE_COPY.toSet}
                  </AppText>

                  <AppText color="neutralMuted" variant="meta">
                    {item.hint}
                  </AppText>
                </View>

                {detail.canEdit ? (
                  <Ionicons
                    color={colors.textNeutralSoft}
                    name="chevron-forward"
                    size={18}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {showIdentityBlock ? (
          <View style={styles.block} testID="position-manage-identity">
            <AppText color="neutral" variant="metaStrong">
              {MANAGE_COPY.lockedGroupLabel}
            </AppText>

            {/* Due righe, non quattro: la squadra è già nella riga di
                contesto sotto il titolo, e il ruolo **è** il titolo. §7
                vieta di «presentarla come un form da completare», e
                ripetere gli stessi dati è il primo passo in quella
                direzione. */}
            <ReadRow label="Profilo" value={PROFILE_LABELS[detail.profileType]} />

            <ReadRow
              label="Ambito dell'incarico"
              value={
                detail.scope === "society"
                  ? "Intera società"
                  : "Una squadra specifica"
              }
            />
          </View>
        ) : null}

        {/* §7 e §18: solo sezioni compilate, nessun blocco «Non
            specificato» per un facoltativo assente. */}
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <AppText color="neutral" variant="metaStrong">
              {section.label}
            </AppText>

            <AppText color="neutral" variant="bodyLg">
              {section.value}
            </AppText>
          </View>
        ))}

        {/* §28: «Nel contenuto storico, **dopo i dettagli professionali**,
            mostra anche Scadenza candidature se era presente alla chiusura,
            con il valore storico conservato e senza azioni.» Il termine può
            essere precedente o successivo a `closed_at`: è il valore
            conservato, non la data di chiusura riscritta. */}
        {isClosed && showDeadlineSection ? (
          <View style={styles.section} testID="position-manage-deadline">
            <AppText color="neutral" variant="metaStrong">
              {POSITIONS_COPY.deadlineLabel}
            </AppText>

            <AppText
              color="neutral"
              testID="position-manage-deadline-value"
              variant="bodyLg"
            >
              {deadlineLabel}
            </AppText>
          </View>
        ) : null}

        {publishError ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.error}
            variant="meta"
          >
            {publishError}
          </AppText>
        ) : null}
      </ScrollView>

      {/* §7: la primaria dipende dalla condizione della bozza e dalle
          capability. Una posizione attiva non ne ha: §18 la vuole
          «orientata alla lettura». */}
      {isDraft && canPublishNow ? (
        <View style={[styles.footer, { paddingBottom: spacing[12] }]}>
          <Button
            fullWidth
            label={MANAGE_COPY.publishAction}
            onPress={() => {
              setPublishError(null);
              setConfirmVersion(detail.resourceVersion);
            }}
            testID="position-manage-publish"
          />
        </View>
      ) : showComplete ? (
        <View style={[styles.footer, { paddingBottom: spacing[12] }]}>
          <Button
            fullWidth
            label={MANAGE_COPY.completeAction}
            onPress={() => {
              if (deadlineIsOnlyBlocker) {
                setDeadlineError(null);
                setDeadlineOpen(true);

                return;
              }

              openEditor(firstMissingAnchor(detail));
            }}
            testID="position-manage-complete"
          />
        </View>
      ) : null}

      {/* §5: «Nascondi le azioni non consentite.» Lo sheet non viene montato
          affatto quando la pubblicazione non è un'azione di questo actor:
          il `Modal` resta nell'albero anche da chiuso, e con lui la frase
          «potrà ricevere candidature» su una pagina di sola consultazione. */}
      {isDraft && detail.canPublish ? (
        <PublishConfirmSheet
          context={contextSummary(detail)}
          deadline={
            detail.canEdit ? (
              <DeadlineControl
                busy={deadlineMutation.isPending}
                error={deadlineError}
                onChange={(value) => deadlineMutation.mutateAsync(value)}
                testID="position-publish-deadline"
                value={detail.deadlineDate}
              />
            ) : undefined
          }
          onCancel={() => {
            /* §15: «Annullare non modifica lo stato della Position e non
               cancella la bozza.» Si chiude lo sheet e basta. */
            setConfirmVersion(null);
          }}
          onPreview={() => {
            setPreviewOpen(true);
            router.push(MANAGE_HREFS.preview(detail.id) as never);
          }}
          onPublish={() => {
            /* §15: «impedisci submit ripetuti». Il `loading` della primaria
               copre i tap successivi al primo render, ma due tap nello stesso
               frame arrivano prima che lo stato cambi: il latch chiude anche
               quella finestra. L'idempotenza del server è la seconda rete,
               non la prima. */
            if (submittingRef.current || publishMutation.isPending) {
              return;
            }

            submittingRef.current = true;
            setPublishError(null);
            publishMutation.mutate({
              /* La versione è quella confermata all'apertura dello sheet: §15
                 — «Una bozza cambiata altrove richiede aggiornamento e nuova
                 conferma del contenuto; non pubblicare silenziosamente una
                 versione diversa.» Il server rifiuta se è cambiata. */
              expectedVersions: [confirmVersion],
              positionIds: [detail.id],
              remaining: 0,
            });
          }}
          publishing={publishMutation.isPending}
          title={detail.title ?? POSITIONS_COPY.untitled}
          visible={confirmVersion !== null && !previewOpen}
        />
      ) : null}

      {/* DAS-REV-18 §13. Montato solo dove la modifica è un'azione reale:
          su una chiusa §25 vieta anche la presenza di comandi disabilitati,
          e un `Modal` chiuso resta comunque nell'albero. */}
      {canEditDeadline ? (
        <PositionDeadlineSheet
          busy={deadlineMutation.isPending}
          contextLabel={`${detail.title ?? POSITIONS_COPY.untitled} · ${contextSummary(detail)}`}
          error={deadlineError}
          /* §13: su una bozza la CTA è «Conferma» e non c'è una scadenza
             attuale da ricordare; su una pubblicata diventa «Salva
             scadenza». Stesso sheet, stesso comando. */
          mode={isDraft ? "draft" : "published"}
          onClose={() => setDeadlineOpen(false)}
          onConfirm={(deadlineDate) => {
            /* §16: la rimozione ha un chiarimento **solo** quando riabilita
               la ricezione. Con il termine ancora valido, §13 è esplicito:
               «rimuove il termine senza un secondo avviso». */
            if (deadlineDate === null && detail.receivingClosed) {
              setDeadlineOpen(false);
              setRemoveOpen(true);

              return;
            }

            deadlineMutation.mutate(deadlineDate);
          }}
          receivingClosed={detail.receivingClosed}
          value={detail.deadlineDate}
          visible={deadlineOpen}
        />
      ) : null}

      {canEditDeadline ? (
        <DeadlineRemoveSheet
          busy={deadlineMutation.isPending}
          error={deadlineError}
          onCancel={() => {
            /* §16: «Annullare conserva termine e ricezione precedenti.» */
            setRemoveOpen(false);
            setDeadlineError(null);
          }}
          /* §16: «La conferma esegue direttamente la patch versionata a
             null; non segue un secondo Salva o un secondo popup.» */
          onConfirm={() => deadlineMutation.mutate(null)}
          visible={removeOpen}
        />
      ) : null}

      {/* §18: il comando esiste solo su una PUBLISHED autorizzata. */}
      {isPublished && detail.canClose ? (
        <ClosePositionSheet
          busy={closeMutation.isPending}
          context={contextSummary(detail)}
          error={closeError}
          onCancel={() => {
            /* §19: «Aprire/chiudere lo sheet, selezionare un motivo e
               toccare Annulla non modificano il lifecycle.» Si scarta anche
               la bozza del motivo: non deve ricomparire alla prossima
               apertura come se fosse stata confermata. */
            setCloseOpen(false);
            setCloseError(null);
            clearCloseDraft(queryClient, detail.id);
          }}
          onConfirm={() => {
            /* §22: «Disabilita doppi submit.» Il `loading` copre i tap dopo
               il primo render; il latch chiude la finestra dei due tap nello
               stesso frame. L'idempotenza del server è la seconda rete. */
            if (submittingRef.current || closeMutation.isPending) {
              return;
            }

            submittingRef.current = true;
            setCloseError(null);
            closeMutation.mutate();
          }}
          onOpenReason={() => {
            setReasonOpen(true);
            router.push(MANAGE_HREFS.closeReason(detail.id) as never);
          }}
          reason={closeDraft.reason}
          receivingClosed={detail.receivingClosed}
          title={detail.title ?? POSITIONS_COPY.untitled}
          visible={closeOpen && !reasonOpen}
        />
      ) : null}
    </View>
  );
}

/**
 * La copy di un errore di scrittura (§38).
 *
 * `POSITION_LIFECYCLE_CONFLICT` su questi due comandi significa una cosa
 * sola — la posizione è stata chiusa mentre la si modificava — e merita la
 * frase di §38, non il generico «la selezione è cambiata» che il composer
 * usa per lo stesso codice in un contesto diverso.
 */
function describeWriteError(error: unknown): string {
  const composeError = toComposeError(error);

  return composeError.code === "POSITION_LIFECYCLE_CONFLICT"
    ? MANAGE_COPY.closedConflict
    : describeComposeError(composeError);
}

const PROFILE_LABELS = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
} as const;

/**
 * §7 e §18: le azioni del dettaglio sono «leggere» — testo blu, con icona
 * dove il mockup la mostra. Non pulsanti pieni: la primaria è una sola per
 * pagina, e sta nel footer.
 */
function InlineAction({
  chevron = true,
  icon,
  label,
  onPress,
  testID,
}: {
  /**
   * §4: «con icona o chevron soltanto quando utile». Su «Modifica scadenza»
   * non lo è: la riga sopra porta già il chevron verso lo stesso sheet, e
   * ripeterlo suggerirebbe due destinazioni diverse.
   */
  chevron?: boolean;
  icon?: "create-outline";
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.inlineAction,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      {icon ? <Ionicons color={colors.accent} name={icon} size={16} /> : null}

      <AppText color="accent" variant="actionLabel">
        {label}
      </AppText>

      {icon || !chevron ? null : (
        <Ionicons color={colors.accent} name="chevron-forward" size={14} />
      )}
    </Pressable>
  );
}

/**
 * Riga leggibile, non un campo (§19).
 *
 * «Queste informazioni sono righe leggibili senza bordi da input, chevron,
 * cursore di modifica o trattamento disabled a basso contrasto.»
 */
function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.readRow}>
      <AppText color="neutralMuted" variant="meta">
        {label}
      </AppText>

      <AppText color="neutral" variant="bodyLg">
        {value}
      </AppText>
    </View>
  );
}

/** §23: esiste-ma-negata e inesistente producono lo stesso esito. */
function isAccessError(error: unknown): error is ComposeError {
  if (!error) {
    return false;
  }

  const code = toComposeError(error).code;

  return (
    code === "POSITION_NOT_AVAILABLE" ||
    code === "POSITION_NOT_FOUND" ||
    code === "POSITION_NOT_AUTHORIZED"
  );
}

const styles = StyleSheet.create({
  block: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    marginTop: spacing[20],
    paddingTop: spacing[16],
  },
  content: {
    gap: spacing[4],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  counts: {
    paddingTop: spacing[8],
  },
  actionsDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginTop: spacing[12],
  },
  deadlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  deadlineText: {
    flex: 1,
    gap: spacing[4],
  },
  historyLabel: {
    flex: 1,
    gap: spacing[4],
  },
  historyRow: {
    alignItems: "flex-start",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  historyValue: {
    flexShrink: 1,
    textAlign: "right",
  },
  error: {
    paddingTop: spacing[12],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  headline: {
    flexShrink: 1,
  },
  headlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  inlineAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[8],
  },
  missing: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  missingText: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  readRow: {
    gap: spacing[4],
    paddingVertical: spacing[6],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  section: {
    gap: spacing[4],
    marginTop: spacing[16],
  },
});
