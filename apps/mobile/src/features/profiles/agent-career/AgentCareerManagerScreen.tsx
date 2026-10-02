/**
 * Gestisci carriera — Procuratore (REV-PROF-15).
 *
 * Le otto schermate del mockup vivono qui, in una sola macchina a stati: hub,
 * tipo di esperienza, ricerca agenzia, esperienza in agenzia, attività
 * indipendente, riepilogo, modifica, percorsi aggiuntivi.
 *
 * Non riusa `CareerManagerScreen` per un motivo sostanziale: quel modulo
 * ragiona per stagioni sportive, e la carriera del Procuratore è fatta di
 * periodi mese/anno con incarichi che possono sovrapporsi. Piegare l'uno
 * sull'altra avrebbe significato inventare stagioni che nessuno ha scritto.
 * Quello che invece è davvero condiviso — le card dei percorsi aggiuntivi, lo
 * scaffold di schermata, le card tipo-esperienza, i campi periodo — arriva dai
 * moduli esistenti, e i percorsi aggiuntivi aprono i flussi già approvati
 * degli altri ruoli invece di una loro versione semplificata.
 *
 * Due invarianti attraversano tutto il file:
 *
 *  * **I record sono già sul server quando il riepilogo si apre.** "Salva
 *    esperienza" scrive; "Conferma carriera" chiude e basta. Ripetere la
 *    mutation lì avrebbe creato duplicati a ogni visita.
 *  * **Lo stato a schermo deriva sempre dall'ultima lettura.** Nessuna copia
 *    locale della carriera: un salvataggio fallito non può lasciare a schermo
 *    un incarico che sul server non esiste.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ConfirmModal, useToast } from "../../../ui";
import { CoachExperienceTypeSelector } from "../../onboarding/coach/CoachExperienceTypeSelector";
import { DateSelector, InfoMessage } from "../../onboarding/ui";
import { createLocalUuid } from "../agent-profile";
import type {
  CareerPathCopy,
  CareerPathKey,
} from "../career-manager/career-manager-config";
import { AdditionalPathsStep } from "../career-manager/steps/AdditionalPathsStep";
import { ProfileEditScaffold } from "../edit/ProfileEditScaffold";
import { trackProfileEvent } from "../profile-analytics";
import {
  AGENT_CAREER_MESSAGES,
  agentPeriodFromDateValue,
  createAgentAssignment,
  currentMonthValue,
  groupAgentAssignments,
  hasAgentAssignmentErrors,
  hasOverlappingAssignment,
  isExactDuplicate,
  isSameAssignment,
  recordsToAssignments,
  shouldDefaultToPrimary,
  validateAgentAssignment,
  type AgentAssignmentErrors,
  type AgentCareerAssignment,
  type AgentExperienceGroup,
  type AgentOrganizationMode,
} from "./agent-assignment-model";
import { getAgentCareerRoleOptions } from "./agent-career-taxonomy";
import {
  isDuplicateError,
  searchAgentOrganizations,
  useCompleteProfileQuery,
  useDeleteAgentAssignment,
  useEndAgentAssignment,
  useSaveAgentAssignment,
  type AgentOrganizationResult,
} from "./agent-career-service";
import { AgentCareerHubStep } from "./steps/AgentCareerHubStep";
import { AgentCareerSummaryStep } from "./steps/AgentCareerSummaryStep";
import { AgentExperienceFormStep } from "./steps/AgentExperienceFormStep";
import {
  AgentManualOrganizationStep,
  type ManualOrganizationDraft,
} from "./steps/AgentManualOrganizationStep";
import { AgentOrganizationSearchStep } from "./steps/AgentOrganizationSearchStep";
import { useAgentCareerGuard } from "./use-agent-career-guard";

/**
 * I quattro percorsi aggiuntivi del Procuratore (§Screen 8). Ognuno apre il
 * flusso già approvato di quel ruolo: qui non esiste una versione ridotta
 * delle altre carriere, e nessuna loro esperienza diventa un incarico da
 * procuratore.
 */
