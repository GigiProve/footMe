/**
 * Gestisci carriera — modulo unico di Allenatore, Staff tecnico e Dirigente
 * (REV-PROF-04, REV-PROF-07, REV-PROF-10).
 *
 * Le otto schermate del mockup sono passi di un'unica sessione, non otto
 * rotte: la bozza di un'esperienza multi-stagione attraversa due schermate e
 * non ha senso che viva nell'url. Una sola rotta significa anche che tutti gli
 * entry point — CTA del Master Profile, empty state della tab Carriera,
 * modifica di un gruppo — aprono davvero lo stesso modulo, e che dentro il
 * flusso focalizzato non compare la bottom navigation.
 *
 * Regola di salvataggio, e spiega quasi tutto il file: **"Salva esperienza"
 * persiste subito**. Il riepilogo mostra quindi lo stato del server, e
 * "Conferma carriera" non ha nessuna mutation da rieseguire — chiude e basta.
 * È così che il doppio salvataggio non è prevenuto con un flag, ma reso
 * impossibile.
 *
 * Le carriere restano separate per **corsia** (`CareerLane`) e non per ruolo
 * testuale: la stessa macchina scrive su tabelle diverse a seconda di dove si
 * trova, e un'esperienza da allenatore non può finire nella carriera nello
 * staff neanche se ne condivide il ruolo.
 *
 * Le corsie aggiuntive sono una mappa, non una coppia di campi: il Dirigente
 * ne porta quattro (Allenatore, Staff tecnico, Calciatore, Altri ruoli) e
 * aggiungerle non ha aggiunto un passo al flusso — solo righe alla schermata
 * "Percorsi aggiuntivi".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, ConfirmModal, useToast } from "../../../ui";
import {
  generatePlayerEntryId,
  splitPlayerEntryBySeasonDetails,
} from "../../onboarding/career/player-career-utils";
import type { PlayerCareerEntry } from "../../onboarding/career/player-career-types";
import { CoachExperienceTypeSelector } from "../../onboarding/coach/CoachExperienceTypeSelector";
import { COACH_ROLE_OPTIONS } from "../../onboarding/coach/coach-options";
import { ProfileEditScaffold } from "../edit/ProfileEditScaffold";
import { trackProfileEvent } from "../profile-analytics";
import { searchTeams } from "../profile-service";
import {
  buildCoachExperienceGroups,
  formatSeasonLabel,
  type CoachAssignment,
  type CoachExperienceGroup,
  type CoachTemporalMode,
} from "../coach-career/coach-assignment-model";
import {
  COACH_OVERLAP_WARNING,
  createCoachDraft,
  draftFromAssignments,
  draftToAssignments,
  findDuplicateAssignments,
  hasDraftErrors,
  hasOverlappingAssignments,
  sortedDraftSeasons,
  validateSeasonRolesStep,
  validateSeasonsStep,
  validateSingleAssignmentDraft,
  type CoachDraftErrors,
  type CoachExperienceDraft,
  type CoachSeasonDraftDetail,
} from "../coach-career/coach-career-draft";
import { CoachCareerSkeleton } from "../coach-career/CoachCareerSkeleton";
import { CoachCareerSummaryStep } from "../coach-career/steps/CoachCareerSummaryStep";
import {
  CoachPlayerCareerStep,
  type CoachPlayerCareerScreen,
} from "../coach-career/steps/CoachPlayerCareerStep";
import { CoachSeasonRolesStep } from "../coach-career/steps/CoachSeasonRolesStep";
import { CoachSeasonsStep } from "../coach-career/steps/CoachSeasonsStep";
import { CoachSingleAssignmentStep } from "../coach-career/steps/CoachSingleAssignmentStep";
import {
  CAREER_MANAGER_MESSAGES,
  type AdditionalAssignmentLane,
  type AssignmentLane,
  type CareerManagerCopy,
  type CareerManagerEvents,
  type CareerPathCopy,
  type CareerPathKey,
} from "./career-manager-config";
import { AdditionalPathsStep } from "./steps/AdditionalPathsStep";
import { CareerHubStep } from "./steps/CareerHubStep";

export type CareerPersistHandlers = {
  onError: () => void;
  onSuccess: () => void;
};

/** Riferimento stabile per una corsia senza esperienze: evita un render in più. */
const EMPTY_GROUPS: readonly CoachExperienceGroup[] = [];

