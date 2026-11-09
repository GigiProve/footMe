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
 *
 * DAS-REV-31 §17, §20 (screen 19): «Elimina bozza» per una bozza salvata,
 * dietro la capability del server; l'edit di un evento già iniziato,
 * concluso o annullato viene rifiutato dal server e spiegato nel banner.
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
import { DeleteDraftSheet } from "../detail/components/EventLifecycleSheets";
import {
  deleteSelectionEventDraft,
  fetchSelectionEventDetail,
  signFlyerUrl,
} from "../detail/event-detail-service";
import {
  LIFECYCLE_COPY,
  lifecycleErrorCopy,
  lifecycleSignature,
} from "../detail/event-lifecycle-presentation";
import { SELECTION_EVENTS_QK, SELECTION_EVENTS_QK_PREFIXES } from "../events-keys";
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
  updateSelectionEvent,
} from "../events-service";
import type {
  ConfirmationMode,
  EventDraftValues,
  EventFlyerRef,
  ParticipationMode,
  SelectionEventTeam,
} from "../events-types";
import { BirthYearsSheet } from "./components/BirthYearsSheet";
import { CivilPickerSheet } from "./components/CivilPickerSheet";
import { EventSelectField } from "./components/EventSelectField";
import { EventStepHeader } from "./components/EventStepHeader";
import { EventTeamSheet } from "./components/EventTeamSheet";
import { EDIT_HEADER_COPY, EventEditHeader } from "./components/EventEditHeader";
import { EventFlyerField } from "./components/EventFlyerField";
import { FlyerUploadError, pickFlyerImage, uploadFlyer } from "./event-flyer-service";
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
  const params = useLocalSearchParams<{ eventId?: string; mode?: string; step?: string }>();
  const routeEventId =
    typeof params.eventId === "string" && params.eventId ? params.eventId : null;
  /* DAS-REV-29 §8, screen 02: modifica di un evento esistente nello stesso
     wizard a tre passaggi, aperto sul passaggio richiesto. */
  const editMode = params.mode === "edit" && routeEventId !== null;
  const routeStep: ComposeStep | null =
    params.step === "1" || params.step === "2" || params.step === "3"
      ? (Number(params.step) as ComposeStep)
      : null;

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
  const [exitWith, setExitWith] = useState<
    "saved" | "published" | "updated" | "revoked" | "deleted" | null
  >(null);
  /* DAS-REV-31 §17, screen 19: conferma ed esecuzione di «Elimina bozza». */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /**
   * DAS-REV-29 §8: gli asset locandina noti a questo form (salvato e appena
   * caricati), con l'anteprima locale di quelli nuovi. Il form conserva solo
   * l'ID in `values.flyerMediaId`: patch, dirty e merge lo trattano come ogni
   * altro campo.
   */
  const [flyers, setFlyers] = useState<Record<string, EventFlyerRef & { localUri?: string }>>({});
  const [flyerUploading, setFlyerUploading] = useState(false);
  const [flyerError, setFlyerError] = useState<string | null>(null);

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

  /**
   * DAS-REV-31 §17: «Elimina bozza» segue la capability `can_delete_draft`
   * che il server espone sul dettaglio canonico (draft ∧ create|manage).
   * L'editor non la porta e dedurla da `can_edit` ricostruirebbe un
   * permesso nel client: si legge il dettaglio, solo per le bozze.
   */
  const draftDetailQuery = useQuery({
    enabled: !!actorId && editor?.status === "draft",
    queryFn: () => fetchSelectionEventDetail({ eventId: editor?.id ?? "" }),
    queryKey: SELECTION_EVENTS_QK.detail(actorId, editor?.id ?? ""),
    retry: false,
    staleTime: 0,
  });
  const canDeleteDraft =
    editor?.status === "draft" && !!draftDetailQuery.data?.management?.canDeleteDraft;
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
    if (editor.flyer) {
      setFlyers({ [editor.flyer.id]: editor.flyer });
    }
    setStep(
      editMode && routeStep
        ? routeStep
        : Object.keys(stepErrors(1, editor.values, limits)).length > 0
          ? 1
          : Object.keys(stepErrors(2, editor.values, limits)).length > 0
            ? 2
            : 3,
    );
    setHydrated(true);
  }

  const currentFlyer = values.flyerMediaId ? (flyers[values.flyerMediaId] ?? null) : null;
  const flyerSignedQuery = useQuery({
    enabled: !!currentFlyer && !currentFlyer.localUri && !!actorId,
    queryFn: () => signFlyerUrl(currentFlyer?.path ?? ""),
    queryKey: SELECTION_EVENTS_QK.flyerUrl(actorId, currentFlyer?.path ?? ""),
    staleTime: 30 * 60 * 1000,
  });

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
    if (exitWith === null || (dirty && exitWith !== "revoked" && exitWith !== "deleted")) {
      return;
    }

    /* DAS-REV-31 §17: la bozza non esiste più; si torna al Centro senza
       chiedere di salvare modifiche a un record eliminato. */
    if (exitWith === "deleted") {
      leave();

      return;
    }

    if (exitWith === "revoked") {
      showToast({ message: EVENTS_COPY.accessRevoked, tone: "neutral" });
      router.replace("/(tabs)/dashboard" as never);

      return;
    }

    showToast({
      message:
        exitWith === "published"
          ? EVENTS_COPY.published
          : exitWith === "updated"
            ? EVENTS_COPY.updated
            : EVENTS_COPY.draftSaved,
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

      /* DAS-REV-31 §15, §20: l'edit si chiude all'inizio; un evento concluso
         o annullato non si modifica. Stato di dominio, non errore di rete:
         il form resta con i dati, il banner dice perché. */
      if (
        error.code === "SELECTION_EVENT_STARTED" ||
        error.code === "SELECTION_EVENT_COMPLETED" ||
        error.code === "SELECTION_EVENT_CANCELLED"
      ) {
        setBanner(lifecycleErrorCopy(error, "delete").message);
        void editorQuery.refetch();

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
    [actorId, centerQuery, editorQuery, eventId, invalidateCenter, queryClient, step, teamsQuery],
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

  /**
   * DAS-REV-29 §8: «Il tap Salva in modifica applica solo i cambi consentiti
   * dopo validazione dell'intero patch; non pubblica una bozza e non salta i
   * guard di attività/capienza.» Il comando è `update_selection_event`, che
   * applica quei guard; la validazione client è quella strutturale della
   * bozza, il resto torna dal server come errori per campo.
   */
  const saveChanges = useCallback(async () => {
    if (busy || !limits || !eventId || version === null || flyerUploading) {
      return;
    }

    const invalid = draftErrors(values, limits);

    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      setStep(firstStepWithError(invalid) ?? step);

      return;
    }

    const patch = buildPatch(values, baseline);

    if (Object.keys(patch).length === 0) {
      leave();

      return;
    }

    setBusy("save");
    setBanner(null);

    try {
      const result = await updateSelectionEvent({
        eventId,
        expectedVersion: version,
        idempotencyKey: operationKeyOf(nonce, commandSignature({ eventId, kind: "save", patch, version })),
        patch,
      });

      setVersion(result.version);
      setBaseline(values);
      for (const prefix of SELECTION_EVENTS_QK_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }
      setExitWith("updated");
    } catch (error) {
      handleFailure(error, "save");
    } finally {
      setBusy(null);
    }
  }, [baseline, busy, eventId, flyerUploading, handleFailure, leave, limits, nonce, queryClient, step, values, version]);

  /**
   * Scelta e caricamento della locandina (§8). Il riferimento entra nel form
   * solo ad asset pronto; fino ad allora resta quello di prima. Un errore non
   * tocca il resto del form e si può proseguire senza immagine.
   */
  const chooseFlyer = useCallback(async () => {
    if (!clubId || !limits || flyerUploading) {
      return;
    }

    setFlyerError(null);

    try {
      const picked = await pickFlyerImage();

      if (!picked) {
        return;
      }

      setFlyerUploading(true);

      const asset = await uploadFlyer({ clubId, limits, picked });

      setFlyers((previous) => ({ ...previous, [asset.id]: { ...asset, localUri: picked.uri } }));
      update({ flyerMediaId: asset.id }, ["flyer"]);
    } catch (error) {
      const code = error instanceof FlyerUploadError ? error.code : toSelectionEventsError(error).fields[0];

      setFlyerError(
        code === "permission_denied"
          ? EVENTS_COPY.flyerPermission
          : code === "flyer_format" || code === "flyer_too_large"
            ? VALIDATION_COPY[code]
            : VALIDATION_COPY.flyer_invalid,
      );
    } finally {
      setFlyerUploading(false);
    }
  }, [clubId, flyerUploading, limits, update]);

  // ── Stati della schermata ─────────────────────────────────────────────────

  /**
   * DAS-REV-31 §17, screen 19: eliminazione della bozza salvata. Chiave
   * dall'impronta (bozza, versione vista): un retry dopo esito incerto non
   * diventa un secondo intento. Se nel frattempo la bozza è stata pubblicata
   * il server rifiuta (LIFECYCLE_CONFLICT) e il form si riallinea.
   */
  const deleteDraft = async () => {
    const id = editor?.id;

    if (!id || deleting) {
      return;
    }

    setDeleting(true);

    try {
      await deleteSelectionEventDraft({
        eventId: id,
        idempotencyKey: operationKeyOf(nonce, lifecycleSignature("delete", id, version ?? editor.version)),
      });
      setDeleteOpen(false);
      invalidateCenter();
      setExitWith("deleted");
    } catch (error) {
      const copy = lifecycleErrorCopy(error, "delete");

      if (!copy.uncertain) {
        setDeleteOpen(false);
      }

      showToast({ message: copy.message, tone: "neutral" });

      if (copy.refresh) {
        invalidateCenter();
        void editorQuery.refetch();
        void draftDetailQuery.refetch();
      }
    } finally {
      setDeleting(false);
    }
  };

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

  /* La 28 apre solo bozze; la 29 aggiunge la modifica di un PUBLISHED
     quando il server concede `can_edit` (azione `manage`). Annullati e
     conclusi restano fuori. */
  const editableStatus = editor
    ? editor.status === "draft" || (editMode && editor.status === "published")
    : true;

  if (!clubId || editorDenied || (editor && (!editor.canEdit || !editableStatus))) {
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

  /* Screen 02: solo un evento già pubblicato si modifica con «Salva»; una
     bozza aperta con lo stesso link resta nel percorso della 28. */
  const editingPublished = editMode && editor?.status === "published";
  const flyerPreviewUri = currentFlyer
    ? (currentFlyer.localUri ?? flyerSignedQuery.data ?? null)
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {editingPublished ? (
        <EventEditHeader
          onCancel={requestExit}
          onSave={() => void saveChanges()}
          saveDisabled={busy !== null || flyerUploading}
          saving={busy === "save"}
        />
      ) : (
        <ComposerNavBar
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
          onBack={requestExit}
        />
      )}

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
            {/* DAS-REV-29 §8: «Inserisci "Locandina — facoltativa" all'inizio
                del secondo passaggio»; nessun quarto step. */}
            <EventFlyerField
              error={flyerError ?? errorText("flyer")}
              hasFlyer={!!currentFlyer}
              height={currentFlyer?.height ?? null}
              onAdd={() => void chooseFlyer()}
              onRemove={() => {
                setFlyerError(null);
                update({ flyerMediaId: null }, ["flyer"]);
              }}
              previewUri={flyerPreviewUri}
              title={values.title}
              uploading={flyerUploading}
              width={currentFlyer?.width ?? null}
            />

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

        {/* DAS-REV-31 §17, screen 19: solo per una bozza salvata e solo con
            la capability del server. Azione secondaria distruttiva, in
            fondo al form: non compete con Continua / Pubblica. */}
        {canDeleteDraft && !editingPublished ? (
          <View style={styles.deleteDraft}>
            <Button
              destructive
              disabled={busy !== null || deleting}
              label={LIFECYCLE_COPY.deleteDraft}
              onPress={() => setDeleteOpen(true)}
              size="md"
              testID="event-delete-draft"
              variant="link"
            />
          </View>
        ) : null}
      </ScrollView>

      {editingPublished ? (
        <ComposerFooter
          onPrimary={step < 3 ? goNext : () => void saveChanges()}
          primaryDisabled={busy !== null || flyerUploading}
          primaryLabel={step < 3 ? EVENTS_COPY.continue : EDIT_HEADER_COPY.save}
          primaryLoading={step === 3 && busy === "save"}
          primaryTestID={step < 3 ? "event-continue" : "event-edit-save-footer"}
          secondaryLabel={step > 1 ? EVENTS_COPY.back : null}
          secondaryOnPress={() => setStep((Math.max(1, step - 1)) as ComposeStep)}
          secondaryTestID="event-step-back"
        />
      ) : (
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
      )}

      <DeleteDraftSheet
        busy={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void deleteDraft()}
        visible={deleteOpen}
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
  deleteDraft: {
    alignItems: "center",
    paddingTop: spacing[24],
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