const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da dirigente",
    emptyCtaLabel: "Aggiungi carriera da dirigente",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza",
    icon: "briefcase-outline",
    key: "director",
    summarySubtitle: "Controlla il tuo percorso dirigenziale.",
    title: "Carriera da dirigente",
    typeSelectorTitle: "Esperienze dirigenziali",
  },
  {
    appBarTitle: "Carriera da allenatore",
    emptyCtaLabel: "Aggiungi carriera da allenatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza",
    icon: "clipboard-outline",
    key: "coach",
    summarySubtitle: "Controlla il tuo percorso da allenatore.",
    title: "Carriera da allenatore",
    typeSelectorTitle: "Esperienze da allenatore",
  },
  {
    appBarTitle: "Carriera nello staff tecnico",
    emptyCtaLabel: "Aggiungi carriera nello staff tecnico",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza",
    icon: "person-outline",
    key: "staff",
    summarySubtitle: "Controlla il tuo percorso nello staff tecnico.",
    title: "Carriera nello staff tecnico",
    typeSelectorTitle: "Esperienze nello staff",
  },
  {
    appBarTitle: "Carriera da calciatore",
    emptyCtaLabel: "Aggiungi carriera da calciatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza",
    icon: "walk-outline",
    key: "player",
    title: "Carriera da calciatore",
  },
];

/** Le due modalità professionali ammesse (§Screen 2). Nessuna terza. */
const EXPERIENCE_TYPE_OPTIONS = [
  {
    icon: "business-outline" as const,
    subtitle: "Hai lavorato o collaborato con un'organizzazione.",
    title: "Agenzia / Studio",
    type: "agency" as AgentOrganizationMode,
  },
  {
    icon: "briefcase-outline" as const,
    subtitle: "Hai operato professionalmente per conto tuo.",
    title: "Attività indipendente",
    type: "independent" as AgentOrganizationMode,
  },
];

type FormContext = {
  draft: AgentCareerAssignment;
  /**
   * La bozza com'era all'apertura. Senza, una modifica riaperta e chiusa
   * subito risulterebbe "sporca" solo perché i campi sono pieni.
   */
  initialDraft: AgentCareerAssignment;
  isEditing: boolean;
};

type AgentStep =
  | { type: "hub" }
  | { type: "select-type" }
  | ({ type: "search" } & FormContext)
  | ({ type: "manual"; manual: ManualOrganizationDraft } & FormContext)
  | ({ type: "form" } & FormContext)
  | { type: "group"; groupId: string }
  | { type: "summary" }
  | { type: "paths" };

type PendingConfirm =
  | { kind: "leave" }
  | { kind: "delete"; assignmentId: string }
  | { kind: "end"; assignmentId: string }
  | { kind: "change-organization"; organization: AgentOrganizationResult };

const EMPTY_MANUAL: ManualOrganizationDraft = { city: "", country: "", name: "" };

