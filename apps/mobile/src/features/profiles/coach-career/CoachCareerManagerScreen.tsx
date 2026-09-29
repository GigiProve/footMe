/**
 * Gestisci carriera — modulo unico dell'Allenatore (REV-PROF-04).
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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, ConfirmModal, useToast } from "../../../ui";
import {
  formsToPlayerEntries,
  generatePlayerEntryId,
  playerEntriesToForms,
  splitPlayerEntryBySeasonDetails,
} from "../../onboarding/career/player-career-utils";
import type { PlayerCareerEntry } from "../../onboarding/career/player-career-types";
import { CoachExperienceTypeSelector } from "../../onboarding/coach/CoachExperienceTypeSelector";
import { ProfileEditScaffold } from "../edit/ProfileEditScaffold";
import { trackProfileEvent } from "../profile-analytics";
import { searchTeams } from "../profile-service";
import {
  buildCoachExperienceGroups,
  formatSeasonLabel,
  recordsToAssignments,
  type CoachAssignment,
  type CoachTemporalMode,
} from "./coach-assignment-model";
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
} from "./coach-career-draft";
import {
  useCoachCareerSave,
  useCompleteProfileQuery,
} from "./coach-career-service";
import {
  coachPlayerRecordsToForms,
  formsToCoachPlayerRecords,
} from "./coach-player-career";
import { CoachCareerSkeleton } from "./CoachCareerSkeleton";
import { useCoachCareerGuard } from "./use-coach-career-guard";
import { CoachCareerHubStep } from "./steps/CoachCareerHubStep";
import { CoachCareerSummaryStep } from "./steps/CoachCareerSummaryStep";
import {
  CoachPlayerCareerStep,
  type CoachPlayerCareerScreen,
} from "./steps/CoachPlayerCareerStep";
import { CoachSeasonRolesStep } from "./steps/CoachSeasonRolesStep";
import { CoachSeasonsStep } from "./steps/CoachSeasonsStep";
import { CoachSingleAssignmentStep } from "./steps/CoachSingleAssignmentStep";

/**
 * `originalTeamName` esiste solo per una domanda: cambiare la società di un
 * gruppo la cambia a **tutte** le sue stagioni, quindi va confermato. Senza il
 * valore di partenza non si distingue un cambio da una semplice riapertura.
 */
type ManagerStep =
  | { type: "hub" }
  | { type: "select-type" }
  | {
      type: "seasons";
      draft: CoachExperienceDraft;
      isEditing: boolean;
      originalTeamName: string;
    }
  | {
      type: "season-roles";
      draft: CoachExperienceDraft;
      isEditing: boolean;
      originalTeamName: string;
    }
  | { type: "single"; draft: CoachExperienceDraft; isEditing: boolean }
  | { type: "summary" }
  | { type: "player"; screen: CoachPlayerCareerScreen };

type PendingConfirm =
  | { kind: "change-club"; draft: CoachExperienceDraft }
  | { kind: "delete-group"; groupId: string }
  | { kind: "delete-assignment"; assignmentId: string }
  | { kind: "delete-player-entry"; index: number }
  | { kind: "remove-season"; seasonKey: string }
  | { kind: "leave" };

const GENERIC_SAVE_ERROR =
  "Non è stato possibile completare l'operazione. Riprova.";
const SAVE_ERROR = "Non è stato possibile salvare. Riprova.";
const DELETE_ERROR = "Non è stato possibile eliminare. Riprova.";

