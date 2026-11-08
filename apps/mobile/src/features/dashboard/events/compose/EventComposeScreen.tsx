/**
 * Wizard «Crea evento» (DAS-REV-28 §13–§20, §24; screen 04–12).
 *
 * **Una route, tre step logici.** §13: «I campi dello step 1 sono
 * scrollabili come 04/05; non dividerli in uno step aggiuntivo» e
 * «Passaggi interni a selector e step non sono uscite e conservano il
 * draft». Tenere i tre step nello stato di una sola schermata è ciò che li
 * rende passaggi interni per costruzione: il guard di uscita intercetta solo
 * l'uscita dal wizard, mai un cambio di step.
 *
 * Nessun record server all'apertura (QA-031): la bozza nasce al primo
 * «Salva bozza» o «Pubblica evento», con la squadra già scelta (§13). Dopo,
 * lo stesso `eventId` viene aggiornato con la versione letta (§21).
 *
 * Le chiavi idempotenti sono derivate (nonce di sessione + impronta della
 * richiesta), come nel composer Posizioni: un retry della stessa richiesta
 * riusa la chiave e il server lo riconosce, una richiesta diversa no.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button, Radio } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { ComposerFooter } from "../../positions/compose/components/ComposerFooter";
import { ComposerNavBar } from "../../positions/compose/components/ComposerNavBar";
import { ComposerOptionSheet } from "../../positions/compose/components/ComposerOptionSheet";
import { ComposerTextField } from "../../positions/compose/components/ComposerTextField";
import {
  createSessionNonce,
  operationKeyOf,
} from "../../positions/compose/compose-operation-key";
import {
  CONFIRMATION_LABELS,
  DEADLINE_PAST_WARNING,
  EVENTS_COPY,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ORDER,
  PARTICIPATION_LABELS,
  VALIDATION_COPY,
} from "../events-copy";
import { SELECTION_EVENTS_QK } from "../events-keys";
import { formatCivilDate } from "../events-presentation";
import { SELECTION_EVENTS_HREFS } from "../events-routes";
import {
  SelectionEventsError,
  fetchSelectionEventEditor,
  fetchSelectionEventTeams,
  fetchSelectionEventsCenter,
  publishSelectionEvent,
  saveSelectionEventDraft,
  toSelectionEventsError,
} from "../events-service";
import type {
  ConfirmationMode,
  EventDraftValues,
  ParticipationMode,
  SelectionEventTeam,
} from "../events-types";
import { BirthYearsSheet } from "./components/BirthYearsSheet";
import { CivilPickerSheet } from "./components/CivilPickerSheet";
import { EventSelectField } from "./components/EventSelectField";
import { EventStepHeader } from "./components/EventStepHeader";
import { EventTeamSheet } from "./components/EventTeamSheet";
import {
  buildPatch,
  commandSignature,
  conflictingFields,
  deadlinePassed,
  draftErrors,
  emptyValues,
  errorsFromCodes,
  firstStepWithError,
  isDirty,
  mergeAfterConflict,
  publishErrors,
  stepErrors,
  yearsLabel,
  type ComposeField,
  type ComposeStep,
  type FieldErrors,
} from "./event-compose-model";

type Picker =
  | { field: "startDate" | "deadlineDate"; mode: "date" }
  | { field: "startTime" | "endTime" | "deadlineTime"; mode: "time" };

type Sheet = "type" | "team" | "years" | null;

const STEP_TITLES: Record<ComposeStep, string> = {
  1: EVENTS_COPY.stepInfo,
  2: EVENTS_COPY.stepDetails,
  3: EVENTS_COPY.stepParticipation,
};

export function EventComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ eventId?: string }>();
  const routeEventId =
    typeof params.eventId === "string" && params.eventId ? params.eventId : null;

  const [nonce] = useState(createSessionNonce);
  const [step, setStep] = useState<ComposeStep>(1);
  const [values, setValues] = useState<EventDraftValues>(emptyValues);
  /** Ultima versione salvata: base del diff e del dirty state (§20, §24). */
  const [baseline, setBaseline] = useState<EventDraftValues | null>(null);
  const [eventId, setEventId] = useState<string | null>(routeEventId);
  const [version, setVersion] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(routeEventId === null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [exitWith, setExitWith] = useState<"saved" | "published" | "revoked" | null>(null);

  // ── Letture ───────────────────────────────────────────────────────────────

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchSelectionEventsCenter(clubId as string),
    queryKey: SELECTION_EVENTS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchSelectionEventTeams(clubId as string),
    queryKey: SELECTION_EVENTS_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const editorQuery = useQuery({
    enabled: !!routeEventId && !!actorId,
    queryFn: () => fetchSelectionEventEditor(routeEventId as string),
    queryKey: SELECTION_EVENTS_QK.editor(actorId, routeEventId ?? ""),
    retry: (count, error) =>
      !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
    staleTime: 0,
  });

  const center = centerQuery.data ?? null;
  const editor = editorQuery.data ?? null;
  const limits = center?.limits;
  const timeZone = editor?.timezone ?? center?.timezone ?? "Europe/Rome";

  /* §13: «La riapertura usa lo stesso wizard e ripristina tutti i campi;
     riprendi uno step sensato.» Una volta sola per evento: un refetch non
     deve sovrascrivere ciò che l'utente sta scrivendo. */
  if (editor && !hydrated && limits) {
    setValues(editor.values);
    setBaseline(editor.values);
    setVersion(editor.version);
    setEventId(editor.id);
    setStep(
      Object.keys(stepErrors(1, editor.values, limits)).length > 0
        ? 1
        : Object.keys(stepErrors(2, editor.values, limits)).length > 0
          ? 2
          : 3,
    );
    setHydrated(true);
  }

  const dirty = isDirty(values, baseline);

  const teams = useMemo<SelectionEventTeam[]>(() => {
    const list = teamsQuery.data ?? [];

    /* §9: per una nuova bozza servono squadre in cui si può **creare**; per
       riprendere una bozza basta poterla modificare. */
    return list.filter((team) => (eventId ? team.canEdit : team.canCreate));
  }, [eventId, teamsQuery.data]);

  const teamName =
    teams.find((team) => team.id === values.teamId)?.name ??
    (editor && editor.values.teamId === values.teamId ? editor.teamName : null);

  const canPublish = editor ? editor.canPublish : Boolean(center?.canCreate);

  // ── Uscita ────────────────────────────────────────────────────────────────

  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(SELECTION_EVENTS_HREFS.center() as never);
  }, [router]);

  const requestExit = useUnsavedChangesGuard({
    isDirty: dirty && exitWith === null,
    isSaving: busy !== null,
    onLeave: leave,
    title: EVENTS_COPY.exitTitle,
  });

  /* L'uscita dopo un comando riuscito aspetta il render in cui il form non è
     più sporco, così il guard non chiede conferma per dati appena salvati. */
  useEffect(() => {
    if (exitWith === null || (dirty && exitWith !== "revoked")) {
      return;
    }

    if (exitWith === "revoked") {
      showToast({ message: EVENTS_COPY.accessRevoked, tone: "neutral" });
      router.replace("/(tabs)/dashboard" as never);

      return;
    }

    showToast({
      message: exitWith === "published" ? EVENTS_COPY.published : EVENTS_COPY.draftSaved,
      tone: "success",
    });
    leave();
  }, [dirty, exitWith, leave, router, showToast]);

  // ── Modifica dei valori ───────────────────────────────────────────────────

  const update = useCallback(
    (patch: Partial<EventDraftValues>, clears: ComposeField[] = []) => {
      setValues((previous) => ({ ...previous, ...patch }));
      setBanner(null);

      if (clears.length) {
        setErrors((previous) => {
          const next = { ...previous };
          clears.forEach((field) => delete next[field]);
          delete next.general;

          return next;
        });
      }
    },
    [],
  );

  const errorText = (field: ComposeField) => {
    const code = errors[field];

    return code ? VALIDATION_COPY[code] : null;
  };

  // ── Comandi ───────────────────────────────────────────────────────────────

  const invalidateCenter = useCallback(() => {
    if (!actorId || !clubId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["selection-events-section", actorId, clubId] });
    void queryClient.invalidateQueries({ queryKey: SELECTION_EVENTS_QK.center(actorId, clubId) });
  }, [actorId, clubId, queryClient]);

  /**
   * Un esito negativo resta nel form (§24: «dati preservati, nessun falso
   * successo»). Ogni categoria ha la sua risposta:
   *   · campo → errore inline e ritorno allo step che lo contiene;
   *   · conflitto di versione → riesame, mai overwrite (§21);
   *   · revoca → via dal form, senza lasciare dati riservati (§22);
   *   · rete/timeout → riprova con la stessa chiave, che il server riconcilia.
   */
  const handleFailure = useCallback(
    (raw: unknown, kind: "save" | "publish") => {
      const error = toSelectionEventsError(raw);


      /* Un rifiuto sul comando può riguardare solo la squadra scelta (scope
         cambiato), non tutto il Centro: si rivaluta l'accesso prima di
         chiudere il form (§24: «rivaluta accesso»). */
      if (error.code === "SELECTION_EVENT_NOT_AUTHORIZED") {
        void teamsQuery.refetch();
        void centerQuery.refetch().then((outcome) => {
          if (outcome.error instanceof SelectionEventsError && outcome.error.isAuthorization) {
            setValues(emptyValues());
            setBaseline(emptyValues());
            invalidateCenter();
            setExitWith("revoked");
          }
        });
        setErrors({ teamId: "team_not_authorized" });
        setStep(1);
        setBanner(VALIDATION_COPY.team_not_authorized);

        return;
      }

      if (error.isAuthorization) {
        setValues(emptyValues());
        setBaseline(emptyValues());
        queryClient.removeQueries({ queryKey: SELECTION_EVENTS_QK.editor(actorId, eventId ?? "") });
        invalidateCenter();
        setExitWith("revoked");

        return;
      }

      if (error.code === "SELECTION_EVENT_VERSION_CONFLICT") {
        setConflict(true);
        setBanner(EVENTS_COPY.conflict);

        return;
      }

      if (error.fields.length > 0) {
        const fieldErrors = errorsFromCodes(error.fields);

        setErrors(fieldErrors);
        setStep(firstStepWithError(fieldErrors) ?? step);
        setBanner(fieldErrors.general ? VALIDATION_COPY[fieldErrors.general] : null);

        return;
      }

      setBanner(
        error.code === "NETWORK"
          ? EVENTS_COPY.offlineAction
          : kind === "publish"
            ? EVENTS_COPY.publishError
            : EVENTS_COPY.saveError,
      );
    },
    [actorId, centerQuery, eventId, invalidateCenter, queryClient, step, teamsQuery],
  );

  /** Persiste il form come bozza; restituisce ID e versione correnti. */
  const persist = useCallback(async () => {
    if (!clubId) {
      throw new SelectionEventsError("SELECTION_EVENTS_NOT_AUTHORIZED");
    }

    const creating = !eventId;
    const patch = buildPatch(values, creating ? null : baseline);

    if (!creating && version !== null && Object.keys(patch).length === 0) {
      return { eventId: eventId as string, version };
    }

    const result = await saveSelectionEventDraft({
      clubId,
      eventId,
      expectedVersion: creating ? null : version,
      /* La creazione ha una chiave costante per sessione: un retry dopo un
         esito perso ritrova la stessa bozza anche se nel frattempo un campo
         è cambiato (§13). Gli aggiornamenti hanno una chiave per contenuto
         e versione. */
      idempotencyKey: creating
        ? operationKeyOf(nonce, "create")
        : operationKeyOf(nonce, commandSignature({ eventId, kind: "save", patch, version })),
      patch,
    });

    if (creating && result.replayed) {
      /* La bozza esisteva già: si riparte dal suo stato sul server e si
         manda solo ciò che manca, sulla versione letta. Nessun secondo
         oggetto. */
      const server = await fetchSelectionEventEditor(result.eventId);
      const rest = buildPatch(values, server.values);
      let finalVersion = server.version;

      if (Object.keys(rest).length > 0) {
        const updated = await saveSelectionEventDraft({
          clubId,
          eventId: result.eventId,
          expectedVersion: server.version,
          idempotencyKey: operationKeyOf(
            nonce,
            commandSignature({ eventId: result.eventId, kind: "save", patch: rest, version: server.version }),
          ),
          patch: rest,
        });

        finalVersion = updated.version;
      }

      setEventId(result.eventId);
      setVersion(finalVersion);
      setBaseline(values);

      return { eventId: result.eventId, version: finalVersion };
    }

    setEventId(result.eventId);
    setVersion(result.version);
    setBaseline(values);

    return { eventId: result.eventId, version: result.version };
  }, [baseline, clubId, eventId, nonce, values, version]);

  const saveDraft = useCallback(async () => {
    if (busy || !limits) {
      return;
    }

    const invalid = draftErrors(values, limits);

    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      setStep(firstStepWithError(invalid) ?? step);

      return;
    }

    setBusy("save");
    setBanner(null);

    try {
      await persist();
      invalidateCenter();
      setExitWith("saved");
    } catch (error) {
      handleFailure(error, "save");
    } finally {
      setBusy(null);
    }
  }, [busy, handleFailure, invalidateCenter, limits, persist, step, values]);

  const publish = useCallback(async () => {
    if (busy || !limits) {
      return;
    }

    const invalid = publishErrors(values, limits, timeZone);

    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      setStep(firstStepWithError(invalid) ?? step);

      return;
    }

    setBusy("publish");
    setBanner(null);

    try {
      /* §19: «Crea/persisti un eventuale primo draft e pubblicalo in un
         intento idempotente, senza doppio oggetto.» Due comandi idempotenti
         in sequenza: se il secondo fallisce, il retry riparte dall'ID già
         salvato e non ricrea nulla. */
      const saved = await persist();

      await publishSelectionEvent({
        eventId: saved.eventId,
        expectedVersion: saved.version,
        idempotencyKey: operationKeyOf(
          nonce,
          commandSignature({ eventId: saved.eventId, kind: "publish", version: saved.version }),
        ),
      });

      invalidateCenter();
      setExitWith("published");
    } catch (error) {
      handleFailure(error, "publish");
    } finally {
      setBusy(null);
    }
  }, [busy, handleFailure, invalidateCenter, limits, nonce, persist, step, timeZone, values]);

  /**
   * §19: conflitto → riesame. Si rilegge la versione del server come nuova
   * base del diff, **senza** toccare ciò che l'utente ha scritto: il
   * prossimo salvataggio manda le sue modifiche rispetto allo stato attuale.
   */
  const reviewConflict = useCallback(async () => {
    if (!eventId) {
      return;
    }

    try {
      const latest = await fetchSelectionEventEditor(eventId);
      const startedFrom = baseline ?? emptyValues();

      setValues(mergeAfterConflict(values, startedFrom, latest.values));
      setBaseline(latest.values);
      setVersion(latest.version);
      setConflict(false);
      setBanner(
        conflictingFields(values, startedFrom, latest.values).length > 0
          ? EVENTS_COPY.conflictKeptLocal
          : null,
      );
    } catch (error) {
      handleFailure(error, "save");
    }
  }, [baseline, eventId, handleFailure, values]);

  const goNext = useCallback(() => {
    if (!limits) {
      return;
    }

    const invalid = stepErrors(step, values, limits);

    setErrors(invalid);

    if (Object.keys(invalid).length === 0 && step < 3) {
      setStep((step + 1) as ComposeStep);
    }
  }, [limits, step, values]);

  // ── Stati della schermata ─────────────────────────────────────────────────

  const shell = (content: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={center?.clubIsVerified ?? false}
        logoUrl={center?.clubLogoUrl ?? null}
        name={center?.clubName ?? ""}
        onBack={requestExit}
      />
      {content}
    </View>
  );

  const editorDenied =
    editorQuery.error instanceof SelectionEventsError && editorQuery.error.isAuthorization;

  if (!clubId || editorDenied || (editor && (!editor.canEdit || editor.status !== "draft"))) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna al Centro",
          body: EVENTS_COPY.notAuthorizedBody,
          icon: "lock-closed-outline",
          title: EVENTS_COPY.accessRevoked,
        }}
        onAction={() => router.replace(SELECTION_EVENTS_HREFS.center() as never)}
      />,
    );
  }

  if ((routeEventId && editorQuery.error) || centerQuery.error) {
    return shell(
      <DashboardGlobalError
        body={EVENTS_COPY.loadErrorBody}
        onRetry={() => {
          void centerQuery.refetch();
          void editorQuery.refetch();
        }}
        title={EVENTS_COPY.loadDraftError}
      />,
    );
  }

  if (!center || !limits || !hydrated) {
    return shell(
      <View style={styles.loading}>
        <DashboardSkeleton />
      </View>,
    );
  }

  /* §7, QA-037: zero squadre utilizzabili non è un errore di caricamento. */
  if (!routeEventId && !center.canCreate) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna al Centro",
          body: EVENTS_COPY.noTeamsAvailable,
          icon: "people-outline",
          title: EVENTS_COPY.teamsEmpty,
        }}
        onAction={() => router.replace(SELECTION_EVENTS_HREFS.center() as never)}
      />,
    );
  }

  const openPicker = (next: Picker) => {
    setPicker(next);
  };

  const pickerValue = picker ? values[picker.field] : null;
  const deadlineWarning = deadlinePassed(values, timeZone);
  const inviteOnly = values.participationMode === "invite_only";

  const summaryWhen = [
    formatCivilDate(values.startDate, { withYear: true }),
    values.startTime && values.endTime
      ? `${values.startTime}-${values.endTime}`
      : values.startTime,
  ]
    .filter(Boolean)
    .join(" · ");

  const summaryMeta = [
    summaryWhen || null,
    values.maxParticipants.trim() ? `Massimo ${values.maxParticipants.trim()} confermati` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={center.clubIsVerified}
        logoUrl={center.clubLogoUrl}
        name={center.clubName}
        onBack={requestExit}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        testID="event-compose-scroll"
      >
        <EventStepHeader step={step} title={STEP_TITLES[step]} />

        {banner ? (
          <View accessibilityRole="alert" style={styles.banner}>
            <AppText color="neutral" variant="bodySm">
              {banner}
            </AppText>
            {conflict ? (
              <Button
                label="Controlla le modifiche"
                onPress={() => void reviewConflict()}
                size="sm"
                testID="event-conflict-review"
                variant="neutralOutline"
              />
            ) : null}
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <EventSelectField
              error={errorText("eventType")}
              label={EVENTS_COPY.fieldType}
              onPress={() => setSheet("type")}
              placeholder="Seleziona"
              testID="event-field-type"
              value={values.eventType ? EVENT_TYPE_LABELS[values.eventType] : null}
            />

            <ComposerTextField
              error={errorText("title")}
              label={EVENTS_COPY.fieldTitle}
              limit={limits.title}
              multiline={false}
              onChangeText={(title) => update({ title }, ["title"])}
              optional={false}
              testID="event-field-title"
              value={values.title}
            />

            <EventSelectField
              error={errorText("teamId")}
              label={EVENTS_COPY.fieldTeam}
              onPress={() => setSheet("team")}
              placeholder="Seleziona"
              testID="event-field-team"
              value={teamName}
            />

            <EventSelectField
              error={errorText("startDate")}
              label={EVENTS_COPY.fieldDate}
              leadingIcon="calendar-outline"
              onPress={() => openPicker({ field: "startDate", mode: "date" })}
              placeholder={EVENTS_COPY.pickDate}
              testID="event-field-date"
              value={formatCivilDate(values.startDate, { withYear: true })}
            />

            <View style={styles.pair}>
              <EventSelectField
                error={errorText("startTime")}
                label={EVENTS_COPY.fieldStart}
                leadingIcon="time-outline"
                onPress={() => openPicker({ field: "startTime", mode: "time" })}
                placeholder="--:--"
                testID="event-field-start"
                value={values.startTime}
              />
              <EventSelectField
                error={errorText("endTime")}
                label={EVENTS_COPY.fieldEnd}
                leadingIcon="time-outline"
                onPress={() => openPicker({ field: "endTime", mode: "time" })}
                placeholder="--:--"
                testID="event-field-end"
                value={values.endTime}
              />
            </View>

            {values.endTime ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => update({ endTime: null }, ["endTime"])}
                style={styles.link}
                testID="event-end-clear"
              >
                <AppText color="accent" variant="actionLabel">
                  Rimuovi ora di fine
                </AppText>
              </Pressable>
            ) : null}

            <AppText color="neutral" style={styles.group} variant="titleSm">
              {EVENTS_COPY.sectionVenue}
            </AppText>

            <ComposerTextField
              error={errorText("venueName")}
              label={EVENTS_COPY.fieldVenue}
              limit={limits.venueName}
              multiline={false}
              onChangeText={(venueName) => update({ venueName }, ["venueName"])}
              optional={false}
              testID="event-field-venue"
              value={values.venueName}
            />

            <ComposerTextField
              error={errorText("venueAddress")}
              label={EVENTS_COPY.fieldAddress}
              limit={limits.venueAddress}
              multiline={false}
              onChangeText={(venueAddress) => update({ venueAddress }, ["venueAddress"])}
              optional={false}
              testID="event-field-address"
              value={values.venueAddress}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <ComposerTextField
              error={errorText("description")}
              label={EVENTS_COPY.fieldDescription}
              limit={limits.description}
              onChangeText={(description) => update({ description }, ["description"])}
              optional={false}
              testID="event-field-description"
              value={values.description}
            />

            <ComposerTextField
              error={errorText("requirements")}
              label={EVENTS_COPY.fieldRequirements}
              limit={limits.requirements}
              onChangeText={(requirements) => update({ requirements }, ["requirements"])}
              optional={false}
              testID="event-field-requirements"
              value={values.requirements}
            />

            <EventSelectField
              error={errorText("years")}
              label={EVENTS_COPY.fieldYears}
              onPress={() => setSheet("years")}
              placeholder={EVENTS_COPY.yearsNone}
              testID="event-field-years"
              value={yearsLabel(values.birthYearFrom, values.birthYearTo)}
            />
            <AppText color="neutralMuted" variant="meta">
              {EVENTS_COPY.yearsHelper}
            </AppText>

            <ComposerTextField
              error={errorText("maxParticipants")}
              keyboardType="number-pad"
              label={EVENTS_COPY.fieldCapacity}
              limit={6}
              multiline={false}
              onChangeText={(maxParticipants) =>
                update({ maxParticipants: maxParticipants.replace(/[^\d]/g, "") }, ["maxParticipants"])
              }
              optional
              testID="event-field-capacity"
              value={values.maxParticipants}
            />
            <AppText color="neutralMuted" variant="meta">
              {EVENTS_COPY.capacityHelper}
            </AppText>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <AppText color="neutralMuted" style={styles.group} variant="meta">
              {EVENTS_COPY.fieldMode}
            </AppText>
            <View accessibilityRole="radiogroup">
              {(["open_registration", "invite_only"] as ParticipationMode[]).map((mode) => (
                <ChoiceRow
                  checked={values.participationMode === mode}
                  helper={PARTICIPATION_LABELS[mode].helper}
                  key={mode}
                  label={PARTICIPATION_LABELS[mode].label}
                  onPress={() =>
                    update({ participationMode: mode }, ["participationMode", "confirmationMode", "deadline"])
                  }
                  testID={`event-mode-${mode}`}
                />
              ))}
            </View>
            {errorText("participationMode") ? (
              <AppText accessibilityRole="alert" color="danger" variant="meta">
                {errorText("participationMode")}
              </AppText>
            ) : null}

            {/* §17: con Solo su invito conferma e termine spariscono anche
                dal focus e dall'albero di accessibilità — non vengono
                renderizzati affatto. */}
            {values.participationMode === "open_registration" ? (
              <View testID="event-open-config">
                <AppText color="neutralMuted" style={styles.group} variant="meta">
                  {EVENTS_COPY.fieldConfirmation}
                </AppText>
                <View accessibilityRole="radiogroup">
                  {(["automatic", "manual"] as ConfirmationMode[]).map((mode) => (
                    <ChoiceRow
                      checked={values.confirmationMode === mode}
                      helper={CONFIRMATION_LABELS[mode].helper}
                      key={mode}
                      label={CONFIRMATION_LABELS[mode].label}
                      onPress={() => update({ confirmationMode: mode }, ["confirmationMode"])}
                      testID={`event-confirmation-${mode}`}
                    />
                  ))}
                </View>
                {errorText("confirmationMode") ? (
                  <AppText accessibilityRole="alert" color="danger" variant="meta">
                    {errorText("confirmationMode")}
                  </AppText>
                ) : null}

                <AppText color="neutralMuted" style={styles.group} variant="meta">
                  {EVENTS_COPY.fieldDeadline}
                </AppText>
                <View style={styles.pair}>
                  <EventSelectField
                    error={errorText("deadline")}
                    label={EVENTS_COPY.fieldDate}
                    leadingIcon="calendar-outline"
                    onPress={() => openPicker({ field: "deadlineDate", mode: "date" })}
                    placeholder={EVENTS_COPY.pickDate}
                    testID="event-field-deadline-date"
                    value={formatCivilDate(values.deadlineDate, { withYear: true })}
                  />
                  {values.deadlineDate ? (
                    <EventSelectField
                      label={EVENTS_COPY.fieldDeadlineTime}
                      leadingIcon="time-outline"
                      onPress={() => openPicker({ field: "deadlineTime", mode: "time" })}
                      placeholder="--:--"
                      testID="event-field-deadline-time"
                      value={values.deadlineTime}
                    />
                  ) : null}
                </View>
                <AppText color="neutralMuted" variant="meta">
                  {EVENTS_COPY.deadlineHelper}
                </AppText>
                {values.deadlineDate ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => update({ deadlineDate: null, deadlineTime: null }, ["deadline"])}
                    style={styles.link}
                    testID="event-deadline-clear"
                  >
                    <AppText color="accent" variant="actionLabel">
                      {EVENTS_COPY.deadlineRemove}
                    </AppText>
                  </Pressable>
                ) : null}
                {deadlineWarning ? (
                  <AppText color="neutral" style={styles.warning} testID="event-deadline-past" variant="meta">
                    {DEADLINE_PAST_WARNING}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {inviteOnly && baseline?.participationMode !== "invite_only" &&
            (baseline?.confirmationMode || baseline?.deadlineDate) ? (
              <AppText color="neutralMuted" style={styles.warning} variant="meta">
                {EVENTS_COPY.inviteOnlySwitchNotice}
              </AppText>
            ) : null}

            {/* §17: «Riepilogo leggero alla fine dello step»: non un quarto
                step. */}
            <View style={styles.summary} testID="event-summary">
              <AppText color="neutral" variant="titleSm">
                {values.title.trim() || EVENTS_COPY.untitled}
              </AppText>
              <AppText color="neutralMuted" variant="meta">
                {[teamName, summaryMeta || null].filter(Boolean).join(" · ")}
              </AppText>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ComposerFooter
        inlineSecondary={
          step === 3 && !canPublish ? null : (
            <View style={styles.inlineSecondary}>
              <Button
                fullWidth
                label={EVENTS_COPY.saveDraft}
                loading={busy === "save"}
                onPress={() => void saveDraft()}
                testID="event-save-draft"
                variant="secondary"
              />
            </View>
          )
        }
        onPrimary={
          step < 3 ? goNext : canPublish ? () => void publish() : () => void saveDraft()
        }
        primaryDisabled={busy !== null}
        primaryLabel={step < 3 ? EVENTS_COPY.continue : canPublish ? EVENTS_COPY.publish : EVENTS_COPY.saveDraft}
        primaryLoading={step === 3 && busy !== null && (canPublish ? busy === "publish" : busy === "save")}
        primaryTestID={step < 3 ? "event-continue" : "event-publish"}
        secondaryLabel={step > 1 ? EVENTS_COPY.back : null}
        secondaryOnPress={() => setStep((Math.max(1, step - 1)) as ComposeStep)}
        secondaryTestID="event-step-back"
      />

      <ComposerOptionSheet
        emptyMessage=""
        onClose={() => setSheet(null)}
        onToggle={(id) => {
          update({ eventType: id as EventDraftValues["eventType"] }, ["eventType"]);
          setSheet(null);
        }}
        options={EVENT_TYPE_ORDER.map((type) => ({ id: type, label: EVENT_TYPE_LABELS[type] }))}
        selected={values.eventType ? [values.eventType] : []}
        title={EVENTS_COPY.typeSheetTitle}
        visible={sheet === "type"}
      />

      <EventTeamSheet
        error={Boolean(teamsQuery.error)}
        loading={teamsQuery.isLoading}
        onClose={() => setSheet(null)}
        onConfirm={(team) => {
          update({ teamId: team.id }, ["teamId"]);
          setSheet(null);
        }}
        onRetry={() => void teamsQuery.refetch()}
        selectedId={values.teamId}
        teams={teams}
        visible={sheet === "team"}
      />

      <BirthYearsSheet
        from={values.birthYearFrom}
        limits={limits}
        onClose={() => setSheet(null)}
        onConfirm={({ from, to }) => {
          update({ birthYearFrom: from, birthYearTo: to }, ["years"]);
          setSheet(null);
        }}
        to={values.birthYearTo}
        visible={sheet === "years"}
      />

      <CivilPickerSheet
        mode={picker?.mode ?? "date"}
        onClose={() => setPicker(null)}
        onConfirm={(value) => {
          if (!picker) {
            return;
          }

          const field = picker.field;
          const clears: ComposeField[] =
            field === "deadlineDate" || field === "deadlineTime"
              ? ["deadline"]
              : field === "startDate"
                ? ["startDate", "startTime"]
                : [field];

          update(
            field === "deadlineDate" && !values.deadlineTime
              ? { deadlineDate: value, deadlineTime: "23:59" }
              : { [field]: value },
            clears,
          );
          setPicker(null);
        }}
        title={picker?.mode === "time" ? EVENTS_COPY.pickTime : EVENTS_COPY.pickDate}
        value={pickerValue}
        visible={picker !== null}
      />
    </View>
  );
}

/** Radio con helper sotto (screen 09–11): il `Radio` condiviso non ne ha. */
function ChoiceRow({
  checked,
  helper,
  label,
  onPress,
  testID,
}: {
  checked: boolean;
  helper: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View style={styles.choice}>
      <Radio checked={checked} label={label} onPress={onPress} testID={testID} tone="brand" />
      <AppText color="neutralMuted" style={styles.choiceHelper} variant="meta">
        {helper}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    gap: spacing[8],
    marginTop: spacing[8],
    padding: spacing[12],
  },
  choice: {
    paddingVertical: spacing[4],
  },
  choiceHelper: {
    paddingLeft: spacing[32],
  },
  content: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  group: {
    paddingTop: spacing[16],
  },
  inlineSecondary: {
    flex: 1,
  },
  link: {
    alignSelf: "flex-start",
    paddingVertical: spacing[6],
  },
  loading: {
    padding: spacing[20],
  },
  pair: {
    /* A 320 pt «Ora di fine (facoltativa)» va su due righe: i riquadri si
       allineano in basso invece di ridurre il font (§27). */
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[12],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  summary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    gap: spacing[4],
    marginTop: spacing[20],
    padding: spacing[12],
  },
  warning: {
    paddingTop: spacing[8],
  },
});