export function AgentCareerManagerScreen() {
  const { userId } = useAgentCareerGuard();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { showToast } = useToast();

  const profileQuery = useCompleteProfileQuery(userId);
  const saveAssignment = useSaveAgentAssignment(userId);
  const endAssignment = useEndAgentAssignment(userId);
  const deleteAssignment = useDeleteAgentAssignment(userId);

  const [step, setStep] = useState<AgentStep>(
    section === "paths" ? { type: "paths" } : { type: "hub" },
  );
  const [errors, setErrors] = useState<AgentAssignmentErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [endMonthValue, setEndMonthValue] = useState(() => currentMonthValue());
  const openedRef = useRef(false);

  const data = profileQuery.data;
  const isSaving =
    saveAssignment.isPending ||
    endAssignment.isPending ||
    deleteAssignment.isPending;

  /*
    Incarichi e gruppi derivano sempre dall'ultima lettura, mai da una copia
    locale: dopo ogni mutation il profilo viene riletto e rimesso in cache, e
    questo blocco si ricalcola da solo.
  */
  const assignments = useMemo(
    () => recordsToAssignments(data?.agentCareerEntries ?? []),
    [data?.agentCareerEntries],
  );
  const groups = useMemo(() => groupAgentAssignments(assignments), [assignments]);
  const roleOptions = useMemo(
    () =>
      getAgentCareerRoleOptions(
        assignments.map((assignment) => assignment.role).filter(Boolean),
      ),
    [assignments],
  );

  /**
   * Conteggio dei percorsi aggiuntivi: quante esperienze ci sono, calcolate a
   * ogni render. Nessun contatore memorizzato da tenere allineato.
   */
  const pathCounts = useMemo(() => {
    const agentProfile = data?.agentProfile;
    const counts: Record<CareerPathKey, number> = {
      coach: agentProfile?.coach_career_entries.length ?? 0,
      director: agentProfile?.director_career_entries.length ?? 0,
      other: 0,
      player: agentProfile?.player_career_entries.length ?? 0,
      staff: agentProfile?.staff_career_entries.length ?? 0,
    };

    return PATHS.map((copy) => ({ copy, count: counts[copy.key] }));
  }, [data?.agentProfile]);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }

    openedRef.current = true;
    trackProfileEvent("agent_career_manager_opened", {
      profileType: "agent",
      source: section === "paths" ? "additional_paths" : "career_tab",
      viewerMode: "owner",
    });
  }, [section]);

  useEffect(() => {
    if (profileQuery.isError) {
      trackProfileEvent("agent_career_load_failed", { profileType: "agent" });
    }
  }, [profileQuery.isError]);

  const activeForm = step.type === "form" ? step : null;
  const isDirty = Boolean(
    activeForm && !isSameAssignment(activeForm.draft, activeForm.initialDraft),
  );
  /*
    §"Incarichi contemporanei": la sovrapposizione non blocca niente — un
    procuratore può collaborare con più organizzazioni nello stesso periodo.
    L'avviso è calcolato dalla bozza corrente, non memorizzato: così compare e
    sparisce mentre le date cambiano, invece di restare appeso a una
    validazione di due schermate fa.
  */
  const warning =
    activeForm && hasOverlappingAssignment(activeForm.draft, assignments)
      ? AGENT_CAREER_MESSAGES.overlap
      : null;

  // ------------------------------------------------------------------
  // Navigazione fra i passi
  // ------------------------------------------------------------------

  function startExperience() {
    trackProfileEvent("agent_career_add_tapped", { profileType: "agent" });
    setErrors({});
    setErrorMessage(null);
    setStep({ type: "select-type" });
  }

  function selectType(mode: AgentOrganizationMode) {
    trackProfileEvent("agent_career_type_selected", {
      organizationMode: mode,
      profileType: "agent",
    });

    const draft = createAgentAssignment(mode);
    /*
      §"Esperienza principale": il primo incarico in corso di una carriera che
      non ne ha altri nasce principale, e il form lo mostra acceso invece di
      deciderlo di nascosto al salvataggio.
    */
    const prefilled: AgentCareerAssignment = {
      ...draft,
      isCurrent: true,
      isPrimary: shouldDefaultToPrimary(assignments, null),
    };

    if (mode === "independent") {
      openForm({ draft: prefilled, initialDraft: prefilled, isEditing: false });
      return;
    }

    setSearchQuery("");
    setStep({
      draft: prefilled,
      initialDraft: prefilled,
      isEditing: false,
      type: "search",
    });
  }

  function openForm(context: FormContext) {
    setErrors({});
    setErrorMessage(null);
    setStep({ ...context, type: "form" });
  }

  function applyOrganization(
    context: FormContext,
    organization: AgentOrganizationResult,
  ) {
    trackProfileEvent("agent_career_organization_selected", {
      profileType: "agent",
    });

    openForm({
      ...context,
      draft: {
        ...context.draft,
        manualOrganizationId: null,
        organizationCity: organization.city ?? organization.region ?? "",
        organizationClubId: organization.id,
        organizationCountry: "",
        organizationLogoUrl: organization.logoUrl ?? "",
        organizationMode: "agency",
        organizationName: organization.name,
      },
    });
  }

  function selectOrganization(organization: AgentOrganizationResult) {
    if (step.type !== "search") {
      return;
    }

    const context: FormContext = {
      draft: step.draft,
      initialDraft: step.initialDraft,
      isEditing: step.isEditing,
    };

    /*
      §Screen 7: cambiare organizzazione a un incarico esistente va confermato.
      Sposta soltanto questo incarico — gli altri della vecchia agenzia restano
      dove sono — ma è comunque una riscrittura della storia e non deve
      succedere per un tap di troppo.
    */
    const isChange =
      step.isEditing && step.initialDraft.organizationClubId !== organization.id;

    if (isChange) {
      setPendingConfirm({ kind: "change-organization", organization });
      return;
    }

    applyOrganization(context, organization);
  }

  function confirmManualOrganization() {
    if (step.type !== "manual") {
      return;
    }

    const name = step.manual.name.trim();

    if (!name) {
      setErrors({ organization: "Inserisci il nome dell'organizzazione." });
      return;
    }

    trackProfileEvent("agent_career_manual_completed", { profileType: "agent" });

    /*
      Un riferimento privato, non una pagina: l'id serve solo a raggruppare gli
      incarichi svolti nello stesso posto. Un'organizzazione manuale non viene
      mai ricollegata a una pagina canonica per somiglianza di nome.
    */
    openForm({
      draft: {
        ...step.draft,
        manualOrganizationId: step.draft.manualOrganizationId ?? createLocalUuid(),
        organizationCity: step.manual.city.trim(),
        organizationClubId: null,
        organizationCountry: step.manual.country.trim(),
        organizationLogoUrl: "",
        organizationMode: "agency",
        organizationName: name,
      },
      initialDraft: step.initialDraft,
      isEditing: step.isEditing,
    });
  }

  function editAssignment(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      return;
    }

    trackProfileEvent("agent_career_experience_edited", { profileType: "agent" });
    openForm({ draft: assignment, initialDraft: assignment, isEditing: true });
  }

  function editGroup(groupId: string) {
    const group = groups.find((item) => item.groupId === groupId);

    if (!group) {
      return;
    }

    // Un gruppo con un solo incarico non ha niente da scegliere: si apre
    // direttamente la modifica.
    if (group.rows.length === 1 && group.rows[0]) {
      editAssignment(group.rows[0].assignmentId);
      return;
    }

    setStep({ groupId, type: "group" });
  }

  function openPath(path: CareerPathKey) {
    const openedEvents = {
      coach: "agent_career_coach_opened",
      director: "agent_career_director_opened",
      other: "agent_career_paths_opened",
      player: "agent_career_player_opened",
      staff: "agent_career_staff_opened",
    } as const;

    trackProfileEvent(openedEvents[path], {
      careerMode: path,
      profileType: "agent",
    });

    // Il percorso aggiuntivo è il flusso già approvato di quel ruolo, aperto
    // sulla propria schermata: nessuna versione semplificata ricreata qui.
    router.push(`/profile/agent-paths-career?path=${path}`);
  }

  // ------------------------------------------------------------------
  // Scritture
  // ------------------------------------------------------------------

  const patchDraft = useCallback((patch: Partial<AgentCareerAssignment>) => {
    setErrors({});
    setErrorMessage(null);
    setStep((current) =>
      current.type === "form" || current.type === "search" || current.type === "manual"
        ? { ...current, draft: { ...current.draft, ...patch } }
        : current,
    );
  }, []);

  function saveDraft() {
    if (!activeForm || !userId) {
      return;
    }

    const draft = activeForm.draft;
    const nextErrors = validateAgentAssignment(draft);

    if (hasAgentAssignmentErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    if (isExactDuplicate(draft, assignments)) {
      setErrors({});
      setErrorMessage(AGENT_CAREER_MESSAGES.duplicate);
      return;
    }

    setErrors({});
    setErrorMessage(null);

    saveAssignment.mutate(
      { assignment: draft, profileId: userId },
      {
        onError: (error) => {
          trackProfileEvent(
            activeForm.isEditing
              ? "agent_career_update_failed"
              : "agent_career_save_failed",
            { profileType: "agent" },
          );
          setErrorMessage(
            isDuplicateError(error)
              ? AGENT_CAREER_MESSAGES.duplicate
              : activeForm.isEditing
                ? AGENT_CAREER_MESSAGES.updateError
                : AGENT_CAREER_MESSAGES.saveError,
          );
        },
        onSuccess: () => {
          trackProfileEvent(
            draft.organizationMode === "independent"
              ? "agent_career_independent_saved"
              : "agent_career_experience_saved",
            { organizationMode: draft.organizationMode, profileType: "agent" },
          );

          if (draft.isPrimary && !activeForm.initialDraft.isPrimary) {
            trackProfileEvent("agent_career_primary_set", {
              profileType: "agent",
            });
          }

          showToast({
            message: activeForm.isEditing
              ? "Esperienza aggiornata."
              : "Esperienza aggiunta.",
            tone: "success",
          });

          // Una creazione porta al riepilogo — i record sono già persistiti —
          // mentre una modifica torna da dove è partita.
          setStep(activeForm.isEditing ? { type: "hub" } : { type: "summary" });
        },
      },
    );
  }

  function confirmEnd(assignmentId: string) {
    if (!userId) {
      return;
    }

    const { month, year } = agentPeriodFromDateValue(endMonthValue);
    const parsedYear = Number.parseInt(year, 10);

    if (!Number.isFinite(parsedYear)) {
      setErrorMessage(AGENT_CAREER_MESSAGES.endError);
      return;
    }

    endAssignment.mutate(
      { assignmentId, endMonth: month, endYear: parsedYear, profileId: userId },
      {
        onError: () => {
          trackProfileEvent("agent_career_end_failed", { profileType: "agent" });
          // Il dialogo si chiude: il messaggio sta nella schermata sotto, e
          // lasciarglielo davanti lo renderebbe invisibile.
          setPendingConfirm(null);
          setErrorMessage(AGENT_CAREER_MESSAGES.endError);
        },
        onSuccess: () => {
          trackProfileEvent("agent_career_assignment_ended", {
            profileType: "agent",
          });
          showToast({ message: "Incarico concluso.", tone: "success" });
          setPendingConfirm(null);
          setStep({ type: "hub" });
        },
      },
    );
  }

  function confirmDelete(assignmentId: string) {
    if (!userId) {
      return;
    }

    deleteAssignment.mutate(
      { assignmentId, profileId: userId },
      {
        onError: () => {
          trackProfileEvent("agent_career_delete_failed", {
            profileType: "agent",
          });
          setPendingConfirm(null);
          setErrorMessage(AGENT_CAREER_MESSAGES.deleteError);
        },
        onSuccess: () => {
          trackProfileEvent("agent_career_experience_deleted", {
            profileType: "agent",
          });
          showToast({ message: "Esperienza eliminata.", tone: "success" });
          setPendingConfirm(null);
          setStep({ type: "hub" });
        },
      },
    );
  }

  function confirmPending() {
    if (!pendingConfirm) {
      return;
    }

    if (pendingConfirm.kind === "leave") {
      trackProfileEvent("agent_career_unsaved_exit", { profileType: "agent" });
      setPendingConfirm(null);
      leaveForm();
      return;
    }

    if (pendingConfirm.kind === "change-organization") {
      if (step.type !== "search") {
        setPendingConfirm(null);
        return;
      }

      trackProfileEvent("agent_career_organization_changed", {
        profileType: "agent",
      });

      const context: FormContext = {
        draft: step.draft,
        initialDraft: step.initialDraft,
        isEditing: step.isEditing,
      };

      setPendingConfirm(null);
      applyOrganization(context, pendingConfirm.organization);
      return;
    }

    if (pendingConfirm.kind === "end") {
      confirmEnd(pendingConfirm.assignmentId);
      return;
    }

    confirmDelete(pendingConfirm.assignmentId);
  }

  // ------------------------------------------------------------------
  // Uscita
  // ------------------------------------------------------------------

  function leaveForm() {
    trackProfileEvent("agent_career_cancelled", { profileType: "agent" });
    setStep(activeForm?.isEditing ? { type: "hub" } : { type: "select-type" });
  }

  function goBack() {
    if (step.type === "form") {
      if (isDirty) {
        setPendingConfirm({ kind: "leave" });
        return;
      }

      setStep(step.isEditing ? { type: "hub" } : { type: "select-type" });
      return;
    }

    if (step.type === "manual") {
      setStep({
        draft: step.draft,
        initialDraft: step.initialDraft,
        isEditing: step.isEditing,
        type: "search",
      });
      return;
    }

    if (step.type === "search" || step.type === "select-type") {
      setStep({ type: "hub" });
      return;
    }

    if (step.type === "group" || step.type === "summary") {
      setStep({ type: "hub" });
      return;
    }

    if (step.type === "paths" && section === "paths") {
      router.back();
      return;
    }

    if (step.type !== "hub") {
      setStep({ type: "hub" });
      return;
    }

    trackProfileEvent("agent_career_closed", { profileType: "agent" });
    router.back();
  }

  function finishSession() {
    trackProfileEvent("agent_career_completed", { profileType: "agent" });
    router.back();
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (profileQuery.isPending || !data) {
    return (
      <ProfileEditScaffold
        onBack={() => router.back()}
        testID="agent-career-manager"
        title="Gestisci carriera"
      >
        <View style={styles.skeleton} testID="agent-career-loading">
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.skeletonCard} />
          ))}
        </View>
      </ProfileEditScaffold>
    );
  }

  if (profileQuery.isError) {
    return (
      <ProfileEditScaffold
        onBack={() => router.back()}
        testID="agent-career-manager"
        title="Gestisci carriera"
      >
        <View style={styles.state} testID="agent-career-error">
          <InfoMessage
            message="Non è stato possibile caricare la carriera. Riprova."
            tone="warning"
          />
          <Button
            label="Riprova"
            onPress={() => profileQuery.refetch()}
            size="sm"
            testID="agent-career-retry"
            variant="secondary"
          />
        </View>
      </ProfileEditScaffold>
    );
  }

  const title = resolveTitle(step);
  const scaffoldProps = resolveScaffoldActions();

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      notice={warning}
      onBack={goBack}
      testID="agent-career-manager"
      title={title}
      {...scaffoldProps}
    >
      {step.type === "hub" ? (
        <AgentCareerHubStep
          groups={groups}
          onAddExperience={startExperience}
          onEditGroup={editGroup}
          onOpenPath={openPath}
          paths={pathCounts}
        />
      ) : null}

      {step.type === "select-type" ? (
        <CoachExperienceTypeSelector
          onSelect={selectType}
          options={EXPERIENCE_TYPE_OPTIONS}
          subtitle="Indica come hai svolto questa attività professionale."
          testIDPrefix="agent-experience-type"
          title="Aggiungi esperienza"
        />
      ) : null}

      {step.type === "search" ? (
        <AgentOrganizationSearchStep
          onChangeQuery={setSearchQuery}
          onManualEntry={() => {
            trackProfileEvent("agent_career_manual_opened", {
              profileType: "agent",
            });
            setErrors({});
            setStep({
              draft: step.draft,
              initialDraft: step.initialDraft,
              isEditing: step.isEditing,
              manual: {
                ...EMPTY_MANUAL,
                city: step.draft.organizationCity,
                country: step.draft.organizationCountry,
                name: step.draft.organizationClubId
                  ? ""
                  : step.draft.organizationName,
              },
              type: "manual",
            });
          }}
          onSearchEmpty={() =>
            trackProfileEvent("agent_career_organization_search_empty", {
              profileType: "agent",
            })
          }
          onSearchFailed={() =>
            trackProfileEvent("agent_career_search_failed", {
              profileType: "agent",
            })
          }
          onSearchStarted={() =>
            trackProfileEvent("agent_career_organization_search_started", {
              profileType: "agent",
            })
          }
          onSelect={selectOrganization}
          query={searchQuery}
          search={searchAgentOrganizations}
        />
      ) : null}

      {step.type === "manual" ? (
        <AgentManualOrganizationStep
          draft={step.manual}
          nameError={errors.organization}
          onChange={(patch) => {
            setErrors({});
            setStep((current) =>
              current.type === "manual"
                ? { ...current, manual: { ...current.manual, ...patch } }
                : current,
            );
          }}
        />
      ) : null}

      {step.type === "form" ? (
        <>
          <AgentExperienceFormStep
            assignment={step.draft}
            errors={errors}
            onChange={patchDraft}
            onChangeOrganization={
              step.isEditing && step.draft.organizationMode === "agency"
                ? () => {
                    setSearchQuery("");
                    setStep({
                      draft: step.draft,
                      initialDraft: step.initialDraft,
                      isEditing: true,
                      type: "search",
                    });
                  }
                : undefined
            }
            roleOptions={roleOptions}
          />

          {/*
            §Screen 7: l'eliminazione è un'azione testuale distruttiva, mai la
            sola icona di un cestino.
          */}
          {step.isEditing ? (
            <Pressable
              accessibilityLabel="Elimina esperienza"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() =>
                setPendingConfirm({ assignmentId: step.draft.id, kind: "delete" })
              }
              style={styles.destructive}
              testID="agent-career-delete"
            >
              <AppText color="danger" variant="titleSm">
                Elimina esperienza
              </AppText>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {step.type === "group" ? (
        <AgentGroupDetail
          groupId={step.groupId}
          groups={groups}
          onSelect={editAssignment}
        />
      ) : null}

      {step.type === "summary" ? (
        <AgentCareerSummaryStep
          groups={groups}
          onAddExperience={startExperience}
          onEditGroup={editGroup}
        />
      ) : null}

      {step.type === "paths" ? (
        <AdditionalPathsStep
          description="Aggiungi eventuali esperienze svolte in altri ruoli nel calcio. Rimarranno separate dalla carriera da procuratore."
          onOpenPath={openPath}
          paths={pathCounts}
          testIDPrefix="agent"
        />
      ) : null}

      <ConfirmModal
        cancelLabel={
          pendingConfirm?.kind === "leave" ? "Continua a modificare" : "Annulla"
        }
        confirmLabel={resolveConfirmLabel(pendingConfirm)}
        destructive={pendingConfirm?.kind === "delete"}
        isBusy={isSaving}
        message={resolveConfirmMessage(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={confirmPending}
        title={resolveConfirmTitle(pendingConfirm)}
        visible={pendingConfirm !== null}
      >
        {pendingConfirm?.kind === "end" ? (
          <DateSelector
            label="Mese di conclusione"
            mode="monthYear"
            onChange={setEndMonthValue}
            placeholder="Mese e anno"
            sheetTitle="Mese di conclusione"
            testID="agent-career-end-month"
            value={endMonthValue}
          />
        ) : null}
      </ConfirmModal>
    </ProfileEditScaffold>
  );

  /**
   * CTA della schermata corrente. Una sola primaria per passo: l'hub e i
   * percorsi chiudono, il form salva, il riepilogo conferma.
   */
  function resolveScaffoldActions() {
    if (step.type === "hub" || step.type === "paths") {
      return { onSave: finishSession, saveLabel: "Fine" } as const;
    }

    if (step.type === "manual") {
      return {
        onSave: confirmManualOrganization,
        saveLabel: "Continua",
      } as const;
    }

    if (step.type === "form") {
      const isCurrent = step.draft.isCurrent;

      return {
        onSave: saveDraft,
        onSecondary: step.isEditing
          ? isCurrent
            ? () =>
                setPendingConfirm({
                  assignmentId: step.draft.id,
                  kind: "end",
                })
            : undefined
          : () => {
              if (isDirty) {
                setPendingConfirm({ kind: "leave" });
                return;
              }

              leaveForm();
            },
        saveLabel: step.isEditing ? "Salva modifiche" : "Salva esperienza",
        saving: isSaving,
        secondaryLabel: step.isEditing ? "Concludi incarico" : "Annulla",
      } as const;
    }

    if (step.type === "summary") {
      return {
        // Nessuna mutation: i record sono già stati persistiti dal form.
        onSave: finishSession,
        saveLabel: "Conferma carriera",
      } as const;
    }

    return {} as const;
  }
}

/**
 * Dettaglio di un gruppo con più incarichi (§"Raggruppamento"): si sceglie
 * quale modificare, invece di indovinare quale intendesse l'utente.
 */
function AgentGroupDetail({
  groupId,
  groups,
  onSelect,
}: {
  groupId: string;
  groups: readonly AgentExperienceGroup[];
  onSelect: (assignmentId: string) => void;
}) {
  const group = groups.find((item) => item.groupId === groupId);

  if (!group) {
    return null;
  }

  return (
    <View style={styles.groupDetail} testID="agent-career-group-detail">
      <AppText color="secondary" variant="bodySm">
        Scegli l&apos;incarico da modificare.
      </AppText>

      {group.rows.map((row) => (
        <Pressable
          accessibilityHint="Apre la modifica di questo incarico"
          accessibilityLabel={[row.periodLabel, row.role]
            .filter(Boolean)
            .join(", ")}
          accessibilityRole="button"
          key={row.assignmentId}
          onPress={() => onSelect(row.assignmentId)}
          style={({ pressed }) => [
            styles.groupRow,
            pressed ? styles.groupRowPressed : null,
          ]}
          testID={`agent-career-assignment-${row.assignmentId}`}
        >
          <View style={styles.groupRowBody}>
            <AppText variant="titleSm">{row.role || "Ruolo da indicare"}</AppText>
            <AppText color="secondary" variant="bodySm">
              {row.periodLabel}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function resolveTitle(step: AgentStep): string {
  switch (step.type) {
    case "select-type":
      return "Esperienze da procuratore";
    case "search":
      return "Cerca agenzia o studio";
    case "manual":
      return "Inserisci organizzazione";
    case "form":
      return step.isEditing
        ? "Modifica esperienza"
        : step.draft.organizationMode === "independent"
          ? "Attività indipendente"
          : "Esperienza in agenzia";
    case "group":
      return "Incarichi";
    case "summary":
      return "Le tue esperienze";
    case "paths":
      return "Percorsi aggiuntivi";
    default:
      return "Gestisci carriera";
  }
}

function resolveConfirmTitle(pending: PendingConfirm | null): string {
  switch (pending?.kind) {
    case "leave":
      return "Uscire senza salvare?";
    case "delete":
      return "Eliminare questa esperienza?";
    case "end":
      return "Concludere questo incarico?";
    case "change-organization":
      return "Cambiare organizzazione?";
    default:
      return "";
  }
}

function resolveConfirmMessage(pending: PendingConfirm | null): string {
  switch (pending?.kind) {
    case "leave":
      return "Le modifiche effettuate andranno perse.";
    case "delete":
      return "L'esperienza verrà rimossa dalla tua carriera.";
    case "end":
      return "Indica il mese in cui si è conclusa l'esperienza.";
    case "change-organization":
      return "Verrà spostato soltanto questo incarico. Gli altri resteranno dove sono.";
    default:
      return "";
  }
}

function resolveConfirmLabel(pending: PendingConfirm | null): string {
  switch (pending?.kind) {
    case "leave":
      return "Esci senza salvare";
    case "delete":
      return "Elimina";
    case "end":
      return "Concludi incarico";
    case "change-organization":
      return "Cambia organizzazione";
    default:
      return "Conferma";
  }
}

const styles = StyleSheet.create({
  skeleton: {
    gap: spacing[12],
  },
  skeletonCard: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[16],
    height: 96,
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[12],
  },
  destructive: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  groupDetail: {
    gap: spacing[12],
  },
  groupRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  groupRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  groupRowBody: {
    gap: spacing[4],
  },
});

export { PATHS as AGENT_CAREER_PATHS };
