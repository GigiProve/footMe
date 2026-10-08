/**
 * Attività e mercati del Procuratore (REV-PROF-16, schermata 4).
 *
 * Due dati vicini e diversi, e tenerli distinti è metà del lavoro di questa
 * schermata: un'**attività** dice cosa si fa (scouting, intermediazione), un
 * **mercato** dice dove lo si fa (professionistico, giovanile, estero). Non
 * sono aree geografiche — quelle stanno in "Opportunità" — e non sono
 * categorie di carriera.
 *
 * Le attività principali sono al massimo tre. Al quarto tentativo non
 * succede niente: nessuna scelta precedente viene tolta per far posto, perché
 * sarebbe una decisione presa al posto dell'utente. Compare un messaggio, e
 * basta.
 *
 * Il profilo che arriva dal vecchio modello può avere più di tre attività in
 * `operational_focuses`: la migrazione ne ha promosse tre a principali senza
 * cancellare le altre, e quelle fuori tassonomia restano selezionabili — e
 * quindi *de*selezionabili — finché l'utente non le toglie. Una voce storica
 * che sparisse dall'elenco sarebbe un dato salvato che nessuno può più
 * raggiungere.
 *
 * I mercati non hanno un limite: il prodotto non ne ha mai definito uno, e
 * inventarlo qui avrebbe reso non salvabile un profilo già esistente.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { OnboardingChipMultiSelect, SelectionRow } from "../../../onboarding/ui";
import {
  AGENT_ACTIVITY_SCOPE_OPTIONS,
  AGENT_PRIMARY_ACTIVITY_LIMIT,
  buildAgentActivityOptions,
} from "../../../onboarding/agent/agent-taxonomy";
import { trackProfileEvent } from "../../profile-analytics";
import {
  AGENT_ACTIVITY_LIMIT_MESSAGE,
  toggleAgentActivity,
} from "../agent-edit-rules";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  useAgentProfilePatch,
  useCompleteProfileQuery,
} from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

type ActivitiesForm = {
  activities: string[];
  markets: string[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function AgentActivitiesMarketsScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useAgentProfilePatch(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<ActivitiesForm | null>(() => {
    if (!data) {
      return null;
    }

    const agentProfile = data.agentProfile;
    /*
      Fallback per i profili che non hanno ancora riaperto il modulo: le prime
      tre voci storiche, le stesse che la migrazione avrebbe promosso. Le
      successive restano in `operational_focuses` e questa schermata non le
      tocca.
    */
    const activities =
      (agentProfile?.primary_activities?.length ?? 0) > 0
        ? (agentProfile?.primary_activities ?? [])
        : (agentProfile?.operational_focuses ?? []).slice(
            0,
            AGENT_PRIMARY_ACTIVITY_LIMIT,
          );

    return {
      activities: activities.map((value) => value.trim()).filter(Boolean),
      markets: agentProfile?.activity_scopes ?? [],
    };
  }, [data]);

  const [draft, setDraft] = useState<ActivitiesForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "agent",
          section: "activities",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<ActivitiesForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  /*
    Le voci legacy del profilo si uniscono alla tassonomia solo finché sono
    selezionate: deselezionandole spariscono, e non tornano a far parte delle
    scelte possibili per nessun altro.
  */
  const activityOptions = useMemo(
    () => buildAgentActivityOptions(form?.activities ?? []),
    [form?.activities],
  );

  function handleToggleActivity(value: string) {
    if (!form) {
      return;
    }

    const next = toggleAgentActivity(form.activities, value);

    if (next.atLimit) {
      trackProfileEvent("agent_primary_activities_limit_reached", {
        profileType: "agent",
        section: "activities",
        selectionCount: form.activities.length,
      });
      setLimitMessage(AGENT_ACTIVITY_LIMIT_MESSAGE);
      return;
    }

    setLimitMessage(null);
    patch({ activities: next.activities });
  }

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (form.markets.length === 0) {
      setErrorMessage("Seleziona almeno un mercato.");
      return;
    }

    setErrorMessage(null);

    save.mutate(
      {
        data,
        patch: {
          // Deduplicati: la stessa attività due volte non è una scelta in più.
          activity_scopes: [...new Set(form.markets)],
          primary_activities: [...new Set(form.activities)].slice(
            0,
            AGENT_PRIMARY_ACTIVITY_LIMIT,
          ),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "agent",
            section: "activities",
            success: false,
          });
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : GENERIC_SAVE_ERROR,
          );
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "agent",
            section: "activities",
            selectionCount: form.activities.length,
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saving={save.isPending}
      testID="agent-profile-edit-activities"
      title="Attività e mercati"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={6} testID="agent-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => void profileQuery.refetch()}
          testID="agent-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleSm">Attività principali</AppText>
              <AppText color="secondary" variant="bodySm">
                Seleziona fino a 3 attività in evidenza.
              </AppText>
            </View>

            {activityOptions.map((option, index) => (
              <SelectionRow
                key={option.value}
                label={option.label}
                leading={
                  <Ionicons
                    color={
                      form.activities.includes(option.value)
                        ? colors.accent
                        : colors.textSecondary
                    }
                    name={option.icon as never}
                    size={20}
                  />
                }
                onPress={() => handleToggleActivity(option.value)}
                selected={form.activities.includes(option.value)}
                /*
                  L'indice e non il valore: le voci legacy arrivano dal
                  database e produrrebbero testID con spazi e testo arbitrario.
                */
                testID={`agent-activity-${index}`}
              />
            ))}

            {limitMessage ? (
              <AppText
                accessibilityLiveRegion="polite"
                color="danger"
                testID="agent-activity-limit"
                variant="meta"
              >
                {limitMessage}
              </AppText>
            ) : null}
          </View>

          <View style={styles.section}>
            <AppText variant="titleSm">Mercati</AppText>

            <OnboardingChipMultiSelect
              onChange={(values) => patch({ markets: [...values] })}
              options={AGENT_ACTIVITY_SCOPE_OPTIONS}
              testID="agent-markets"
              values={form.markets}
            />
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[12],
  },
  sectionHeader: {
    gap: spacing[4],
  },
});
