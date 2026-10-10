/**
 * Form condiviso di creazione e modifica squadra (master 02, 03, 04, 05, 06).
 *
 * Un solo componente, due titoli (§13). Le differenze fra "Nuova squadra" e
 * "Modifica squadra" sono i valori iniziali e la mutazione finale: duplicare
 * la schermata avrebbe fatto divergere validazioni, ereditarietà e controllo
 * duplicati, che la task vuole identici.
 *
 * Flusso focalizzato: nessuna bottom navigation, nessun selector identità,
 * nessuna campanella (§4). Si esce dal back, e il back passa dal dialogo
 * condiviso quando ci sono modifiche non salvate (§23).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../theme/tokens";
import { AppText, useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import { OnboardingTextField } from "../onboarding/ui";
import { ProfileEditScaffold } from "../profiles/edit/ProfileEditScaffold";
import { ProfileEditFieldsSkeleton, ProfileEditErrorState } from "../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../profiles/edit/use-unsaved-changes-guard";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
} from "../profiles/media-upload-service";
import { DuplicateTeamSheet } from "./components/DuplicateTeamSheet";
import { TeamCityModal } from "./components/TeamCityModal";
import { TeamCrestField } from "./components/TeamCrestField";
import { TeamFieldRow } from "./components/TeamFieldRow";
import { TeamLevelSelector } from "./components/TeamLevelSelector";
import { TeamSelectorModal } from "./components/TeamSelectorModal";
import { TeamsContextHeader } from "./components/TeamsContextHeader";
import { TEAMS_QK } from "./teams-keys";
import { trackTeamsEvent } from "./teams-analytics";
import {
  buildTeamPatch,
  canSubmitCreate,
  canSubmitUpdate,
  isTeamDraftDirty,
  normalizeTeamName,
  TEAM_NAME_MAX,
  type TeamDraft,
} from "./team-form-model";
import { currentSeasonLabel, teamErrorMessage } from "./teams-presentation";
import {
  checkTeamDuplicates,
  createClubTeam,
  fetchTeamEditor,
  fetchTeamLevelOptions,
  fetchTeamsCenter,
  fetchTeamTypeOptions,
  toTeamError,
  updateClubTeam,
  type DuplicateCandidate,
} from "./teams-service";

const GENERIC_CREATE_ERROR = "Non è stato possibile creare la squadra. Riprova.";
const GENERIC_UPDATE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

type Props =
  | { clubId: string; mode: "create" }
  | { mode: "edit"; teamId: string };

function emptyDraft(): TeamDraft {
  return {
    city: "",
    cityMode: "inherited",
    crestMode: "inherited",
    crestUrl: null,
    levelId: null,
    levelLabel: null,
    name: "",
    region: "",
    typeId: null,
    typeLabel: null,
  };
}

function randomKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback deterministicamente unico quanto basta a una sessione: la
  // chiave serve a riconoscere **lo stesso** tentativo, non a essere
  // irripetibile nell'universo.
  return `${Date.now()}-${Math.trunc(Math.random() * 1_000_000_000)}`;
}

export function TeamFormScreen(props: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const isCreate = props.mode === "create";

  const editorQuery = useQuery({
    enabled: !isCreate && !!actorId,
    queryFn: () => fetchTeamEditor((props as { teamId: string }).teamId),
    queryKey: TEAMS_QK.editor(actorId, isCreate ? "" : (props as { teamId: string }).teamId),
    retry: false,
  });

  const clubId = isCreate
    ? (props as { clubId: string }).clubId
    : (editorQuery.data?.clubId ?? "");

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchTeamsCenter(clubId),
    queryKey: TEAMS_QK.center(actorId, clubId),
  });

  const typesQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchTeamTypeOptions,
    queryKey: TEAMS_QK.types(),
    staleTime: 15 * 60 * 1000,
  });

  const club = centerQuery.data ?? null;
  const editor = editorQuery.data ?? null;
  const seasonId = editor?.seasonId ?? club?.seasonId ?? null;
  const seasonLabel = editor?.seasonLabel ?? club?.seasonLabel ?? null;
  const hasSeasonConfig = isCreate ? true : Boolean(editor?.seasonConfigId);

  const initialDraft = useMemo<TeamDraft | null>(() => {
    if (isCreate) {
      if (!club) {
        return null;
      }

      return {
        city: club.clubCity ?? "",
        cityMode: "inherited",
        crestMode: "inherited",
        crestUrl: club.clubLogoUrl,
        levelId: null,
        levelLabel: null,
        // §14: il prefill è un valore effettivo modificabile, non un
        // placeholder, e si applica alla sola inizializzazione.
        name: club.clubName ?? "",
        region: club.clubRegion ?? "",
        typeId: null,
        typeLabel: null,
      };
    }

    if (!editor) {
      return null;
    }

    return {
      city: editor.city ?? "",
      cityMode: editor.cityMode,
      crestMode: editor.crestMode,
      crestUrl: editor.crestUrl,
      levelId: editor.levelId,
      levelLabel: editor.levelLabel,
      name: editor.name,
      region: editor.region ?? "",
      typeId: editor.typeId,
      typeLabel: editor.typeLabel,
    };
  }, [club, editor, isCreate]);

  const [draft, setDraft] = useState<TeamDraft | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    candidates: DuplicateCandidate[];
    overridable: boolean;
    token: string | null;
  } | null>(null);

  const idempotencyKey = useRef<string>(randomKey());
  const form = draft ?? initialDraft ?? emptyDraft();
  const isReady = Boolean(initialDraft);

  /**
   * Livelli compatibili con il Tipo corrente. Serve alla **validazione** di
   * §15 — «conservare il Livello soltanto se ancora compatibile» — non alla
   * ricerca del selector, che interroga per conto proprio con il testo
   * digitato. Con query vuota le due condividono chiave e risposta.
   */
  const compatibleLevelsQuery = useQuery({
    enabled: Boolean(form.typeId),
    queryFn: () => fetchTeamLevelOptions(form.typeId as string, seasonId, null),
    queryKey: TEAMS_QK.levels(form.typeId ?? "", seasonId, ""),
  });

  const isDirty = Boolean(
    initialDraft && draft && isTeamDraftDirty(initialDraft, draft),
  );

  /**
   * Ogni modifica del draft invalida ciò che era stato verificato sui dati
   * precedenti: il token di conferma duplicati (§20, «se cambiano i dati o il
   * contesto, ripetere il controllo») e la chiave di idempotenza, che
   * identifica **quel** tentativo di creazione e non il successivo.
   */
  const patch = useCallback(
    (changes: Partial<TeamDraft>) => {
      setErrorMessage(null);
      setDuplicate(null);
      idempotencyKey.current = randomKey();
      setDraft((current) => ({
        ...(current ?? initialDraft ?? emptyDraft()),
        ...changes,
      }));
    },
    [initialDraft],
  );

  /**
   * §15, dopo il cambio di Tipo: «conservare il Livello soltanto se ancora
   * compatibile; altrimenti rimuoverlo dal draft e spiegare».
   *
   * La rimozione avviene sul **draft**, non sul record: finché non si salva,
   * la configurazione in database conserva il campionato che aveva.
   */
  useEffect(() => {
    const options = compatibleLevelsQuery.data;

    if (!form.typeId || !form.levelId || !options) {
      return;
    }

    if (!options.some((option) => option.id === form.levelId)) {
      setNotice("Seleziona un livello compatibile con il nuovo tipo.");
      setDraft((current) =>
        current ? { ...current, levelId: null, levelLabel: null } : current,
      );
    }
  }, [compatibleLevelsQuery.data, form.levelId, form.typeId]);

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving,
    onLeave: () => {
      trackTeamsEvent("teams_unsaved_exit", { dirty: isDirty, mode: props.mode });
      router.back();
    },
  });

  const uploadCrest = useCallback(async () => {
    if (!actorId) {
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const uploaded = await pickAndUploadMedia({
        aspect: [1, 1],
        folder: "team-crests",
        mediaTypes: ["images"],
        userId: actorId,
      });

      const first = uploaded[0];

      if (first) {
        trackTeamsEvent("teams_crest_mode_changed", { mode: "custom" });
        patch({ crestMode: "custom", crestUrl: first.url });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ProfileMediaUploadError
          ? "Non è stato possibile caricare lo stemma. Riprova."
          : "Non è stato possibile caricare lo stemma. Riprova.",
      );
    } finally {
      setUploading(false);
    }
  }, [actorId, patch]);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: TEAMS_QK.center(actorId, clubId) }),
      queryClient.invalidateQueries({ queryKey: TEAMS_QK.page(actorId, clubId) }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-society-overview", actorId] }),
      queryClient.invalidateQueries({ queryKey: ["club-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["society-master-profile"] }),
    ]);
  }, [actorId, clubId, queryClient]);

  const commitCreate = useCallback(
    async (token: string | null) => {
      setSaving(true);
      setErrorMessage(null);

      try {
        const result = await createClubTeam({
          city: form.cityMode === "custom" ? form.city : null,
          cityMode: form.cityMode,
          clubId,
          confirmationToken: token,
          crestMode: form.crestMode,
          crestUrl: form.crestMode === "custom" ? form.crestUrl : null,
          idempotencyKey: idempotencyKey.current,
          levelId: form.levelId,
          name: normalizeTeamName(form.name),
          region: form.cityMode === "custom" ? form.region : null,
          seasonId,
          typeId: form.typeId as string,
        });

        await invalidate();
        trackTeamsEvent("teams_create_result", { outcome: "success" });
        showToast({ message: "Squadra creata." });
        setDuplicate(null);
        setDraft(initialDraft);

        // §12: il dettaglio operativo non è disponibile, quindi si torna al
        // Centro aggiornato invece di aprire una destinazione inesistente.
        router.back();

        return result;
      } catch (error) {
        const teamError = toTeamError(error);
        trackTeamsEvent("teams_create_result", {
          code: teamError.code,
          outcome: "error",
        });
        setErrorMessage(teamErrorMessage(teamError.code, GENERIC_CREATE_ERROR));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [clubId, form, initialDraft, invalidate, router, seasonId, showToast],
  );

  const commitUpdate = useCallback(
    async (token: string | null) => {
      if (!editor || !initialDraft) {
        return;
      }

      setSaving(true);
      setErrorMessage(null);

      try {
        await updateClubTeam({
          confirmationToken: token,
          expectedSeasonVersion: editor.seasonVersion,
          expectedTeamVersion: editor.teamVersion,
          patch: buildTeamPatch({ draft: form, hasSeasonConfig, initial: initialDraft }),
          seasonId,
          teamId: editor.teamId,
        });

        await Promise.all([
          invalidate(),
          queryClient.invalidateQueries({
            queryKey: TEAMS_QK.editor(actorId, editor.teamId),
          }),
        ]);

        trackTeamsEvent("teams_update_result", { outcome: "success" });
        showToast({ message: "Modifiche salvate." });
        setDuplicate(null);
        setDraft(null);
        router.back();
      } catch (error) {
        const teamError = toTeamError(error);

        if (teamError.code === "TEAM_VERSION_CONFLICT") {
          trackTeamsEvent("teams_version_conflict", { mode: "edit" });
          // §22: i dati digitati restano, la versione aggiornata si va a
          // rileggere. Nessuna sostituzione automatica del lavoro locale.
          void queryClient.invalidateQueries({
            queryKey: TEAMS_QK.editor(actorId, editor.teamId),
          });
        }

        trackTeamsEvent("teams_update_result", {
          code: teamError.code,
          outcome: "error",
        });
        setErrorMessage(teamErrorMessage(teamError.code, GENERIC_UPDATE_ERROR));
      } finally {
        setSaving(false);
      }
    },
    [
      actorId,
      editor,
      form,
      hasSeasonConfig,
      initialDraft,
      invalidate,
      queryClient,
      router,
      seasonId,
      showToast,
    ],
  );

  const submit = useCallback(async () => {
    if (!form.typeId && isCreate) {
      setErrorMessage("Seleziona il tipo di squadra.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    let verdict: Awaited<ReturnType<typeof checkTeamDuplicates>> | null = null;

    try {
      verdict = await checkTeamDuplicates({
        clubId,
        levelId: form.levelId,
        name: normalizeTeamName(form.name),
        teamId: isCreate ? null : (editor?.teamId ?? null),
        typeId: (form.typeId ?? editor?.typeId) as string,
      });
    } catch (error) {
      const teamError = toTeamError(error);
      setSaving(false);
      // §20: «Se il controllo fallisce tecnicamente, preservare il form e
      // consentire Riprova. Non procedere automaticamente come se il
      // controllo fosse riuscito.»
      setErrorMessage(
        teamErrorMessage(
          teamError.code,
          "Non è stato possibile verificare le squadre esistenti. Riprova.",
        ),
      );
      return;
    }

    setSaving(false);

    if (verdict.verdict !== "clear") {
      trackTeamsEvent("teams_duplicate_warning_shown", {
        verdict: verdict.verdict,
      });
      setDuplicate({
        candidates: verdict.candidates,
        overridable: verdict.verdict === "warning",
        token: verdict.confirmationToken,
      });
      return;
    }

    if (isCreate) {
      await commitCreate(null);
    } else {
      await commitUpdate(null);
    }
  }, [clubId, commitCreate, commitUpdate, editor, form, isCreate]);

  if (!isCreate && editorQuery.isError) {
    const teamError = toTeamError(editorQuery.error);

    return (
      <ProfileEditScaffold onBack={() => router.back()} title="Modifica squadra">
        <ProfileEditErrorState
          message={teamErrorMessage(
            teamError.code,
            "Non è stato possibile caricare la squadra. Riprova.",
          )}
          onRetry={() => void editorQuery.refetch()}
        />
      </ProfileEditScaffold>
    );
  }

  const title = isCreate ? "Nuova squadra" : "Modifica squadra";
  const saveLabel = isCreate ? "Crea squadra" : "Salva modifiche";
  const canSave = isCreate
    ? canSubmitCreate({
        draft: form,
        hasSeason: Boolean(seasonId),
        isAuthorized: club?.canCreate ?? false,
        isUploading,
      })
    : canSubmitUpdate({
        draft: form,
        initial: initialDraft,
        isAuthorized: editor?.canEdit ?? false,
        isUploading,
      });

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      notice={notice}
      onBack={handleBack}
      onSave={() => void submit()}
      saveDisabled={!canSave}
      saveLabel={saveLabel}
      saving={isSaving}
      testID="team-form"
      title={title}
    >
      {!isReady ? (
        <ProfileEditFieldsSkeleton />
      ) : (
        <View style={styles.form}>
          <TeamsContextHeader
            isVerified={club?.clubIsVerified ?? editor?.clubIsVerified ?? false}
            logoUrl={club?.clubLogoUrl ?? editor?.clubLogoUrl ?? null}
            name={club?.clubName ?? editor?.clubName ?? "Società"}
            scopeLabel={null}
            seasonLabel={null}
          />

          <OnboardingTextField
            label="Nome squadra"
            maxLength={TEAM_NAME_MAX}
            onChangeText={(value) => patch({ name: value })}
            placeholder="Nome squadra"
            testID="team-name-field"
            value={form.name}
          />

          <AppText color="muted" variant="caption">
            {currentSeasonLabel(seasonLabel) ??
              "Non è stato possibile caricare la stagione corrente. Riprova."}
          </AppText>

          <TeamFieldRow
            label="Tipo squadra"
            onPress={hasSeasonConfig ? () => setTypeOpen(true) : undefined}
            disabled={!hasSeasonConfig}
            placeholder={
              hasSeasonConfig ? "Seleziona tipo squadra" : "Stagione da configurare"
            }
            testID="team-type-field"
            value={form.typeLabel}
          />

          <TeamFieldRow
            disabled={!form.typeId || !hasSeasonConfig}
            label="Livello / campionato"
            onPress={() => setLevelOpen(true)}
            placeholder={
              hasSeasonConfig ? "Seleziona prima il tipo" : "Stagione da configurare"
            }
            testID="team-level-field"
            value={form.levelLabel}
          />

          <TeamCrestField
            clubLogoUrl={club?.clubLogoUrl ?? editor?.clubLogoUrl ?? null}
            isUploading={isUploading}
            mode={form.crestMode}
            onReset={() => {
              trackTeamsEvent("teams_crest_mode_changed", { mode: "inherited" });
              patch({
                crestMode: "inherited",
                crestUrl: club?.clubLogoUrl ?? editor?.clubLogoUrl ?? null,
              });
            }}
            onUpload={() => void uploadCrest()}
            url={form.crestUrl}
          />

          <View style={styles.cityBlock}>
            <View style={styles.cityHeader}>
              <AppText color="secondary" variant="meta">
                Città della squadra
              </AppText>

              <AppText
                accessibilityRole="button"
                color="accent"
                onPress={() => setCityOpen(true)}
                variant="actionLabel"
              >
                Modifica
              </AppText>
            </View>

            <AppText variant="bodyLg">
              {form.city
                ? [form.city, form.region].filter(Boolean).join(", ")
                : "Da specificare"}
            </AppText>

            {form.cityMode === "inherited" ? (
              // §18: helper grigio, non un link per ripristinare un valore
              // già ereditato.
              <AppText color="muted" variant="caption">
                Ereditata dalla società
              </AppText>
            ) : (
              <AppText
                accessibilityRole="button"
                color="accent"
                onPress={() => {
                  trackTeamsEvent("teams_city_mode_changed", { mode: "inherited" });
                  patch({
                    city: club?.clubCity ?? editor?.clubCity ?? "",
                    cityMode: "inherited",
                    region: club?.clubRegion ?? editor?.clubRegion ?? "",
                  });
                }}
                variant="actionLabel"
              >
                Usa la città della società
              </AppText>
            )}
          </View>
        </View>
      )}

      <TeamSelectorModal
        items={(typesQuery.data ?? []).map((option) => ({
          id: option.id,
          label: option.label,
        }))}
        errorMessage={
          typesQuery.isError
            ? "Non è stato possibile caricare i tipi di squadra. Riprova."
            : null
        }
        isLoading={typesQuery.isLoading}
        onClose={() => setTypeOpen(false)}
        onRetry={() => void typesQuery.refetch()}
        onSelect={(id) => {
          const option = (typesQuery.data ?? []).find((item) => item.id === id);
          trackTeamsEvent("teams_type_changed", {});
          patch({ typeId: id, typeLabel: option?.label ?? null });
          setTypeOpen(false);
        }}
        title="Tipo squadra"
        value={form.typeId}
        visible={typeOpen}
      />

      <TeamLevelSelector
        clubId={clubId}
        onClose={() => setLevelOpen(false)}
        onSelect={(option) => {
          trackTeamsEvent("teams_level_changed", { cleared: option === null });
          setNotice(null);
          patch({
            levelId: option?.id ?? null,
            levelLabel: option?.label ?? null,
          });
          setLevelOpen(false);
        }}
        seasonId={seasonId}
        seasonLabel={seasonLabel}
        teamId={isCreate ? null : (editor?.teamId ?? null)}
        typeId={form.typeId}
        typeLabel={form.typeLabel}
        value={form.levelId}
        visible={levelOpen}
      />

      <TeamCityModal
        initialCity={form.city}
        initialRegion={form.region}
        onClose={() => setCityOpen(false)}
        onConfirm={(value) => {
          trackTeamsEvent("teams_city_mode_changed", { mode: "custom" });
          patch({ city: value.city, cityMode: "custom", region: value.region });
          setCityOpen(false);
        }}
        visible={cityOpen}
      />

      <DuplicateTeamSheet
        candidates={duplicate?.candidates ?? []}
        onClose={() => {
          trackTeamsEvent("teams_duplicate_choice", { choice: "dismiss" });
          setDuplicate(null);
        }}
        onCreateAnyway={
          duplicate?.overridable
            ? () => {
                trackTeamsEvent("teams_duplicate_choice", { choice: "create_anyway" });
                const token = duplicate.token;
                setDuplicate(null);
                void (isCreate ? commitCreate(token) : commitUpdate(token));
              }
            : null
        }
        onOpenExisting={(teamId) => {
          trackTeamsEvent("teams_duplicate_choice", { choice: "open_existing" });
          setDuplicate(null);
          router.push(`/club-teams/${encodeURIComponent(teamId)}`);
        }}
        visible={!!duplicate}
      />
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing[18],
  },
  cityBlock: {
    gap: spacing[6],
  },
  cityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