export function CoachCareerManagerScreen() {
  const { userId } = useCoachCareerGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachCareerSave(userId);
  const { showToast } = useToast();
  const data = profileQuery.data;

  const [step, setStep] = useState<ManagerStep>({ type: "hub" });
  const [errors, setErrors] = useState<CoachDraftErrors>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }

    openedRef.current = true;
    trackProfileEvent("coach_career_manager_opened", {
      profileType: "coach",
      viewerMode: "owner",
    });
  }, []);

  useEffect(() => {
    if (profileQuery.isError) {
      trackProfileEvent("coach_career_load_failed", { profileType: "coach" });
    }
  }, [profileQuery.isError]);

  /*
    Assegnazioni e gruppi derivano sempre dall'ultimo dato letto, mai da una
    copia locale: un salvataggio fallito non può lasciare a schermo una
    carriera che sul server non esiste.
  */
  const assignments = useMemo<CoachAssignment[]>(
    () => (data ? recordsToAssignments(data.coachCareerEntries ?? []) : []),
    [data],
  );
  const groups = useMemo(
    () => buildCoachExperienceGroups(assignments),
    [assignments],
  );
  const playerForms = useMemo(
    () => coachPlayerRecordsToForms(data?.coachPlayerCareerEntries ?? []),
    [data],
  );
  const playerEntries = useMemo(
    () => formsToPlayerEntries(playerForms),
    [playerForms],
  );
  const previousPlayerById = useMemo(
    () =>
      new Map(
        (data?.coachPlayerCareerEntries ?? []).map((entry) => [
          entry.id,
          entry,
        ]),
      ),
    [data],
  );

  const defaultRole = data?.coachProfile?.primary_role?.trim() ?? "";
  const activeDraft =
    step.type === "seasons" || step.type === "season-roles" || step.type === "single"
      ? step.draft
      : null;

  // ------------------------------------------------------------------
  // Persistenza
  // ------------------------------------------------------------------

  const persistAssignments = useCallback(
    (
      next: readonly CoachAssignment[],
      {
        failureEvent,
        failureMessage,
        onDone,
        successMessage,
      }: {
        failureEvent: "coach_career_save_failed" | "coach_career_delete_failed";
        failureMessage: string;
        onDone?: () => void;
        successMessage: string;
      },
    ) => {
      if (!data) {
        return;
      }

      setErrorMessage(null);
      save.mutate(
        { data, patch: { assignments: next } },
        {
          onError: () => {
            trackProfileEvent(failureEvent, {
              profileType: "coach",
              success: false,
            });
            setErrorMessage(failureMessage);
          },
          onSuccess: () => {
            showToast({ message: successMessage, tone: "success" });
            onDone?.();
          },
        },
      );
    },
    [data, save, showToast],
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

  function toggleSeason(seasonKey: string) {
    setStep((current) => {
      if (current.type !== "seasons") {
        return current;
      }

      const isSelected = current.draft.seasons.includes(seasonKey);
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
        (previous
          ? current.draft.seasonDetails[previous]
          : undefined) ?? {
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

  function startAdding() {
    trackProfileEvent("coach_career_add_tapped", { profileType: "coach" });
    setErrors({});
    setWarning(null);
    setStep({ type: "select-type" });
  }

  function selectType(mode: CoachTemporalMode) {
    trackProfileEvent("coach_career_type_selected", {
      experienceMode: mode,
      profileType: "coach",
    });

    const draft = createCoachDraft(mode, { defaultRole });

    setErrors({});
    setStep(
      mode === "MULTI_SEASON"
        ? { draft, isEditing: false, originalTeamName: "", type: "seasons" }
        : { draft, isEditing: false, type: "single" },
    );
  }

  function editGroup(groupId: string) {
    const draft = draftFromAssignments(
      assignments.filter((assignment) => assignment.groupId === groupId),
    );

    if (!draft) {
      return;
    }

    trackProfileEvent("coach_career_group_edited", {
      experienceMode: draft.mode,
      profileType: "coach",
    });
    setErrors({});
    setWarning(null);
    setStep(
      draft.mode === "MULTI_SEASON"
        ? {
            draft,
            isEditing: true,
            originalTeamName: draft.teamName,
            type: "seasons",
          }
        : { draft, isEditing: true, type: "single" },
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

    trackProfileEvent("coach_career_season_roles_opened", {
      profileType: "coach",
      seasonCount: step.draft.seasons.length,
    });
    setErrors({});
    setStep({ ...step, type: "season-roles" });
  }

  // ------------------------------------------------------------------
  // Salvataggio di un'esperienza
  // ------------------------------------------------------------------

  function commitDraft(draft: CoachExperienceDraft, isEditing: boolean) {
    const incoming = draftToAssignments(draft);
    const duplicates = findDuplicateAssignments(incoming, assignments);

    if (duplicates.length > 0) {
      setErrorMessage("Questa esperienza è già presente.");
      return;
    }

    /*
      La sovrapposizione non blocca: un allenatore può ricoprire più incarichi
      nello stesso periodo. L'avviso compare una volta; se l'utente conferma di
      nuovo, il salvataggio procede.
    */
    if (!warning && hasOverlappingAssignments(incoming, assignments)) {
      setWarning(COACH_OVERLAP_WARNING);
      return;
    }

    const kept = assignments.filter(
      (assignment) => assignment.groupId !== draft.groupId,
    );

    persistAssignments([...kept, ...incoming], {
      failureEvent: "coach_career_save_failed",
      failureMessage: SAVE_ERROR,
      onDone: () => {
        trackProfileEvent(
          isEditing
            ? "coach_career_experience_edited"
            : "coach_career_experience_saved",
          {
            experienceMode: draft.mode,
            profileType: "coach",
            seasonCount: incoming.length,
          },
        );
        setWarning(null);
        setErrors({});
        setStep({ type: "summary" });
      },
      successMessage: isEditing ? "Esperienza aggiornata." : "Esperienza aggiunta.",
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
      setPendingConfirm({ draft: step.draft, kind: "change-club" });
      return;
    }

    commitDraft(step.draft, step.isEditing);
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

    commitDraft(step.draft, step.isEditing);
  }

  // ------------------------------------------------------------------
  // Eliminazioni
  // ------------------------------------------------------------------

  function confirmPending() {
    if (!pendingConfirm || !data) {
      return;
    }

    if (pendingConfirm.kind === "delete-player-entry") {
      const index = pendingConfirm.index;

      persistPlayerEntries(
        playerEntries.filter((_, entryIndex) => entryIndex !== index),
        {
          onDone: () => {
            trackProfileEvent("coach_career_experience_deleted", {
              careerMode: "player",
              profileType: "coach",
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
      const draft = pendingConfirm.draft;

      setPendingConfirm(null);
      commitDraft(draft, true);
      return;
    }

    if (pendingConfirm.kind === "leave") {
      trackProfileEvent("coach_career_unsaved_exit", { profileType: "coach" });
      setPendingConfirm(null);
      setStep({ type: "hub" });
      return;
    }

    if (pendingConfirm.kind === "remove-season") {
      const seasonKey = pendingConfirm.seasonKey;

      setStep((current) => {
        if (current.type !== "season-roles") {
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

    const next =
      pendingConfirm.kind === "delete-group"
        ? assignments.filter(
            (assignment) => assignment.groupId !== pendingConfirm.groupId,
          )
        : assignments.filter(
            (assignment) => assignment.id !== pendingConfirm.assignmentId,
          );
    const isGroup = pendingConfirm.kind === "delete-group";

    persistAssignments(next, {
      failureEvent: "coach_career_delete_failed",
      failureMessage: DELETE_ERROR,
      onDone: () => {
        trackProfileEvent(
          isGroup
            ? "coach_career_group_deleted"
            : "coach_career_experience_deleted",
          { profileType: "coach" },
        );
        setPendingConfirm(null);
        setStep({ type: "hub" });
      },
      successMessage: "Esperienza eliminata.",
    });
  }

  // ------------------------------------------------------------------
  // Carriera da ex calciatore
  // ------------------------------------------------------------------

  function persistPlayerEntries(
    next: PlayerCareerEntry[],
    { onDone, successMessage }: { onDone: () => void; successMessage: string },
  ) {
    if (!data) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          playerCareerEntries: formsToCoachPlayerRecords(
            playerEntriesToForms(next),
            data.profile.id,
            previousPlayerById,
          ),
        },
      },
      {
        onError: () => {
          trackProfileEvent("coach_career_save_failed", {
            careerMode: "player",
            profileType: "coach",
            success: false,
          });
          setErrorMessage(GENERIC_SAVE_ERROR);
        },
        onSuccess: () => {
          showToast({ message: successMessage, tone: "success" });
          onDone();
        },
      },
    );
  }

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
  // Uscita
  // ------------------------------------------------------------------

  const isDraftDirty = Boolean(
    activeDraft &&
      (activeDraft.teamName.trim() ||
        activeDraft.seasons.length > 0 ||
        activeDraft.role.trim() ||
        activeDraft.category.trim() ||
        activeDraft.period?.startYear),
  );

  function handleBack() {
    if (save.isPending) {
      return;
    }

    if (step.type === "season-roles") {
      setErrors({});
      setStep({ ...step, type: "seasons" });
      return;
    }

    if (activeDraft) {
      if (isDraftDirty) {
        setPendingConfirm({ kind: "leave" });
        return;
      }

      trackProfileEvent("coach_career_cancelled", {
        experienceMode: activeDraft.mode,
        profileType: "coach",
      });
      setStep({ type: "hub" });
      return;
    }

    if (step.type === "player" && step.screen.type !== "list") {
      setStep({ screen: { type: "list" }, type: "player" });
      return;
    }

    if (step.type !== "hub") {
      setStep({ type: "hub" });
      return;
    }

    router.back();
  }

  function finishSession(event: "coach_career_completed" | "coach_career_cancelled") {
    trackProfileEvent(event, { profileType: "coach" });
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
        return { title: "Esperienze da allenatore" };
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
        return {
          onSave: () => finishSession("coach_career_completed"),
          saveLabel: "Conferma carriera",
          title: "Le tue esperienze",
        };
      case "player":
        return step.screen.type === "list"
          ? {
              onSave: () => setStep({ type: "hub" }),
              saveLabel: "Fine",
              title: "Carriera da calciatore",
            }
          : { title: "Carriera da calciatore" };
      default:
        return {
          onSave: () => finishSession("coach_career_completed"),
          saveLabel: "Fine",
          title: "Gestisci carriera",
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
      saving={save.isPending}
      secondaryLabel={scaffold.secondaryLabel}
      stepLabel={scaffold.stepLabel}
      testID="coach-career-manager"
      title={scaffold.title}
    >
      {profileQuery.isPending ? <CoachCareerSkeleton /> : null}

      {profileQuery.isError ? (
        <View style={styles.loadError} testID="coach-career-load-error">
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare la tua carriera.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => profileQuery.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : null}

      {data && step.type === "hub" ? (
        <CoachCareerHubStep
          groups={groups}
          onAddExperience={startAdding}
          onEditGroup={editGroup}
          onOpenPlayerCareer={() => {
            trackProfileEvent("coach_career_player_opened", {
              profileType: "coach",
            });
            setStep({ screen: { type: "list" }, type: "player" });
          }}
          playerExperienceCount={playerEntries.length}
        />
      ) : null}

      {data && step.type === "select-type" ? (
        <CoachExperienceTypeSelector
          onSelect={selectType}
          options={EXPERIENCE_TYPE_OPTIONS}
          subtitle="Scegli come vuoi inserire questa esperienza."
          title="Aggiungi esperienza"
        />
      ) : null}

      {data && step.type === "seasons" ? (
        <CoachSeasonsStep
          draft={step.draft}
          errors={errors}
          onChangeDraft={patchDraft}
          onToggleSeason={toggleSeason}
          searchTeams={searchTeams}
        />
      ) : null}

      {data && step.type === "season-roles" ? (
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
          />
          {step.isEditing ? (
            <DeleteGroupAction
              onPress={() =>
                setPendingConfirm({
                  groupId: step.draft.groupId,
                  kind: "delete-group",
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {data && step.type === "single" ? (
        <>
          <CoachSingleAssignmentStep
            draft={step.draft}
            errors={errors}
            onChangeDraft={patchDraft}
            searchTeams={searchTeams}
          />
          {step.isEditing && step.draft.persistedId ? (
            <DeleteGroupAction
              label="Elimina esperienza"
              onPress={() =>
                setPendingConfirm({
                  assignmentId: step.draft.persistedId as string,
                  kind: "delete-assignment",
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {data && step.type === "summary" ? (
        <CoachCareerSummaryStep
          groups={groups}
          onAddAnother={startAdding}
          onEditGroup={editGroup}
        />
      ) : null}

      {data && step.type === "player" ? (
        <CoachPlayerCareerStep
          entries={playerEntries}
          onAdd={() => {
            trackProfileEvent("coach_career_player_add_tapped", {
              profileType: "coach",
            });
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
        isBusy={save.isPending}
        message={resolveConfirmMessage(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={confirmPending}
        title={resolveConfirmTitle(pendingConfirm)}
        visible={pendingConfirm !== null}
      />
    </ProfileEditScaffold>
  );
}

/** §Screen 2: esattamente tre opzioni, con la copy della task. */
const EXPERIENCE_TYPE_OPTIONS = [
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
    subtitle: "Per subentri, incarichi brevi o periodi non completi.",
    title: "Periodo personalizzato",
    type: "CUSTOM_PERIOD" as const,
  },
];

function DeleteGroupAction({
  label = "Elimina tutte le esperienze",
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.deleteAction}>
      <Button
        destructive
        label={label}
        onPress={onPress}
        size="md"
        testID="coach-career-delete"
        variant="tertiary"
      />
    </View>
  );
}

function resolveConfirmTitle(pending: PendingConfirm | null): string {
  switch (pending?.kind) {
    case "change-club":
      return "Cambiare società?";
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

function resolveConfirmMessage(pending: PendingConfirm | null): string | undefined {
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