export type CareerManagerScreenProps = {
  /** Assegnazioni della carriera principale del profilo. */
  assignments: readonly CoachAssignment[];
  /**
   * Assegnazioni dei percorsi aggiuntivi, per corsia. Una corsia assente non è
   * una corsia vuota: non esiste per quel profilo.
   */
  pathAssignments?: Partial<
    Record<AdditionalAssignmentLane, readonly CoachAssignment[]>
  >;
  /** Tassonomia dei ruoli dei percorsi aggiuntivi, per corsia. */
  pathRoleOptions?: Partial<
    Record<AdditionalAssignmentLane, { label: string; value: string }[]>
  >;
  copy: CareerManagerCopy;
  /** Ruolo principale del profilo: **solo** prefill, mai un legame. */
  defaultRole?: string;
  events: CareerManagerEvents;
  /** Apre il modulo direttamente su una schermata diversa dall'hub. */
  initialStep?: "hub" | "paths";
  /**
   * Apre il modulo direttamente su un percorso aggiuntivo, saltando sia l'hub
   * sia la schermata "Percorsi aggiuntivi". Serve ai profili la cui carriera
   * principale vive altrove — il Procuratore (REV-PROF-15) ragiona per periodi
   * e ha il proprio modulo — ma i cui percorsi aggiuntivi sono esattamente
   * questi. Da lì il back esce dal modulo, perché non c'e nessuna schermata
   * precedente da riaprire.
   */
  initialPath?: CareerPathKey;
  /** Superficie da cui il modulo è stato aperto: un identificatore, mai un url. */
  openSource?: string;
  isError: boolean;
  isLoading: boolean;
  /** I dati sono arrivati: prima di allora si mostra solo lo skeleton. */
  isReady: boolean;
  isSaving: boolean;
  onPersistAssignments: (
    lane: AssignmentLane,
    next: CoachAssignment[],
    handlers: CareerPersistHandlers,
  ) => void;
  onPersistPlayerEntries: (
    next: PlayerCareerEntry[],
    handlers: CareerPersistHandlers,
  ) => void;
  onRetry: () => void;
  /** Percorsi aggiuntivi del profilo, nell'ordine di visualizzazione. */
  paths: readonly CareerPathCopy[];
  playerEntries: readonly PlayerCareerEntry[];
  /** Tassonomia dei ruoli della carriera principale. */
  primaryRoleOptions: { label: string; value: string }[];
  profileType: string;
  testIDPrefix: string;
};

type ManagerStep =
  | { type: "hub" }
  | { type: "paths" }
  | { type: "select-type"; lane: AssignmentLane }
  | {
      type: "seasons";
      draft: CoachExperienceDraft;
      /**
       * La bozza com'era all'apertura. Senza, una modifica riaperta e chiusa
       * subito risulterebbe "sporca" solo perché i campi sono pieni, e
       * chiederebbe conferma a chi non ha cambiato niente.
       */
      initialDraft: CoachExperienceDraft;
      isEditing: boolean;
      lane: AssignmentLane;
      /**
       * Cambiare la società di un gruppo la cambia a **tutte** le sue
       * stagioni, quindi va confermato. Senza il valore di partenza non si
       * distingue un cambio da una semplice riapertura.
       */
      originalTeamName: string;
    }
  | {
      type: "season-roles";
      draft: CoachExperienceDraft;
      initialDraft: CoachExperienceDraft;
      isEditing: boolean;
      lane: AssignmentLane;
      originalTeamName: string;
    }
  | {
      type: "single";
      draft: CoachExperienceDraft;
      initialDraft: CoachExperienceDraft;
      isEditing: boolean;
      lane: AssignmentLane;
    }
  | { type: "summary"; lane: AssignmentLane }
  | { type: "player"; screen: CoachPlayerCareerScreen };

type PendingConfirm =
  | { kind: "change-club"; draft: CoachExperienceDraft; lane: AssignmentLane }
  | { kind: "delete-group"; groupId: string; lane: AssignmentLane }
  | { kind: "delete-assignment"; assignmentId: string; lane: AssignmentLane }
  | { kind: "delete-player-entry"; index: number }
  | { kind: "remove-season"; seasonKey: string }
  | { kind: "leave" };

