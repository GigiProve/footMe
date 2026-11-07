/**
 * Dettaglio della **propria** candidatura (DAS-REV-23, screen 01-04).
 *
 * Sostituisce il dettaglio di DAS-REV-03, che mostrava una timeline degli
 * eventi e non offriva nessun comando. §39 vieta oggi quella timeline
 * («timeline gigante degli eventi o audit log visuale») e §5 spiega perché:
 * «Il modello deve conservare tutti i cicli senza esporre una timeline
 * invasiva in lista o nel dettaglio.» Lo storico resta nel database; qui c'è
 * lo **stato corrente** e l'azione che l'utente può compiere su di esso.
 *
 * Quattro schermate del PNG, una pagina sola:
 *
 *   01  candidatura attiva     → stato + «Ritira candidatura» (secondaria)
 *   02  conferma del ritiro    → sheet sopra 01
 *   03  candidatura ritirata   → stato + «Candidati di nuovo» (primaria)
 *   04  conferma del reinvio   → sheet sopra 03
 *
 * §12: «Il fondo dietro lo sheet è la candidatura ritirata dello screen 03.
 * Il nuovo invio non deve apparire già effettuato prima della conferma.» Per
 * questo non c'è nessun optimistic update: lo stato arriva dalla risposta del
 * server e dal refetch, mai dal tap (§26 — «Per i comandi sensibili di stato
 * preferisci conferma server e riconciliazione»).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../theme/tokens";
import { AppText, Avatar, Button, EmptyState, Skeleton, useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import { ApplicationStatusBlock } from "./lifecycle/components/ApplicationStatusBlock";
import { ConfirmLifecycleSheet } from "./lifecycle/components/ConfirmLifecycleSheet";
import { PersonalApplicationHeader } from "./lifecycle/components/PersonalApplicationHeader";
import {
  ApplicationUnavailableError,
  fetchMyApplicationDetail,
  operationKey,
  reapplyToPosition,
  withdrawApplication,
  type MyApplicationDetail,
} from "./lifecycle/lifecycle-service";
import {
  LIFECYCLE_COPY,
  isUncertainOutcome,
  lifecycleErrorMessage,
  personalLifecycleStatus,
} from "./lifecycle/lifecycle-presentation";
import { profileTypeLabel } from "../dashboard/applications/applications-presentation";
import { getPlayerPositionLabel } from "../profiles/player-sports";

/**
 * §26: «Aggiorna o invalida coerentemente … Attive/Concluse e count
 * personali; Nuove/Tutte e count società/Position.» Elencati e non dedotti da
 * una substring: un prefisso troppo largo invaliderebbe anche i centri degli
 * altri pack.
 */
const AFFECTED_PREFIXES = [
  "my-applications",
  "application-detail",
  "dashboard-personal",
  "dashboard-personal-applications",
  "society-applications-center",
  "society-applications-list",
  "society-position-applications",
  "society-positions-center",
  "society-positions-list",
  "society-position-detail",
  "position-detail",
  "saved-positions",
] as const;

