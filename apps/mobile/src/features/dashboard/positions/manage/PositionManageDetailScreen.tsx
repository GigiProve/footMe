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
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
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
import { contextSummary } from "../compose/compose-presentation";
import {
  fetchCatalogs,
  toComposeError,
  type ComposeError,
} from "../compose/compose-service";
import { ComposerNavBar } from "../compose/components/ComposerNavBar";
import { usePublishPositions } from "../compose/use-publish-positions";
import { POSITIONS_QK } from "../positions-keys";
import { POSITIONS_COPY } from "../positions-presentation";
import { POSITIONS_HREFS } from "../positions-routes";
import { PublishConfirmSheet } from "./components/PublishConfirmSheet";
import {
  MANAGE_COPY,
  applicationsLine,
  detailSections,
  draftReadiness,
  firstMissingAnchor,
  lifecycleLabel,
  missingItems,
  readinessBody,
  readinessHeadline,
  readinessLinkLabel,
} from "./manage-presentation";
import { DETAILS_SECTION_ANCHOR, MANAGE_HREFS } from "./manage-routes";
import { fetchPositionManageDetail } from "./manage-service";

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

  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
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

  const goBack = () => {
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
  const readiness = draftReadiness(detail);
  const headline = readinessHeadline(detail);
  const guidance = readinessBody(detail);
  const linkLabel = readinessLinkLabel(detail);
  const missing = isDraft && readiness === "incomplete" ? missingItems(detail) : [];
  const sections = detailSections(detail, catalogsQuery.data ?? EMPTY_CATALOGS);
  const counts = applicationsLine(detail);

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
  const showIdentityBlock = !detail.canEdit || (isDraft && !detail.hasDetails);

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

        {detail.receivingClosed ? (
          <AppText color="neutralMuted" variant="meta">
            {POSITIONS_COPY.deadlinePassed}
          </AppText>
        ) : null}

        {/* §18: «i conteggi possono apparire in una sola riga». Assenti —
            non a zero — quando l'actor non li può vedere o non sono noti. */}
        {counts ? (
          <AppText color="neutral" style={styles.counts} testID="position-manage-counts" variant="bodyLg">
            {counts}
          </AppText>
        ) : null}

        {detail.countsAvailable ? (
          <InlineAction
            label={MANAGE_COPY.manageApplications}
            onPress={() =>
              router.push(
                POSITIONS_HREFS.positionApplications(detail.id) as never,
              )
            }
            testID="position-manage-applications"
          />
        ) : null}

        {detail.canEdit ? (
          <InlineAction
            icon="create-outline"
            label={MANAGE_COPY.editAction}
            onPress={() => openEditor(null)}
            testID="position-manage-edit"
          />
        ) : null}

        {/* §7: «Sola consultazione» è un'indicazione discreta, non un
            avviso. Compare solo quando non c'è davvero nessuna azione. */}
        {!detail.canEdit && !detail.canPublish ? (
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
                onPress={() => openEditor(item.anchor)}
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
            onPress={() => openEditor(firstMissingAnchor(detail))}
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
    </View>
  );
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
  icon,
  label,
  onPress,
  testID,
}: {
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

      {icon ? null : (
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