export function CareerManagerScreen({
  assignments,
  copy,
  defaultRole = "",
  events,
  initialPath,
  initialStep = "hub",
  isError,
  isLoading,
  isReady,
  isSaving,
  onPersistAssignments,
  onPersistPlayerEntries,
  onRetry,
  openSource,
  pathAssignments,
  pathRoleOptions,
  paths,
  playerEntries,
  primaryRoleOptions,
  profileType,
  testIDPrefix,
}: CareerManagerScreenProps) {
  const { showToast } = useToast();

  const [step, setStep] = useState<ManagerStep>(() => {
    if (!initialPath) {
      return { type: initialStep };
    }

    return initialPath === "player"
      ? { screen: { type: "list" }, type: "player" }
      : { lane: initialPath, type: "summary" };
  });
  const [errors, setErrors] = useState<CoachDraftErrors>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  /*
    Da dove è stato aperto un percorso aggiuntivo: chiuderlo deve riportare lì
    e non sempre all'hub, altrimenti chi arriva da "Percorsi aggiuntivi" perde
    il contesto a ogni salvataggio.
  */
  const [pathOrigin, setPathOrigin] = useState<"hub" | "paths" | "exit">(
    initialPath ? "exit" : initialStep === "paths" ? "paths" : "hub",
  );
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }

    openedRef.current = true;
    trackProfileEvent(events.opened, {
      profileType,
      ...(openSource ? { source: openSource } : {}),
      viewerMode: "owner",
    });

    if (initialStep === "paths" && events.pathsOpened) {
      trackProfileEvent(events.pathsOpened, { profileType });
    }

    // Aperto direttamente su un percorso: l'evento del percorso va tracciato
    // qui, perche `openPath` non viene mai attraversato.
    const directPathEvent = initialPath
      ? events.pathEvents[initialPath]?.opened
      : undefined;

    if (directPathEvent && initialPath) {
      trackProfileEvent(directPathEvent, {
        careerMode: initialPath,
        profileType,
      });
    }
  }, [
    events.opened,
    events.pathEvents,
    events.pathsOpened,
    initialPath,
    initialStep,
    openSource,
    profileType,
  ]);

  useEffect(() => {
    if (isError) {
      trackProfileEvent(events.loadFailed, { profileType });
    }
  }, [events.loadFailed, isError, profileType]);

  /*
    Assegnazioni e gruppi derivano sempre dall'ultimo dato letto, mai da una
    copia locale: un salvataggio fallito non può lasciare a schermo una
    carriera che sul server non esiste.
  */
  const laneAssignments = useCallback(
    (lane: AssignmentLane): readonly CoachAssignment[] =>
      lane === "primary" ? assignments : pathAssignments?.[lane] ?? [],
    [assignments, pathAssignments],
  );

  const groups = useMemo(
    () => buildCoachExperienceGroups(assignments),
    [assignments],
  );
  /**
   * Gruppi di ogni corsia aggiuntiva, calcolati una volta per render. Il
   * conteggio mostrato nei "Percorsi aggiuntivi" è il numero di esperienze,
   * cioè di gruppi: tre stagioni nella stessa società sono un'esperienza sola.
   */
  const pathGroups = useMemo(() => {
    const entries = Object.entries(pathAssignments ?? {}) as [
      AdditionalAssignmentLane,
      readonly CoachAssignment[],
    ][];

    return new Map(
      entries.map(([lane, laneItems]) => [
        lane,
        buildCoachExperienceGroups(laneItems),
      ]),
    );
  }, [pathAssignments]);
  const pathCounts = useMemo(
    () =>
      paths.map((pathCopy) => ({
        copy: pathCopy,
        count:
          pathCopy.key === "player"
            ? playerEntries.length
            : pathGroups.get(pathCopy.key)?.length ?? 0,
      })),
    [pathGroups, paths, playerEntries.length],
  );

  const activeDraft =
    step.type === "seasons" ||
    step.type === "season-roles" ||
    step.type === "single"
      ? step.draft
      : null;
  const activeInitialDraft =
    step.type === "seasons" ||
    step.type === "season-roles" ||
    step.type === "single"
      ? step.initialDraft
      : null;
  const activeLane: AssignmentLane =
    step.type === "seasons" ||
    step.type === "season-roles" ||
    step.type === "single" ||
    step.type === "select-type" ||
    step.type === "summary"
      ? step.lane
      : "primary";
  const laneRoleOptions =
    activeLane === "primary"
      ? primaryRoleOptions
      : pathRoleOptions?.[activeLane] ?? COACH_ROLE_OPTIONS;
  const activePathCopy =
    activeLane === "primary"
      ? undefined
      : paths.find((path) => path.key === activeLane);
  const playerPathCopy = paths.find((path) => path.key === "player");

  // ------------------------------------------------------------------
  // Persistenza
  // ------------------------------------------------------------------

  const persistAssignments = useCallback(
    (
      lane: AssignmentLane,
      next: CoachAssignment[],
      {
        failureEvent,
        failureMessage,
        onDone,
        successMessage,
      }: {
        failureEvent: "saveFailed" | "deleteFailed";
        failureMessage: string;
        onDone?: () => void;
        successMessage: string;
      },
    ) => {
      setErrorMessage(null);
      onPersistAssignments(lane, next, {
        onError: () => {
          trackProfileEvent(events[failureEvent], {
            profileType,
            success: false,
          });
          setErrorMessage(failureMessage);
        },
        onSuccess: () => {
          showToast({ message: successMessage, tone: "success" });
          onDone?.();
        },
      });
    },
    [events, onPersistAssignments, profileType, showToast],
  );

  const persistPlayerEntries = useCallback(
    (
      next: PlayerCareerEntry[],
      { onDone, successMessage }: { onDone: () => void; successMessage: string },
    ) => {
      setErrorMessage(null);
      onPersistPlayerEntries(next, {
        onError: () => {
          trackProfileEvent(events.saveFailed, {
            careerMode: "player",
            profileType,
            success: false,
          });
          setErrorMessage(CAREER_MANAGER_MESSAGES.genericError);
        },
        onSuccess: () => {
          showToast({ message: successMessage, tone: "success" });
          onDone();
        },
      });
    },
    [events.saveFailed, onPersistPlayerEntries, profileType, showToast],
  );

  // ------------------------------------------------------------------
  // Bozza
  // ------------------------------------------------------------------

  function patchDraft(patch: Partial<CoachExperienceDraft>) {
    setStep((current) =>
      current.type === "seasons" ||
      current.type === "season-roles" ||
      current.type === "single"
        ? { ...current, draft: { ...current.draft, ...patch } }
        : current,
    );
  }

  /**
   * Deselezionare una stagione già persistita cancellerebbe quella riga al
   * salvataggio: qui, e solo qui, serve una conferma. Una stagione appena
   * aggiunta nella bozza corrente (nessun id persistito) si toglie invece
   * subito, senza chiedere nulla.
   */
  function toggleSeason(seasonKey: string) {
    if (step.type !== "seasons") {
      return;
    }

    const isSelected = step.draft.seasons.includes(seasonKey);

    if (isSelected && step.draft.persistedIdBySeason[seasonKey]) {
      setPendingConfirm({ kind: "remove-season", seasonKey });
      return;
    }

    setStep((current) => {
      if (current.type !== "seasons") {
        return current;
      }

      const seasons = isSelected
        ? current.draft.seasons.filter((season) => season !== seasonKey)
        : [...current.draft.seasons, seasonKey];
      const seasonDetails = { ...current.draft.seasonDetails };

      if (isSelected) {
        delete seasonDetails[seasonKey];
      }

      return {
        ...current,
        draft: { ...current.draft, seasonDetails, seasons },
      };
    });
    setErrors((current) => ({ ...current, seasons: undefined }));
  }

  /**
   * Una stagione scrive solo la propria riga. Il prefill ha già proposto un
   * valore: da qui in avanti quella stagione vive di vita propria, e cambiarla
   * non tocca le altre.
   */
  function changeSeasonDetail(
    seasonKey: string,
    patch: Partial<CoachSeasonDraftDetail>,
  ) {
    setStep((current) => {
      if (current.type !== "season-roles") {
        return current;
      }

      const seasons = sortedDraftSeasons(current.draft);
      const index = seasons.indexOf(seasonKey);
      const previous = index > 0 ? seasons[index - 1] : undefined;
      const existing =
        current.draft.seasonDetails[seasonKey] ??
        (previous ? current.draft.seasonDetails[previous] : undefined) ?? {
          category: current.draft.category,
          role: current.draft.role,
        };

      return {
        ...current,
        draft: {
          ...current.draft,
          seasonDetails: {
            ...current.draft.seasonDetails,
            [seasonKey]: { ...existing, ...patch },
          },
        },
      };
    });
    setErrors((current) => {
      if (!current.seasonRows) {
        return current;
      }

      const { [seasonKey]: _removed, ...rest } = current.seasonRows;

      return { ...current, seasonRows: rest };
    });
  }

  // ------------------------------------------------------------------
  // Navigazione fra i passi
  // ------------------------------------------------------------------

  function startAdding(lane: AssignmentLane) {
    trackProfileEvent(
      lane === "primary"
        ? events.addTapped
        : events.pathEvents[lane]?.addTapped ?? events.addTapped,
      { profileType },
    );
    setErrors({});
    setWarning(null);
    setStep({ lane, type: "select-type" });
  }

  function selectType(lane: AssignmentLane, mode: CoachTemporalMode) {
    trackProfileEvent(events.typeSelected, {
      experienceMode: mode,
      profileType,
    });

    // Il ruolo principale precompila solo la carriera del profilo: un
    // percorso aggiuntivo non lo eredita.
    const draft = createCoachDraft(mode, {
      defaultRole: lane === "primary" ? defaultRole : "",
    });

    setErrors({});
    setStep(
      mode === "MULTI_SEASON"
        ? {
            draft,
            initialDraft: draft,
            isEditing: false,
            lane,
            originalTeamName: "",
            type: "seasons",
          }
        : { draft, initialDraft: draft, isEditing: false, lane, type: "single" },
    );
  }

  function editGroup(lane: AssignmentLane, groupId: string) {
    const draft = draftFromAssignments(
      laneAssignments(lane).filter(
        (assignment) => assignment.groupId === groupId,
      ),
    );

    if (!draft) {
      return;
    }

    trackProfileEvent(events.groupEdited, {
      experienceMode: draft.mode,
      profileType,
    });
    setErrors({});
    setWarning(null);
    setStep(
      draft.mode === "MULTI_SEASON"
        ? {
            draft,
            initialDraft: draft,
            isEditing: true,
            lane,
            originalTeamName: draft.teamName,
            type: "seasons",
          }
        : { draft, initialDraft: draft, isEditing: true, lane, type: "single" },
    );
  }

  function continueToSeasonRoles() {
    if (step.type !== "seasons") {
      return;
    }

    const nextErrors = validateSeasonsStep(step.draft);

    if (hasDraftErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    trackProfileEvent(events.seasonRolesOpened, {
      profileType,
      seasonCount: step.draft.seasons.length,
    });
    setErrors({});
    setStep({ ...step, type: "season-roles" });
  }

  // ------------------------------------------------------------------
  // Salvataggio di un'esperienza
  // ------------------------------------------------------------------

  function commitDraft(
    lane: AssignmentLane,
    draft: CoachExperienceDraft,
    isEditing: boolean,
  ) {
    const existing = laneAssignments(lane);
    const incoming = draftToAssignments(draft);
    const duplicates = findDuplicateAssignments(incoming, existing);

    if (duplicates.length > 0) {
      setErrorMessage(CAREER_MANAGER_MESSAGES.duplicate);
      return;
    }

    /*
      La sovrapposizione non blocca: si possono ricoprire più incarichi nello
      stesso periodo. L'avviso compare una volta; se l'utente conferma di
      nuovo, il salvataggio procede.
    */
    if (!warning && hasOverlappingAssignments(incoming, existing)) {
      setWarning(COACH_OVERLAP_WARNING);
      return;
    }

    const kept = existing.filter(
      (assignment) => assignment.groupId !== draft.groupId,
    );

    persistAssignments(lane, [...kept, ...incoming], {
      failureEvent: "saveFailed",
      failureMessage: CAREER_MANAGER_MESSAGES.saveError,
      onDone: () => {
        trackProfileEvent(
          isEditing ? events.experienceEdited : events.experienceSaved,
          {
            experienceMode: draft.mode,
            profileType,
            seasonCount: incoming.length,
          },
        );
        setWarning(null);
        setErrors({});
        setStep({ lane, type: "summary" });
      },
      successMessage: isEditing
        ? "Esperienza aggiornata."
        : "Esperienza aggiunta.",
    });
  }

  function saveSeasonRoles() {
    if (step.type !== "season-roles") {
      return;
    }

    const nextErrors = validateSeasonRolesStep(step.draft);

    if (hasDraftErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    const clubChanged =
      step.isEditing &&
      step.originalTeamName.trim() !== step.draft.teamName.trim();

    if (clubChanged && step.draft.seasons.length > 1) {
      setPendingConfirm({
        draft: step.draft,
        kind: "change-club",
        lane: step.lane,
      });
      return;
    }

    commitDraft(step.lane, step.draft, step.isEditing);
  }

  function saveSingleAssignment() {
    if (step.type !== "single") {
      return;
    }

    const nextErrors = validateSingleAssignmentDraft(step.draft);

    if (hasDraftErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    commitDraft(step.lane, step.draft, step.isEditing);
  }

  // ------------------------------------------------------------------
  // Eliminazioni
  // ------------------------------------------------------------------

  function confirmPending() {
    if (!pendingConfirm) {
      return;
    }

    if (pendingConfirm.kind === "delete-player-entry") {
      const index = pendingConfirm.index;

      persistPlayerEntries(
        playerEntries.filter((_, entryIndex) => entryIndex !== index),
        {
          onDone: () => {
            trackProfileEvent(events.experienceDeleted, {
              careerMode: "player",
              profileType,
            });
            setPendingConfirm(null);
            setStep({ screen: { type: "list" }, type: "player" });
          },
          successMessage: "Esperienza eliminata.",
        },
      );
      return;
    }

    if (pendingConfirm.kind === "change-club") {
      const { draft, lane } = pendingConfirm;

      setPendingConfirm(null);
      commitDraft(lane, draft, true);
      return;
    }

    if (pendingConfirm.kind === "leave") {
      const lane = activeLane;

      trackProfileEvent(events.unsavedExit, { profileType });
      setPendingConfirm(null);
      // Un avviso o un errore mostrato durante la bozza riguarda solo quella
      // bozza: non deve restare a schermo una volta tornati all'hub.
      setWarning(null);
      setErrorMessage(null);
      // Uscire da una bozza riporta dove si stava: l'hub per la carriera del
      // profilo, il riepilogo del percorso per un percorso aggiuntivo.
      setStep(lane === "primary" ? { type: "hub" } : { lane, type: "summary" });
      return;
    }

    if (pendingConfirm.kind === "remove-season") {
      const seasonKey = pendingConfirm.seasonKey;

      setStep((current) => {
        if (current.type !== "season-roles" && current.type !== "seasons") {
          return current;
        }

        const { [seasonKey]: _removed, ...seasonDetails } =
          current.draft.seasonDetails;

        return {
          ...current,
          draft: {
            ...current.draft,
            seasonDetails,
            seasons: current.draft.seasons.filter(
              (season) => season !== seasonKey,
            ),
          },
        };
      });
      setPendingConfirm(null);
      return;
    }

    const lane = pendingConfirm.lane;
    const existing = laneAssignments(lane);
    const isGroup = pendingConfirm.kind === "delete-group";
    const next = isGroup
      ? existing.filter(
          (assignment) => assignment.groupId !== pendingConfirm.groupId,
        )
      : existing.filter(
          (assignment) => assignment.id !== pendingConfirm.assignmentId,
        );

    persistAssignments(lane, [...next], {
      failureEvent: "deleteFailed",
      failureMessage: CAREER_MANAGER_MESSAGES.deleteError,
      onDone: () => {
        trackProfileEvent(
          isGroup ? events.groupDeleted : events.experienceDeleted,
          { profileType },
        );
        setPendingConfirm(null);
        setStep(lane === "primary" ? { type: "hub" } : { lane, type: "summary" });
      },
      successMessage: "Esperienza eliminata.",
    });
  }

  // ------------------------------------------------------------------
  // Percorso da calciatore
  // ------------------------------------------------------------------

  function savePlayerEntry(saved: PlayerCareerEntry) {
    if (step.type !== "player" || step.screen.type !== "form") {
      return;
    }

    const editIndex = step.screen.editIndex;
    const split = splitPlayerEntryBySeasonDetails(saved);
    const next =
      editIndex === null
        ? [...playerEntries, ...split]
        : [
            ...playerEntries.slice(0, editIndex),
            ...split,
            ...playerEntries.slice(editIndex + 1),
          ];

    persistPlayerEntries(next, {
      onDone: () => setStep({ screen: { type: "list" }, type: "player" }),
      successMessage:
        editIndex === null ? "Esperienza aggiunta." : "Esperienza aggiornata.",
    });
  }

  // ------------------------------------------------------------------
  // Percorsi aggiuntivi
  // ------------------------------------------------------------------

  function openPath(path: CareerPathKey, origin: "hub" | "paths") {
    setPathOrigin(origin);
    setErrors({});
    setWarning(null);

    const opened = events.pathEvents[path]?.opened;

    if (path === "player") {
      if (opened) {
        trackProfileEvent(opened, { careerMode: "player", profileType });
      }

      setStep({ screen: { type: "list" }, type: "player" });
      return;
    }

    if (opened) {
      trackProfileEvent(opened, { careerMode: path, profileType });
    }

    // Nessun hub ricorsivo: un percorso aggiuntivo si apre sul proprio
    // riepilogo, che è anche il punto da cui si aggiunge.
    setStep({ lane: path, type: "summary" });
  }

  // ------------------------------------------------------------------
  // Uscita
  // ------------------------------------------------------------------

  /*
    Lo stato sporco è un confronto, non una somma di campi pieni: società,
    stagioni, ruolo, categoria, date, toggle e descrizione entrano tutti nella
    firma, quindi aggiungere un campo alla bozza non lascia indietro il
    controllo delle modifiche non salvate.
  */
  const isDraftDirty = Boolean(
    activeDraft &&
      activeInitialDraft &&
      draftSignature(activeDraft) !== draftSignature(activeInitialDraft),
  );

  function handleBack() {
    if (isSaving) {
      return;
    }

    if (step.type === "season-roles") {
      setErrors({});
      setStep({ ...step, type: "seasons" });
      return;
    }

    if (activeDraft) {
      const lane = activeLane;

      if (isDraftDirty) {
        setPendingConfirm({ kind: "leave" });
        return;
      }

      trackProfileEvent(events.cancelled, {
        experienceMode: activeDraft.mode,
        profileType,
      });
      // Come per il ramo "leave" di confirmPending: un avviso o un errore
      // della bozza non deve restare a schermo una volta usciti da essa.
      setWarning(null);
      setErrorMessage(null);
      setStep(lane === "primary" ? { type: "hub" } : { lane, type: "summary" });
      return;
    }

    if (step.type === "player" && step.screen.type !== "list") {
      setStep({ screen: { type: "list" }, type: "player" });
      return;
    }

    if (step.type === "select-type") {
      setStep(
        step.lane === "primary"
          ? { type: "hub" }
          : { lane: step.lane, type: "summary" },
      );
      return;
    }

    if (step.type === "summary" && step.lane !== "primary") {
      leavePath();
      return;
    }

    if (step.type === "player") {
      leavePath();
      return;
    }

    if (step.type === "paths" && initialStep === "paths") {
      router.back();
      return;
    }

    if (step.type !== "hub") {
      setStep({ type: "hub" });
      return;
    }

    router.back();
  }

  /**
   * Torna alla schermata da cui il percorso aggiuntivo è stato aperto. Quando
   * il modulo era stato aperto direttamente su quel percorso non c'è nessuna
   * schermata precedente: si esce, e chi ha aperto il percorso aggiorna i
   * propri conteggi al rientro.
   */
  function leavePath() {
    if (pathOrigin === "exit") {
      router.back();
      return;
    }

    setStep({ type: pathOrigin });
  }

  /** Chiude la sessione, oppure il solo sotto-flusso quando è un percorso. */
  function finishStep() {
    if (step.type === "summary" && step.lane !== "primary") {
      leavePath();
      return;
    }

    if (step.type === "player") {
      leavePath();
      return;
    }

    trackProfileEvent(events.completed, { profileType });
    router.back();
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const scaffold = resolveScaffold();

  function resolveScaffold(): {
    saveDisabled?: boolean;
    saveLabel?: string;
    secondaryLabel?: string;
    stepLabel?: string;
    title: string;
    onSave?: () => void;
    onSecondary?: () => void;
  } {
    switch (step.type) {
      case "select-type":
        return {
          title:
            step.lane === "primary"
              ? copy.typeSelectorTitle
              : activePathCopy?.typeSelectorTitle ??
                activePathCopy?.appBarTitle ??
                copy.typeSelectorTitle,
        };
      case "seasons":
        return {
          onSave: continueToSeasonRoles,
          onSecondary: handleBack,
          saveDisabled:
            !step.draft.teamName.trim() || step.draft.seasons.length === 0,
          saveLabel: "Continua",
          secondaryLabel: "Annulla",
          stepLabel: "1 di 2",
          title: "Più stagioni complete",
        };
      case "season-roles":
        return {
          onSave: saveSeasonRoles,
          onSecondary: () => setStep({ ...step, type: "seasons" }),
          saveLabel: "Salva esperienza",
          secondaryLabel: "Indietro",
          stepLabel: "2 di 2",
          title: "Ruolo per stagione",
        };
      case "single":
        return {
          onSave: saveSingleAssignment,
          onSecondary: handleBack,
          saveLabel: "Salva esperienza",
          secondaryLabel: "Annulla",
          title:
            step.draft.mode === "CUSTOM_PERIOD"
              ? "Periodo personalizzato"
              : "Singola stagione",
        };
      case "summary":
        return step.lane === "primary"
          ? {
              onSave: finishStep,
              saveLabel: "Conferma carriera",
              title: "Le tue esperienze",
            }
          : {
              onSave: finishStep,
              saveLabel: "Fine",
              title: activePathCopy?.appBarTitle ?? "Percorso aggiuntivo",
            };
      case "paths":
        return { onSave: finishStep, saveLabel: "Fine", title: "Percorsi aggiuntivi" };
      case "player":
        return step.screen.type === "list"
          ? {
              onSave: finishStep,
              saveLabel: "Fine",
              title: playerPathCopy?.appBarTitle ?? "Carriera da calciatore",
            }
          : { title: playerPathCopy?.appBarTitle ?? "Carriera da calciatore" };
      default:
        return {
          onSave: finishStep,
          saveLabel: "Fine",
          title: copy.hubTitle,
        };
    }
  }

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      notice={warning}
      onBack={handleBack}
      onSave={scaffold.onSave}
      onSecondary={scaffold.onSecondary}
      saveDisabled={scaffold.saveDisabled}
      saveLabel={scaffold.saveLabel}
      saving={isSaving}
      secondaryLabel={scaffold.secondaryLabel}
      stepLabel={scaffold.stepLabel}
      testID={`${testIDPrefix}-career-manager`}
      title={scaffold.title}
    >
      {isLoading ? (
        <CoachCareerSkeleton testID={`${testIDPrefix}-career-skeleton`} />
      ) : null}

      {isError ? (
        <View style={styles.loadError} testID={`${testIDPrefix}-career-load-error`}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare la tua carriera.
          </AppText>
          <Button label="Riprova" onPress={onRetry} size="sm" variant="outline" />
        </View>
      ) : null}

      {isReady && step.type === "hub" ? (
        <CareerHubStep
          additionalEyebrow={copy.additionalEyebrow}
          emptyText={copy.primaryEmptyText}
          emptyTitle={copy.primaryEmptyTitle}
          eyebrow={copy.primaryEyebrow}
          groups={groups}
          onAddExperience={() => startAdding("primary")}
          onEditGroup={(groupId) => editGroup("primary", groupId)}
          onOpenPath={(path) => openPath(path, "hub")}
          paths={pathCounts}
          testIDPrefix={testIDPrefix}
        />
      ) : null}

      {isReady && step.type === "paths" ? (
        <AdditionalPathsStep
          description={
            copy.additionalDescription ??
            `Aggiungi eventuali esperienze da allenatore o calciatore. Rimarranno separate dalla ${copy.primaryEyebrow.toLowerCase()}.`
          }
          onOpenPath={(path) => openPath(path, "paths")}
          paths={pathCounts}
          testIDPrefix={testIDPrefix}
        />
      ) : null}

      {isReady && step.type === "select-type" ? (
        <CoachExperienceTypeSelector
          onSelect={(mode) => selectType(step.lane, mode)}
          options={buildTypeOptions(copy.customPeriodSubtitle)}
          subtitle="Scegli come vuoi inserire questa esperienza."
          title="Aggiungi esperienza"
        />
      ) : null}

      {isReady && step.type === "seasons" ? (
        <CoachSeasonsStep
          draft={step.draft}
          errors={errors}
          onChangeDraft={patchDraft}
          onToggleSeason={toggleSeason}
          searchTeams={searchTeams}
          teamLabel={copy.teamLabel}
          teamPlaceholder={copy.teamPlaceholder}
          testIDPrefix={testIDPrefix}
        />
      ) : null}

      {isReady && step.type === "season-roles" ? (
        <>
          <CoachSeasonRolesStep
            draft={step.draft}
            errors={errors}
            onChangeSeasonDetail={changeSeasonDetail}
            onRemoveSeason={
              step.isEditing
                ? (seasonKey) =>
                    setPendingConfirm({ kind: "remove-season", seasonKey })
                : undefined
            }
            roleOptions={laneRoleOptions}
            testIDPrefix={testIDPrefix}
          />
          {step.isEditing ? (
            <DeleteAction
              onPress={() =>
                setPendingConfirm({
                  groupId: step.draft.groupId,
                  kind: "delete-group",
                  lane: step.lane,
                })
              }
              testID={`${testIDPrefix}-career-delete`}
            />
          ) : null}
        </>
      ) : null}

      {isReady && step.type === "single" ? (
        <>
          <CoachSingleAssignmentStep
            descriptionLabel={copy.descriptionLabel}
            descriptionPlaceholder={copy.descriptionPlaceholder}
            draft={step.draft}
            errors={errors}
            onChangeDraft={patchDraft}
            periodHelpMessage={copy.periodHelpMessage}
            roleOptions={laneRoleOptions}
            searchTeams={searchTeams}
            showDescription={copy.showDescription}
            teamLabel={copy.teamLabel}
            teamPlaceholder={copy.teamPlaceholder}
            testIDPrefix={testIDPrefix}
          />
          {step.isEditing && step.draft.persistedId ? (
            <DeleteAction
              label="Elimina esperienza"
              onPress={() =>
                setPendingConfirm({
                  assignmentId: step.draft.persistedId as string,
                  kind: "delete-assignment",
                  lane: step.lane,
                })
              }
              testID={`${testIDPrefix}-career-delete`}
            />
          ) : null}
        </>
      ) : null}

      {isReady && step.type === "summary" ? (
        <CoachCareerSummaryStep
          emptyCtaLabel={activePathCopy?.emptyCtaLabel}
          emptyText={activePathCopy?.emptyText}
          emptyTitle={activePathCopy?.emptyTitle}
          groups={
            step.lane === "primary"
              ? groups
              : pathGroups.get(step.lane) ?? EMPTY_GROUPS
          }
          onAddAnother={() => startAdding(step.lane)}
          onEditGroup={(groupId) => editGroup(step.lane, groupId)}
          subtitle={
            step.lane === "primary"
              ? copy.summarySubtitle
              : activePathCopy?.summarySubtitle ??
                "Controlla il tuo percorso da allenatore."
          }
          testIDPrefix={
            step.lane === "primary"
              ? testIDPrefix
              : `${testIDPrefix}-${step.lane}`
          }
        />
      ) : null}

      {isReady && step.type === "player" ? (
        <CoachPlayerCareerStep
          emptyCtaLabel={playerPathCopy?.emptyCtaLabel}
          emptyText={playerPathCopy?.emptyText}
          emptyTitle={playerPathCopy?.emptyTitle}
          entries={playerEntries}
          onAdd={() => {
            const addTapped = events.pathEvents.player?.addTapped;

            if (addTapped) {
              trackProfileEvent(addTapped, { profileType });
            }

            setStep({ screen: { type: "select-type" }, type: "player" });
          }}
          onCancelForm={() =>
            setStep({ screen: { type: "list" }, type: "player" })
          }
          onDelete={(index) =>
            setPendingConfirm({ index, kind: "delete-player-entry" })
          }
          onEdit={(index) =>
            setStep({
              screen: {
                editIndex: index,
                entry: { ...playerEntries[index] },
                type: "form",
              },
              type: "player",
            })
          }
          onSaveForm={savePlayerEntry}
          onSelectType={(type) =>
            setStep({
              screen: {
                editIndex: null,
                entry: {
                  category: "",
                  clubId: null,
                  id: generatePlayerEntryId(),
                  period: null,
                  seasonDetails: {},
                  seasons: [],
                  teamCity: "",
                  teamLogoUrl: "",
                  teamName: "",
                  type,
                },
                type: "form",
              },
              type: "player",
            })
          }
          screen={step.screen}
          searchTeams={searchTeams}
          separationNote={`Aggiungi le esperienze vissute da calciatore. Rimarranno separate dalla ${copy.primaryEyebrow.toLowerCase()}.`}
          testIDPrefix={testIDPrefix}
        />
      ) : null}

      <ConfirmModal
        cancelLabel={
          pendingConfirm?.kind === "leave" ? "Continua a modificare" : "Annulla"
        }
        confirmLabel={resolveConfirmLabel(pendingConfirm)}
        destructive={
          pendingConfirm?.kind === "delete-group" ||
          pendingConfirm?.kind === "delete-assignment" ||
          pendingConfirm?.kind === "delete-player-entry" ||
          pendingConfirm?.kind === "remove-season"
        }
        isBusy={isSaving}
        message={resolveConfirmMessage(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={confirmPending}
        title={resolveConfirmTitle(pendingConfirm)}
        visible={pendingConfirm !== null}
      />
    </ProfileEditScaffold>
  );
}

/**
 * Firma dei campi che l'utente può toccare.
 *
 * Gli id persistiti restano fuori: non sono modifiche dell'utente e
 * renderebbero sporca una bozza appena riaperta.
 */
function draftSignature(draft: CoachExperienceDraft): string {
  return JSON.stringify({
    category: draft.category.trim(),
    clubId: draft.clubId,
    description: draft.description.trim(),
    descriptionBySeason: draft.descriptionBySeason,
    isOngoing: draft.isOngoing,
    mode: draft.mode,
    period: draft.period,
    role: draft.role.trim(),
    seasonDetails: draft.seasonDetails,
    seasons: [...draft.seasons].sort(),
    teamName: draft.teamName.trim(),
  });
}

/** §Screen 2: esattamente tre opzioni, con la copy della task. */
function buildTypeOptions(customPeriodSubtitle: string) {
  return [
    {
      icon: "layers-outline" as const,
      subtitle: "Stessa società, anche con ruoli o categorie differenti.",
      title: "Più stagioni complete",
      type: "MULTI_SEASON" as const,
    },
    {
      icon: "calendar-outline" as const,
      subtitle: "Aggiungi i dati di una sola stagione sportiva.",
      title: "Singola stagione",
      type: "SINGLE_SEASON" as const,
    },
    {
      icon: "time-outline" as const,
      subtitle: customPeriodSubtitle,
      title: "Periodo personalizzato",
      type: "CUSTOM_PERIOD" as const,
    },
  ];
}

function DeleteAction({
  label = "Elimina tutte le esperienze",
  onPress,
  testID,
}: {
  label?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View style={styles.deleteAction}>
      <Button
        destructive
        label={label}
        onPress={onPress}
        size="md"
        testID={testID}
        variant="tertiary"
      />
    </View>
  );
}

function resolveConfirmTitle(pending: PendingConfirm | null): string {
  switch (pending?.kind) {
    case "change-club":
      return "Modificare la società per tutte le stagioni?";
    case "delete-group":
      return "Eliminare tutte le esperienze?";
    case "delete-assignment":
    case "delete-player-entry":
      return "Eliminare questa esperienza?";
    case "remove-season":
      return `Rimuovere la stagione ${formatSeasonLabel(pending.seasonKey)}?`;
    case "leave":
      return "Uscire senza salvare?";
    default:
      return "";
  }
}

function resolveConfirmMessage(
  pending: PendingConfirm | null,
): string | undefined {
  switch (pending?.kind) {
    case "change-club":
      return "La nuova società verrà applicata a tutte le stagioni di questa esperienza.";
    case "delete-group":
      return "Verranno rimosse tutte le stagioni associate a questa società.";
    case "delete-assignment":
      return "L'esperienza verrà rimossa dalla tua carriera.";
    case "delete-player-entry":
      return "L'esperienza e le sue statistiche verranno rimosse dalla tua carriera da calciatore.";
    case "leave":
      return "Le modifiche effettuate andranno perse.";
    default:
      return undefined;
  }
}

function resolveConfirmLabel(pending: PendingConfirm | null): string {
  switch (pending?.kind) {
    case "change-club":
      return "Applica a tutte";
    case "delete-group":
      return "Elimina tutte";
    case "delete-assignment":
    case "delete-player-entry":
      return "Elimina";
    case "remove-season":
      return "Rimuovi";
    case "leave":
      return "Esci senza salvare";
    default:
      return "Conferma";
  }
}

const styles = StyleSheet.create({
  deleteAction: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[12],
  },
  loadError: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
});