export function MyApplicationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const params = useLocalSearchParams<{ from?: string; id?: string }>();
  const applicationId = typeof params.id === "string" ? params.id : "";

  const detailQuery = useQuery({
    enabled: !!applicationId && !!actorId,
    queryFn: () => fetchMyApplicationDetail(applicationId),
    queryKey: ["application-detail", actorId, applicationId],
    /* §27: un diniego non si ritenta all'infinito; un errore tecnico sì, una
       volta. */
    retry: (count, error) =>
      !(error instanceof ApplicationUnavailableError) && count < 1,
  });

  const detail = detailQuery.data ?? null;

  const [sheet, setSheet] = useState<"none" | "reapply" | "withdraw">("none");

  /**
   * §13: «Riutilizza l'idempotency key anche dopo timeout o retry della
   * stessa intenzione.» L'intenzione nasce all'apertura dello sheet e muore
   * quando lo stato cambia davvero: finché la conferma non ha prodotto un
   * esito certo, ogni tentativo porta la stessa chiave.
   */
  const keyRef = useRef<string | null>(null);

  const invalidate = useCallback(() => {
    for (const prefix of AFFECTED_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }, [queryClient]);

  const onCommandError = useCallback(
    (error: unknown, fallback: string) => {
      /* §27: «Un timeout dopo l'invio è un esito potenzialmente incerto …
         non indurre un nuovo invio con una nuova key mentre il precedente
         potrebbe essere riuscito.» La chiave resta, e il refetch dirà com'è
         finita. */
      if (isUncertainOutcome(error)) {
        showToast({
          icon: "time-outline",
          id: "application-lifecycle-pending",
          message: LIFECYCLE_COPY.pendingOutcome,
        });
        void detailQuery.refetch();

        return;
      }

      /* Errore certo: una nuova intenzione avrà una nuova chiave. */
      keyRef.current = null;
      showToast({
        icon: "alert-circle-outline",
        id: "application-lifecycle-error",
        message: lifecycleErrorMessage(error, fallback),
      });
      void detailQuery.refetch();
    },
    [detailQuery, showToast],
  );

  const withdraw = useMutation({
    mutationFn: () => {
      const current = detail as MyApplicationDetail;

      keyRef.current =
        keyRef.current ??
        operationKey("withdraw", current.id, current.submissionRevision);

      return withdrawApplication({
        applicationId: current.id,
        expectedRevision: current.submissionRevision,
        operationKey: keyRef.current,
      });
    },
    onError: (error) => onCommandError(error, LIFECYCLE_COPY.withdrawFailed),
    onSuccess: (result) => {
      keyRef.current = null;
      setSheet("none");
      invalidate();
      void detailQuery.refetch();

      /* §11: «Al successo chiudi lo sheet e aggiorna lo stesso dettaglio,
         senza pagina celebrativa. Feedback discreto.» Un replay non è un
         nuovo ritiro, ma per chi guarda l'esito è lo stesso: la candidatura
         è ritirata. */
      if (result.state === "withdrawn") {
        showToast({
          icon: "checkmark-circle-outline",
          id: "application-withdrawn",
          message: LIFECYCLE_COPY.withdrawDone,
        });

        return;
      }

      /* La ricevuta diceva «fatto», la proiezione corrente dice altro: lo
         stato è cambiato altrove (§26). */
      showToast({
        icon: "information-circle-outline",
        id: "application-changed",
        message: LIFECYCLE_COPY.changedElsewhere,
      });
    },
  });

  const reapply = useMutation({
    mutationFn: () => {
      const current = detail as MyApplicationDetail;

      keyRef.current =
        keyRef.current ??
        operationKey("apply", current.id, current.submissionRevision);

      return reapplyToPosition({
        adId: current.adId,
        expectedRevision: current.submissionRevision,
        operationKey: keyRef.current,
      });
    },
    onError: (error) => onCommandError(error, LIFECYCLE_COPY.applyFailed),
    onSuccess: (result) => {
      keyRef.current = null;
      setSheet("none");
      invalidate();
      void detailQuery.refetch();

      showToast({
        icon:
          result.state === "active"
            ? "checkmark-circle-outline"
            : "information-circle-outline",
        id: "application-reapplied",
        /* §12: «Al successo torna al dettaglio personale della stessa
           candidatura, ora attiva.» Siamo già lì: non si naviga. */
        message:
          result.state === "active"
            ? LIFECYCLE_COPY.applyDone
            : LIFECYCLE_COPY.changedElsewhere,
      });
    },
  });

  const busy = withdraw.isPending || reapply.isPending;

  /* §10: «Annulla, back o chiusura prima della conferma non eseguono il
     ritiro.» E una richiesta già partita non si annulla chiudendo la UI: lo
     sheet si chiude, il comando prosegue e il risultato arriva comunque. */
  const closeSheet = useCallback(() => setSheet("none"), []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard/my-applications" as never);
  }, [router]);

  /**
   * §13: «Una nuova intenzione dopo un successivo cambio di stato deve avere
   * una nuova operazione e una precondizione aggiornata.»
   *
   * Una chiave coniata sulla revisione 2 non descrive più l'intenzione di
   * ritirare la revisione 3: riusarla produrrebbe un conflitto di contenuto
   * invece del comando che l'utente ha appena chiesto.
   */
  const revision = detail?.submissionRevision ?? null;
  const keyRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    if (keyRevisionRef.current !== revision) {
      keyRevisionRef.current = revision;
      keyRef.current = null;
    }
  }, [revision]);

  // ── Render ────────────────────────────────────────────────────────────────

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PersonalApplicationHeader onBack={goBack} title="Le mie candidature" />
      {body}
    </View>
  );

  /* §23, screen 12: lo stesso stato generico per «non autorizzata» e «non più
     disponibile», senza nessun dato della candidatura sotto. */
  if (detailQuery.error instanceof ApplicationUnavailableError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <PersonalApplicationHeader
          onBack={() => router.replace("/(tabs)/dashboard" as never)}
          title="Dashboard"
        />
        {/* §23: lo stato occupa la pagina e non lascia sopra di sé un
            contenitore vuoto dove c'era la candidatura. */}
        <View style={styles.center}>
          <EmptyState
            action={
              <Button
                label={LIFECYCLE_COPY.backToDashboard}
                onPress={() => router.replace("/(tabs)/dashboard" as never)}
                size="md"
                variant="primary"
              />
            }
            description={LIFECYCLE_COPY.unavailableBody}
            icon="lock-closed-outline"
            title={LIFECYCLE_COPY.unavailableTitle}
          />
        </View>
      </View>
    );
  }

  if (detailQuery.isLoading && !detail) {
    return shell(
      <View style={styles.loader}>
        <Skeleton.Row />
        <Skeleton.Row />
        <Skeleton.Row style={styles.skeletonShort} />
      </View>,
    );
  }

  if (!detail) {
    return shell(
      <View style={styles.center}>
        <EmptyState
          action={
            <Button
              label="Riprova"
              onPress={() => void detailQuery.refetch()}
              size="md"
              variant="neutralOutline"
            />
          }
          description="Riprova tra poco."
          icon="cloud-offline-outline"
          title="Impossibile caricare la candidatura"
        />
      </View>,
    );
  }

  const status = personalLifecycleStatus({
    canApply: detail.canApply,
    latestSubmittedAt: detail.latestSubmittedAt,
    receivingOpen: detail.receivingOpen,
    state: detail.state,
    withdrawnAt: detail.withdrawnAt,
  });

  const positionContext = [detail.teamLabel, detail.categoryLabel]
    .filter(Boolean)
    .join(" · ");

  /* §19: «Nome, avatar, situazione professionale, carriera e insight possono
     aggiornarsi»: la riga descrive la persona com'è adesso, non la ricerca a
     cui si è candidata. */
  const personMeta = [
    profileTypeLabel(detail.personRole as never),
    detail.personPosition
      ? getPlayerPositionLabel(detail.personPosition, detail.personPosition)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return shell(
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        testID="my-application-scroll"
      >
        {/* §10: «Mostra la società destinataria, il ruolo/Position, la
            squadra, lo stato e la data reali; la persona è distinta dal
            destinatario.» */}
        <View style={styles.clubRow}>
          <Avatar
            name={detail.clubName}
            size="md"
            square
            tone="ink"
            uri={detail.clubLogoUrl ?? undefined}
          />

          <View style={styles.clubBody}>
            <View style={styles.clubNameRow}>
              <AppText color="neutral" numberOfLines={1} variant="titleSm">
                {detail.clubName}
              </AppText>
              {detail.clubIsVerified ? (
                <Ionicons
                  accessibilityLabel="Società verificata"
                  color={colors.accent}
                  name="checkmark-circle"
                  size={16}
                />
              ) : null}
            </View>

            <AppText color="neutral" variant="heroName">
              {detail.roleLabel}
            </AppText>

            {positionContext ? (
              <AppText color="neutralMuted" variant="bodySm">
                {positionContext}
              </AppText>
            ) : null}
          </View>
        </View>

        <ApplicationStatusBlock
          status={status}
          testID="my-application-status"
        />

        <AppText style={styles.eyebrow} variant="eyebrow">
          {LIFECYCLE_COPY.yourApplication}
        </AppText>

        <Pressable
          accessibilityHint="Apre il tuo profilo"
          accessibilityLabel={[detail.personName, personMeta, detail.personSituation]
            .filter(Boolean)
            .join(". ")}
          accessibilityRole="button"
          onPress={() =>
            router.push(`/profile/${encodeURIComponent(detail.personId)}` as never)
          }
          style={({ pressed }) => [
            styles.personRow,
            pressed ? styles.pressed : null,
          ]}
          testID="my-application-person"
        >
          <Avatar
            name={detail.personName}
            size="md"
            uri={detail.personAvatarUrl ?? undefined}
          />

          <View style={styles.personBody}>
            <AppText color="neutral" variant="titleSm">
              {detail.personName}
            </AppText>
            {personMeta ? (
              <AppText color="neutralMuted" variant="bodySm">
                {personMeta}
              </AppText>
            ) : null}
            {detail.personSituation ? (
              <AppText color="neutralMuted" variant="bodySm">
                {detail.personSituation}
              </AppText>
            ) : null}
          </View>

          <Ionicons
            color={colors.textNeutralMuted}
            name="chevron-forward"
            size={18}
          />
        </Pressable>

        {/* §10: «Vedi posizione apre la stessa Position, senza sostituire
            l'Application nel routing.» */}
        <Pressable
          accessibilityLabel={LIFECYCLE_COPY.seePosition}
          accessibilityRole="link"
          onPress={() =>
            router.push(`/position/${encodeURIComponent(detail.adId)}` as never)
          }
          style={({ pressed }) => [
            styles.link,
            pressed ? styles.pressed : null,
          ]}
          testID="my-application-see-position"
        >
          <AppText color="accent" variant="actionLabel">
            {LIFECYCLE_COPY.seePosition}
          </AppText>
          <Ionicons color={colors.accent} name="chevron-forward" size={16} />
        </Pressable>
      </ScrollView>

      {/* §29: nel dettaglio il ritiro è **secondario outlined**; la
          ricandidatura è la primaria blu. Una sola primaria per pagina, e non
          sono mai presenti insieme. */}
      {detail.canWithdraw || detail.canApply ? (
        <View style={[styles.bar, { paddingBottom: spacing[12] + insets.bottom }]}>
          {detail.canApply ? (
            <Button
              disabled={busy}
              fullWidth
              label={LIFECYCLE_COPY.reapplyAction}
              onPress={() => setSheet("reapply")}
              size="lg"
              testID="my-application-reapply"
              variant="primary"
            />
          ) : (
            <Button
              disabled={busy}
              fullWidth
              label={LIFECYCLE_COPY.withdrawAction}
              onPress={() => setSheet("withdraw")}
              size="lg"
              testID="my-application-withdraw"
              variant="neutralOutline"
            />
          )}
        </View>
      ) : null}

      <ConfirmLifecycleSheet
        body={
          detail.receivingOpen
            ? LIFECYCLE_COPY.withdrawBodyOpen
            : LIFECYCLE_COPY.withdrawBodyClosed
        }
        busy={withdraw.isPending}
        confirmLabel={LIFECYCLE_COPY.withdrawAction}
        onCancel={closeSheet}
        onConfirm={() => withdraw.mutate()}
        parties={[
          {
            avatarName: detail.clubName,
            avatarUrl: detail.clubLogoUrl,
            meta: [positionContext || null],
            name: `${detail.roleLabel} · ${detail.clubName}`,
            square: true,
          },
        ]}
        testID="withdraw-sheet"
        title={LIFECYCLE_COPY.withdrawTitle}
        /* La visibilità è **derivata**: se lo stato cambia sotto lo sheet —
           altro dispositivo, refetch — una conferma non più applicabile non
           resta aperta, e non serve uno stato che insegua il server. */
        visible={sheet === "withdraw" && detail.canWithdraw}
      />

      <ConfirmLifecycleSheet
        body={LIFECYCLE_COPY.reapplyBody}
        bodyPlacement="after"
        busy={reapply.isPending}
        confirmLabel={LIFECYCLE_COPY.confirmApply}
        onCancel={closeSheet}
        onConfirm={() => reapply.mutate()}
        parties={[
          {
            avatarUrl: detail.personAvatarUrl,
            meta: [personMeta || null, detail.personSituation],
            name: detail.personName,
            strong: null,
          },
          {
            avatarName: detail.clubName,
            avatarUrl: detail.clubLogoUrl,
            meta: [],
            name: [detail.clubName, detail.teamLabel].filter(Boolean).join(" · "),
            square: true,
            strong: detail.roleLabel,
          },
        ]}
        testID="reapply-sheet"
        title={LIFECYCLE_COPY.reapplyTitle}
        visible={sheet === "reapply" && detail.canApply}
      />
    </>,
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
  },
  loader: {
    gap: spacing[8],
    paddingHorizontal: spacing[20],
  },
  skeletonShort: {
    width: "60%",
  },
  scroll: {
    gap: spacing[16],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  clubRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  clubBody: {
    flex: 1,
    gap: spacing[4],
  },
  clubNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  eyebrow: {
    marginBottom: -spacing[8],
  },
  personRow: {
    alignItems: "center",
    borderColor: colors.borderNeutral,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  personBody: {
    flex: 1,
    gap: spacing[4],
  },
  link: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: sizes.touchTarget,
  },
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.borderNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
});
