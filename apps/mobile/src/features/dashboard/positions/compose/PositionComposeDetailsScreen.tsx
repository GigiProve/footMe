import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardGlobalEmpty, DashboardSkeleton } from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { AgeRangeSheet, type AgeRangeValue } from "./components/AgeRangeSheet";
import { AvailabilitySheet } from "./components/AvailabilitySheet";
import { ComposerFieldRow } from "./components/ComposerFieldRow";
import { ComposerFooter } from "./components/ComposerFooter";
import { ComposerNavBar } from "./components/ComposerNavBar";
import { ComposerOptionSheet } from "./components/ComposerOptionSheet";
import { ComposerStepHeader } from "./components/ComposerStepHeader";
import { ComposerTextField } from "./components/ComposerTextField";
import { COMPOSE_HREFS } from "./compose-routes";
import { COMPOSE_QK } from "./compose-keys";
import {
  PLAYER_EXPERIENCE_LABELS,
  PLAYER_SITUATION_LABELS,
  POSITION_SCHEMAS,
  SOCIETY_DESCRIPTION_PLACEHOLDER,
} from "./compose-schema";
import {
  ageSummary,
  availabilitySummary,
  contextSummary,
  describeComposeError,
  experienceSummary,
  listNames,
  playerExperienceSummary,
  secondaryTeamsHelper,
  validateAgeInput,
  validateText,
} from "./compose-presentation";
import {
  fetchCatalogs,
  fetchComposerContext,
  fetchEligibleTeams,
  fetchPositionDrafts,
  toComposeError,
  updatePositionDraft,
  type PositionPatch,
} from "./compose-service";
import type {
  PositionAgeMode,
  PositionAvailability,
  PositionPlayerExperience,
  PositionPlayerSituation,
} from "./compose-types";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { useComposeSession } from "./ComposeSessionProvider";

type FormState = {
  ageMax: string;
  ageMin: string;
  ageMode: "range" | "unrestricted" | "unset";
  availability: PositionAvailability | null;
  coachQualificationId: string | null;
  description: string;
  experience: string[];
  playerExperience: PositionPlayerExperience | null;
  playerSituation: PositionPlayerSituation | null;
  requirements: string;
  responsibilities: string;
  secondaryTeamIds: string[];
  staffQualification: string;
};

/** Forma minima della patch: il contratto completo vive in `compose-service`. */
type DetailsPatch = Partial<{
  availability: PositionAvailability | null;
  coachQualificationId: string | null;
  experience: string[] | null;
  playerExperience: PositionPlayerExperience | null;
  playerSituation: PositionPlayerSituation | null;
  requirements: string | null;
  responsibilities: string | null;
  staffQualification: string | null;
}>;

type LocalPatch = Partial<{
  ageMax: number | null;
  ageMin: number | null;
  ageMode: PositionAgeMode;
  description: string | null;
  details: DetailsPatch;
  secondaryTeamIds: string[];
}>;

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  return sortedA.every((value, index) => value === sortedB[index]);
}

function formFromDraft(draft: {
  ageMax: number | null;
  ageMin: number | null;
  ageMode: PositionAgeMode;
  description: string | null;
  details: {
    availability?: PositionAvailability;
    coachQualificationId?: string;
    experience?: string[];
    playerExperience?: PositionPlayerExperience;
    playerSituation?: PositionPlayerSituation;
    requirements?: string;
    responsibilities?: string;
    staffQualification?: string;
  };
  secondaryTeams: readonly { teamId: string }[];
}): FormState {
  return {
    ageMax: draft.ageMax !== null ? String(draft.ageMax) : "",
    ageMin: draft.ageMin !== null ? String(draft.ageMin) : "",
    ageMode: draft.ageMode,
    availability: draft.details.availability ?? null,
    coachQualificationId: draft.details.coachQualificationId ?? null,
    description: draft.description ?? "",
    experience: draft.details.experience ?? [],
    playerExperience: draft.details.playerExperience ?? null,
    playerSituation: draft.details.playerSituation ?? null,
    requirements: draft.details.requirements ?? "",
    responsibilities: draft.details.responsibilities ?? "",
    secondaryTeamIds: draft.secondaryTeams.map((team) => team.teamId),
    staffQualification: draft.details.staffQualification ?? "",
  };
}

/**
 * Step 2 di dettaglio: una sola Position (DAS-REV-16 §11-§20, screen 05, 06,
 * 08, 10).
 */
export function PositionComposeDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { isDirty, markClean, markDirty } = useComposeSession();

  const params = useLocalSearchParams<{ from?: "hub" | "single"; positionId: string }>();
  const positionId = params.positionId;
  const from = params.from === "single" ? "single" : "hub";

  const draftsQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchPositionDrafts([positionId]),
    queryKey: COMPOSE_QK.drafts(actorId, [positionId]),
    staleTime: STALE_MS.operational,
  });

  const draft = draftsQuery.data?.[0] ?? null;

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  /* Il catalogo dipende dal solo profilo, non dall'actor: è pubblico per
     chiunque sia autenticato, e una chiave per amministratore ne avrebbe
     moltiplicato le letture senza cambiarne il contenuto. */
  const profileType = draft?.profileType ?? null;

  const catalogsQuery = useQuery({
    enabled: profileType !== null,
    queryFn: () => fetchCatalogs(profileType ?? "player"),
    queryKey: COMPOSE_QK.catalogs(profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  const schema = draft ? POSITION_SCHEMAS[draft.profileType] : null;
  const limits = contextQuery.data?.limits ?? null;
  const needsTeams = !!schema?.fields.some((field) => field.kind === "secondaryTeams");

  const teamsQuery = useQuery({
    enabled: needsTeams && !!clubId,
    queryFn: () => fetchEligibleTeams(clubId as string),
    queryKey: COMPOSE_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  /**
   * Il buffer locale si risincronizza solo quando arriva una **versione**
   * nuova del draft, non a ogni refetch: §21 vieta di confondere «non ancora
   * caricato» con «appena sovrascritto dall'utente», e TanStack restituisce
   * un oggetto nuovo anche quando i dati non sono cambiati.
   *
   * È un aggiustamento di stato in render, non un effetto: la sincronia con
   * un dato che arriva dall'esterno non ha niente da sottoscrivere, e un
   * `useEffect` farebbe lampeggiare un form vuoto per un frame prima di
   * riempirlo.
   */
  const draftKey = draft ? `${draft.id}:${draft.resourceVersion}` : null;

  if (draft && draftKey && draftKey !== syncedKey) {
    const next = formFromDraft(draft);

    setSyncedKey(draftKey);
    setForm(next);
    setOriginal(next);
    setFieldErrors({});
    setSaveError(null);
  }

  const [ageSheetVisible, setAgeSheetVisible] = useState(false);
  const [availabilitySheetVisible, setAvailabilitySheetVisible] = useState(false);
  const [playerExperienceSheetVisible, setPlayerExperienceSheetVisible] = useState(false);
  const [playerExperienceCategoryVisible, setPlayerExperienceCategoryVisible] = useState(false);
  const [playerSituationSheetVisible, setPlayerSituationSheetVisible] = useState(false);
  const [coachQualificationSheetVisible, setCoachQualificationSheetVisible] = useState(false);
  const [experienceSheetVisible, setExperienceSheetVisible] = useState(false);
  const [experienceDraftSelection, setExperienceDraftSelection] = useState<string[]>([]);
  const [secondaryTeamsSheetVisible, setSecondaryTeamsSheetVisible] = useState(false);
  const [secondaryTeamsDraftSelection, setSecondaryTeamsDraftSelection] = useState<string[]>([]);

  /**
   * La destinazione dopo un salvataggio riuscito dipende da chi ha chiesto
   * il salvataggio, non dal profilo: la CTA segue l'origine (§11), mentre
   * «Salva bozza ed esci» del dialogo di §27 esce e basta.
   */
  const mutation = useMutation({
    mutationFn: ({ patch }: { exitAfter: boolean; patch: PositionPatch }) =>
      updatePositionDraft({
        expectedVersion: draft!.resourceVersion,
        patch,
        positionId: draft!.id,
      }),
    onError: (error) => {
      /* §21: «Un errore mantiene il form e quanto digitato.» Nessuna
         navigazione, nessun `markClean`: il buffer resta da salvare. */
      setSaveError(describeComposeError(toComposeError(error)));
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["position-compose-drafts"] });
      markClean();

      if (variables.exitAfter || from !== "single") {
        router.back();
      } else {
        router.push(COMPOSE_HREFS.previewSingle(draft!.id) as never);
      }
    },
  });

  /**
   * Uscita dal dettaglio (§27).
   *
   * «Con modifiche non persistite mostra Uscire senza salvare? … Azioni:
   * Continua a modificare, Salva bozza ed esci quando il salvataggio è
   * consentito e valido, Esci senza salvare.»
   *
   * È l'hook già usato dai sei editor di profilo, esteso con la terza
   * azione: §27 chiede anche che il back di sistema e la gesture si
   * comportino come il chevron, e `beforeRemove` è l'unico punto che le
   * intercetta entrambe.
   *
   * `onSaveAndLeave` è `undefined` quando il salvataggio non sarebbe
   * valido: §27 la vuole «quando il salvataggio è consentito e valido», e
   * un pulsante che fallisce sistematicamente non è un'uscita.
   */
  const confirmExit = useUnsavedChangesGuard({
    /* Finché la bozza non è caricata non c'è buffer da proteggere, e un
       dialogo su una schermata ancora vuota bloccherebbe il back. */
    isDirty: isDirty && draft !== null,
    isSaving: mutation.isPending,
    onLeave: () => {
      /* §27: «Scartare il buffer non elimina bozze già persistite.» Il
         record resta dov'è; si butta via solo ciò che non era stato
         ancora salvato. */
      markClean();
      router.back();
    },
    onSaveAndLeave:
      Object.keys(localErrors()).length === 0
        ? () => handleSave(true)
        : undefined,
  });

  if (draftsQuery.isLoading || contextQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!draft || !form || !original) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna indietro",
            body: "Potrebbe essere stata eliminata o non essere più nel tuo perimetro.",
            icon: "briefcase-outline",
            title: "Questa posizione non è più disponibile.",
          }}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const catalogs = catalogsQuery.data ?? null;
  const teams = teamsQuery.data ?? [];

  function updateForm(patch: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    markDirty();
  }

  function secondaryTeamNames(ids: readonly string[]): string[] {
    const source = teams.length > 0 ? teams : draft!.secondaryTeams.map((team) => ({ teamId: team.teamId, teamName: team.name }));

    return ids
      .map((id) => source.find((team) => team.teamId === id)?.teamName)
      .filter((name): name is string => !!name);
  }

  function handleAgeConfirm(value: AgeRangeValue) {
    if (value.mode === "unrestricted") {
      updateForm({ ageMax: "", ageMin: "", ageMode: "unrestricted" });
    } else {
      updateForm({ ageMax: value.max, ageMin: value.min, ageMode: "range" });
    }

    setFieldErrors((prev) => ({ ...prev, ageRange: null }));
    setAgeSheetVisible(false);
  }

  function handleAvailabilityConfirm(value: PositionAvailability | null) {
    updateForm({ availability: value });
    setAvailabilitySheetVisible(false);
  }

  function handlePlayerExperienceOption(id: string) {
    if (id === "none") {
      updateForm({ playerExperience: null });
      setPlayerExperienceSheetVisible(false);
      return;
    }

    if (id === "from_category") {
      // §14: la scelta "da categoria" non si applica da sola, serve il
      // secondo livello col catalogo categorie.
      setPlayerExperienceSheetVisible(false);
      setPlayerExperienceCategoryVisible(true);
      return;
    }

    updateForm({ playerExperience: { mode: id as "higher_categories" | "in_category" } });
    setPlayerExperienceSheetVisible(false);
  }

  function handlePlayerExperienceCategory(levelId: string) {
    updateForm({ playerExperience: { levelId, mode: "from_category" } });
    setPlayerExperienceCategoryVisible(false);
  }

  function handlePlayerSituationOption(id: string) {
    updateForm({ playerSituation: id === "none" ? null : (id as PositionPlayerSituation) });
    setPlayerSituationSheetVisible(false);
  }

  function handleCoachQualificationOption(id: string) {
    updateForm({ coachQualificationId: id === "none" ? null : id });
    setCoachQualificationSheetVisible(false);
  }

  function openExperienceSheet() {
    setExperienceDraftSelection(form!.experience);
    setExperienceSheetVisible(true);
  }

  function toggleExperienceOption(id: string) {
    setExperienceDraftSelection((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }

  function confirmExperienceSheet() {
    updateForm({ experience: experienceDraftSelection });
    setExperienceSheetVisible(false);
  }

  function openSecondaryTeamsSheet() {
    setSecondaryTeamsDraftSelection(form!.secondaryTeamIds);
    setSecondaryTeamsSheetVisible(true);
  }

  function toggleSecondaryTeamOption(id: string) {
    setSecondaryTeamsDraftSelection((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }

  function confirmSecondaryTeamsSheet() {
    updateForm({ secondaryTeamIds: secondaryTeamsDraftSelection });
    setSecondaryTeamsSheetVisible(false);
  }

  function navigateAfterNoop(exitAfter = false) {
    markClean();

    if (!exitAfter && from === "single") {
      router.push(COMPOSE_HREFS.previewSingle(draft!.id) as never);
    } else {
      router.back();
    }
  }

  function buildPatch(): LocalPatch {
    const patch: LocalPatch = {};

    if (form!.description !== original!.description) {
      patch.description = form!.description.trim() === "" ? null : form!.description;
    }

    if (
      form!.ageMode !== original!.ageMode ||
      form!.ageMin !== original!.ageMin ||
      form!.ageMax !== original!.ageMax
    ) {
      patch.ageMode = form!.ageMode as PositionAgeMode;
      patch.ageMin = form!.ageMode === "range" ? Number(form!.ageMin) : null;
      patch.ageMax = form!.ageMode === "range" ? Number(form!.ageMax) : null;
    }

    if (!arraysEqual(form!.secondaryTeamIds, original!.secondaryTeamIds)) {
      patch.secondaryTeamIds = form!.secondaryTeamIds;
    }

    const details: DetailsPatch = {};

    if (JSON.stringify(form!.availability) !== JSON.stringify(original!.availability)) {
      details.availability = form!.availability ?? null;
    }

    if (!arraysEqual(form!.experience, original!.experience)) {
      details.experience = form!.experience.length > 0 ? form!.experience : null;
    }

    if (JSON.stringify(form!.playerExperience) !== JSON.stringify(original!.playerExperience)) {
      details.playerExperience = form!.playerExperience ?? null;
    }

    if (form!.playerSituation !== original!.playerSituation) {
      details.playerSituation = form!.playerSituation ?? null;
    }

    if (form!.coachQualificationId !== original!.coachQualificationId) {
      details.coachQualificationId = form!.coachQualificationId ?? null;
    }

    if (form!.staffQualification !== original!.staffQualification) {
      details.staffQualification = form!.staffQualification.trim() === "" ? null : form!.staffQualification;
    }

    if (form!.requirements !== original!.requirements) {
      details.requirements = form!.requirements.trim() === "" ? null : form!.requirements;
    }

    // Non elencato esplicitamente fra i campi "dentro details" della
    // specifica, ma appartiene comunque a PositionDetails (solo Dirigente):
    // va trattato come gli altri testuali, altrimenti non sarebbe mai
    // salvabile.
    if (form!.responsibilities !== original!.responsibilities) {
      details.responsibilities =
        form!.responsibilities.trim() === "" ? null : form!.responsibilities;
    }

    if (Object.keys(details).length > 0) {
      patch.details = details;
    }

    return patch;
  }

  /**
   * Validazione locale, la stessa che decide se «Salva bozza ed esci» sia
   * un'azione offribile (§27: «quando il salvataggio è consentito e
   * valido»). Restituisce la mappa degli errori senza scriverla, così il
   * dialogo può interrogarla senza accendere errori sul form.
   */
  function localErrors(): Record<string, string | null> {
    const errors: Record<string, string | null> = {};

    if (!limits || !form || !schema) {
      return errors;
    }

    if (
      schema.fields.some((field) => field.kind === "ageRange") &&
      form.ageMode === "range"
    ) {
      const error = validateAgeInput(
        { max: form.ageMax, min: form.ageMin, mode: "range" },
        limits,
      );

      if (error) {
        errors.ageRange = error;
      }
    }

    for (const field of schema.fields) {
      if (
        (field.kind === "shortText" || field.kind === "longText") &&
        field.limitKey
      ) {
        const value = (form as unknown as Record<string, string>)[field.key] ?? "";
        const error = validateText(value, limits[field.limitKey]);

        if (error) {
          errors[field.key] = error;
        }
      }
    }

    return errors;
  }

  function handleSave(exitAfter = false) {
    if (!limits) {
      return;
    }

    const errors = localErrors();

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // §11: un errore formale blocca il salvataggio e basta, la CTA non
      // naviga qui qualunque sia l'origine.
      return;
    }

    const patch = buildPatch();

    if (Object.keys(patch).length === 0) {
      // §21: una patch vuota non deve bumpare resourceVersion per nulla.
      navigateAfterNoop(exitAfter);
      return;
    }

    mutation.mutate({ exitAfter, patch: patch as unknown as PositionPatch });
  }

  const showNoDetailsHint =
    from === "single" && schema!.guidance !== null && !draft.hasDetails;

  const ageRangeValid =
    form.ageMode === "range" && limits
      ? validateAgeInput({ max: form.ageMax, min: form.ageMin, mode: "range" }, limits) === null
      : false;

  const secondaryNames = secondaryTeamNames(form.secondaryTeamIds);
  const secondaryOptions = teams
    .filter((team) => team.teamId !== draft.teamId && team.canCreate)
    .map((team) => ({ id: team.teamId, label: team.teamName }));

  const playerExperienceSelected = !form.playerExperience
    ? ["none"]
    : form.playerExperience.mode === "from_category"
      ? ["from_category"]
      : [form.playerExperience.mode];

  const playerExperienceOptions = [
    ...Object.entries(PLAYER_EXPERIENCE_LABELS).map(([id, label]) => ({ id, label })),
    { id: "none", label: "Nessuna preferenza" },
  ];

  const playerSituationOptions = [
    ...Object.entries(PLAYER_SITUATION_LABELS).map(([id, label]) => ({ id, label })),
    { id: "none", label: "Nessuna preferenza" },
  ];

  const qualificationOptions = [
    ...(catalogs?.qualifications ?? []).map((item) => ({ id: item.id, label: item.label })),
    { id: "none", label: "Nessuna preferenza" },
  ];

  // §17: un incarico SOCIETY non ha una categoria di riferimento, quindi le
  // opzioni di esperienza che la richiedono non hanno senso.
  const experienceOptions = (catalogs?.experiences ?? [])
    .filter((item) => draft.scope !== "society" || !item.needsContext)
    .map((item) => ({ id: item.id, label: item.label }));

  const primaryLabel = from === "hub" ? "Salva dettagli" : "Anteprima";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ComposerNavBar
          isVerified={contextQuery.data?.clubIsVerified ?? draft.clubIsVerified}
          logoUrl={contextQuery.data?.clubLogoUrl ?? draft.clubLogoUrl}
          name={contextQuery.data?.clubName ?? draft.clubName}
          onBack={confirmExit}
        />

      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <ComposerStepHeader
          context={contextSummary(draft)}
          step={2}
          title={draft.title ?? "Posizione"}
        />

        {showNoDetailsHint ? (
          <AppText color="neutralMuted" variant="bodySm">
            Puoi proseguire anche senza aggiungere dettagli.
          </AppText>
        ) : null}

        {catalogsQuery.isError ? (
          <View style={styles.errorBlock}>
            <AppText color="neutral" variant="bodySm">
              {describeComposeError(toComposeError(catalogsQuery.error))}
            </AppText>
            <Button label="Riprova" onPress={() => catalogsQuery.refetch()} variant="secondary" />
          </View>
        ) : (
          schema!.fields.map((field) => {
            if (field.kind === "ageRange") {
              return (
                <View key={field.key}>
                  <ComposerFieldRow
                    error={fieldErrors.ageRange}
                    label={field.label}
                    onPress={() => setAgeSheetVisible(true)}
                    optional={false}
                    value={ageSummary({
                      ageMax: form.ageMax === "" ? null : Number(form.ageMax),
                      ageMin: form.ageMin === "" ? null : Number(form.ageMin),
                      ageMode: form.ageMode,
                    })}
                  />

                  {ageRangeValid && draft.contextLabel ? (
                    <AppText color="neutralMuted" variant="meta">
                      {`Questa fascia d'età potrebbe non essere compatibile con ${draft.contextLabel}. Verifica le regole della competizione.`}
                    </AppText>
                  ) : null}
                </View>
              );
            }

            if (field.kind === "availability") {
              return (
                <ComposerFieldRow
                  key={field.key}
                  label={field.label}
                  onPress={() => setAvailabilitySheetVisible(true)}
                  optional
                  value={availabilitySummary(form.availability ?? undefined, catalogs?.seasons ?? [])}
                />
              );
            }

            if (field.kind === "playerExperience") {
              return (
                <ComposerFieldRow
                  key={field.key}
                  label={field.label}
                  onPress={() => setPlayerExperienceSheetVisible(true)}
                  optional
                  value={playerExperienceSummary(form.playerExperience ?? undefined, catalogs?.categories ?? [])}
                />
              );
            }

            if (field.kind === "playerSituation") {
              return (
                <ComposerFieldRow
                  key={field.key}
                  label={field.label}
                  onPress={() => setPlayerSituationSheetVisible(true)}
                  optional
                  value={
                    form.playerSituation
                      ? (PLAYER_SITUATION_LABELS[form.playerSituation] ?? null)
                      : null
                  }
                />
              );
            }

            if (field.kind === "coachQualification") {
              const selectedQualification = catalogs?.qualifications.find(
                (item) => item.id === form.coachQualificationId,
              );

              return (
                <ComposerFieldRow
                  key={field.key}
                  label={field.label}
                  onPress={() => setCoachQualificationSheetVisible(true)}
                  optional
                  value={selectedQualification?.label ?? null}
                />
              );
            }

            if (field.kind === "experienceMulti") {
              return (
                <ComposerFieldRow
                  key={field.key}
                  label={field.label}
                  onPress={openExperienceSheet}
                  optional
                  value={experienceSummary(form.experience, catalogs?.experiences ?? [])}
                />
              );
            }

            if (field.kind === "secondaryTeams") {
              return (
                <ComposerFieldRow
                  helper={secondaryTeamsHelper(draft.profileType, secondaryNames)}
                  key={field.key}
                  label={field.label}
                  onPress={openSecondaryTeamsSheet}
                  optional
                  value={secondaryNames.length > 0 ? listNames(secondaryNames) : null}
                />
              );
            }

            // shortText / longText
            const value = (form as unknown as Record<string, string>)[field.key] ?? "";
            const placeholder =
              field.key === "description" && draft.scope === "society"
                ? SOCIETY_DESCRIPTION_PLACEHOLDER
                : field.placeholder;

            return (
              <ComposerTextField
                error={fieldErrors[field.key]}
                key={field.key}
                label={field.label}
                limit={limits ? limits[field.limitKey!] : 0}
                multiline={field.kind === "longText"}
                onChangeText={(text: string) =>
                  updateForm({ [field.key]: text } as Partial<FormState>)
                }
                optional={field.optional}
                placeholder={placeholder}
                value={value}
              />
            );
          })
        )}
      </ScrollView>

      {saveError ? (
        <AppText color="danger" style={styles.saveError} variant="meta">
          {saveError}
        </AppText>
      ) : null}

      <ComposerFooter
        onPrimary={handleSave}
        primaryLabel={primaryLabel}
        primaryLoading={mutation.isPending}
      />

      <AgeRangeSheet
        initial={
          form.ageMode === "unrestricted"
            ? { mode: "unrestricted" }
            : form.ageMode === "range"
              ? { max: form.ageMax, min: form.ageMin, mode: "range" }
              : null
        }
        limits={limits ?? { ageMax: 99, ageMin: 0 }}
        onClose={() => setAgeSheetVisible(false)}
        onConfirm={handleAgeConfirm}
        visible={ageSheetVisible}
      />

      <AvailabilitySheet
        initial={form.availability}
        onClose={() => setAvailabilitySheetVisible(false)}
        onConfirm={handleAvailabilityConfirm}
        seasons={catalogs?.seasons ?? []}
        visible={availabilitySheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna opzione disponibile."
        onClose={() => setPlayerExperienceSheetVisible(false)}
        onToggle={handlePlayerExperienceOption}
        options={playerExperienceOptions}
        selected={playerExperienceSelected}
        title="Esperienza richiesta"
        visible={playerExperienceSheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna categoria disponibile."
        onClose={() => setPlayerExperienceCategoryVisible(false)}
        onToggle={handlePlayerExperienceCategory}
        options={(catalogs?.categories ?? []).map((item) => ({ id: item.id, label: item.label }))}
        selected={
          form.playerExperience?.mode === "from_category" && form.playerExperience.levelId
            ? [form.playerExperience.levelId]
            : []
        }
        title="Esperienza richiesta"
        visible={playerExperienceCategoryVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna opzione disponibile."
        onClose={() => setPlayerSituationSheetVisible(false)}
        onToggle={handlePlayerSituationOption}
        options={playerSituationOptions}
        selected={form.playerSituation ? [form.playerSituation] : ["none"]}
        title="Situazione del calciatore"
        visible={playerSituationSheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna qualifica disponibile."
        onClose={() => setCoachQualificationSheetVisible(false)}
        onToggle={handleCoachQualificationOption}
        options={qualificationOptions}
        selected={form.coachQualificationId ? [form.coachQualificationId] : ["none"]}
        title="Patentino / qualifica richiesta"
        visible={coachQualificationSheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna esperienza disponibile."
        multiple
        onClose={() => setExperienceSheetVisible(false)}
        onConfirm={confirmExperienceSheet}
        onToggle={toggleExperienceOption}
        options={experienceOptions}
        selected={experienceDraftSelection}
        title="Esperienza richiesta"
        visible={experienceSheetVisible}
      />

      <ComposerOptionSheet
        contextLabel="Squadra principale"
        contextValue={draft.teamName}
        emptyMessage="Nessun'altra squadra disponibile."
        helper={
          draft.profileType === "coach"
            ? "Seleziona altre squadre solo se lo stesso allenatore seguirà anche queste squadre."
            : "Seleziona altre squadre solo se la stessa persona seguirà anche queste squadre."
        }
        multiple
        onClose={() => setSecondaryTeamsSheetVisible(false)}
        onConfirm={confirmSecondaryTeamsSheet}
        onToggle={toggleSecondaryTeamOption}
        options={secondaryOptions}
        selected={secondaryTeamsDraftSelection}
        title="Altre squadre coinvolte nell'incarico"
        visible={secondaryTeamsSheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* La barra condivide il gutter orizzontale del contenuto: senza, il back
     resta incollato al bordo e la app bar non si allinea alle altre
     schermate del flusso. */
  bar: {
    paddingHorizontal: spacing[20],
  },
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  errorBlock: {
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
  saveError: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  /* §4: «il footer resta sopra safe area e tastiera, con spazio di
     scorrimento sufficiente dopo l'ultimo campo.» Senza `flex: 1` la
     ScrollView si dimensiona sul contenuto e il footer risale sotto
     l'ultimo campo invece di restare in fondo. */
  scroll: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
