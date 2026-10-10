/**
 * Profilo sportivo (REV-PROF-18, schermata 3).
 *
 * Definisce la configurazione generale del club — struttura e categoria della
 * prima squadra — senza duplicare la gestione delle squadre.
 *
 * Due assenze sono la parte importante di questa schermata:
 *
 *  - non c'è una checklist delle categorie giovanili. Le categorie pubbliche
 *    derivano dalle squadre attive, e tenerne qui una seconda copia
 *    significherebbe avere due sorgenti che prima o poi divergono;
 *  - non c'è modo di creare, modificare o archiviare una squadra. "Gestisci
 *    squadre" apre il flusso che esiste già, lo stesso della riga dell'hub.
 *
 * Cambiare struttura non cancella niente: se la nuova configurazione
 * contraddice le squadre attive il salvataggio si ferma con un richiamo alla
 * gestione Squadre, e nessun team viene archiviato di nascosto.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  CLUB_STRUCTURE_OPTIONS,
  clubStructureHasYouth,
  type ClubStructure,
} from "../../../onboarding/club/club-structure";
import { CLUB_FIRST_TEAM_CATEGORY_OPTIONS } from "../../../onboarding/club/club-taxonomy";
import {
  InfoMessage,
  OnboardingSelectField,
  SelectionRow,
} from "../../../onboarding/ui";
import { trackProfileEvent } from "../../../profiles/profile-analytics";
import { ProfileEditScaffold } from "../../../profiles/edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { ensureOption } from "../../../profiles/profile-form-utils";
import { formatSocietyCount } from "../society-hub-summaries";
import {
  describeStructureConflict,
  detectStructureConflict,
  shouldAskFirstTeamCategory,
  shouldInviteToCreateYouthTeams,
  validateSportProfile,
} from "../society-edit-rules";
import { useSocietySectionEditor } from "./use-society-section-editor";

type SportForm = {
  category: string;
  structure: ClubStructure;
};

export function SocietySportProfileScreen() {
  const editor = useSocietySectionEditor("sport");
  const club = editor.club;
  const teams = editor.editor?.teams ?? null;

  const initialForm = useMemo<SportForm | null>(() => {
    if (!club) {
      return null;
    }

    return {
      /*
        La categoria mostrata è quella della prima squadra canonica quando
        esiste: il campo sul club è il ripiego, non il contrario.
      */
      category:
        editor.editor?.teams.firstTeam?.category ?? club.category ?? "",
      structure: club.clubStructure,
    };
  }, [club, editor.editor]);

  const [draft, setDraft] = useState<SportForm | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: editor.saving,
    onLeave: () => {
      editor.trackUnsavedExit(isDirty);
      router.back();
    },
  });

  const openTeams = useCallback(() => {
    trackProfileEvent("society_profile_manage_teams_tapped", {
      profileType: "society",
      viewerMode: "owner",
    });
    router.push("/(tabs)/dashboard/teams");
  }, []);

  const handleManageTeams = useUnsavedChangesGuard({
    isDirty,
    isSaving: editor.saving,
    onLeave: openTeams,
  });

  const patch = useCallback(
    (changes: Partial<SportForm>) => {
      editor.clearError();
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [editor, initialForm],
  );

  const categoryOptions = useMemo(
    () =>
      ensureOption(
        CLUB_FIRST_TEAM_CATEGORY_OPTIONS,
        form?.category ?? "",
      ) as typeof CLUB_FIRST_TEAM_CATEGORY_OPTIONS,
    [form?.category],
  );

  const conflict = form
    ? detectStructureConflict(form.structure, {
        hasFirstTeam: teams?.hasFirstTeam ?? false,
        hasYouthTeams: teams?.hasYouthTeams ?? false,
      })
    : null;
  const conflictMessage = describeStructureConflict(conflict);

  const askCategory = form ? shouldAskFirstTeamCategory(form.structure) : false;

  function handleSave() {
    if (!form) {
      return;
    }

    if (conflictMessage) {
      trackProfileEvent("society_profile_structure_blocked", {
        profileType: "society",
        section: "sport",
        success: false,
      });
      editor.setErrorMessage(conflictMessage);
      return;
    }

    const error = validateSportProfile(form.structure, form.category);

    if (error) {
      editor.setErrorMessage(error);
      return;
    }

    editor.save(
      {
        category: askCategory ? form.category : "",
        club_structure: form.structure,
      },
      () => setDraft(null),
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={editor.errorMessage}
      notice={
        conflictMessage ??
        (form && shouldInviteToCreateYouthTeams(form.structure, {
          hasYouthTeams: teams?.hasYouthTeams ?? false,
        })
          ? "Il settore giovanile non ha ancora squadre attive. Puoi aggiungerle da Gestisci squadre."
          : null)
      }
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      onSecondary={editor.hasConflict ? editor.reload : undefined}
      saveDisabled={!isDirty || Boolean(conflictMessage)}
      saving={editor.saving}
      secondaryLabel={editor.hasConflict ? "Ricarica" : undefined}
      testID="society-profile-edit-sport"
      title="Profilo sportivo"
    >
      {editor.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="society-edit-skeleton" />
      ) : null}

      {editor.isError ? (
        <ProfileEditErrorState
          onRetry={editor.reload}
          testID="society-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <View style={styles.block}>
            <AppText variant="titleSm">Come è strutturato il club?</AppText>
            <View style={styles.options}>
              {CLUB_STRUCTURE_OPTIONS.map((option) => (
                <SelectionRow
                  control="radio"
                  description={option.description}
                  key={option.value}
                  label={option.label}
                  leading={
                    <Ionicons
                      color={
                        form.structure === option.value
                          ? colors.accent
                          : colors.textSecondary
                      }
                      name={
                        option.value === "youth_only"
                          ? "people-outline"
                          : "shield-outline"
                      }
                      size={20}
                    />
                  }
                  onPress={() => {
                    trackProfileEvent("society_profile_structure_changed", {
                      profileType: "society",
                      section: "sport",
                    });
                    patch({ structure: option.value });
                  }}
                  selected={form.structure === option.value}
                  testID={`society-structure-${option.value}`}
                />
              ))}
            </View>
          </View>

          {/*
            "Solo settore giovanile" non ha una prima squadra: il campo
            scompare invece di restare abilitato con un valore che il
            salvataggio azzererebbe comunque.
          */}
          {askCategory ? (
            <OnboardingSelectField
              label="Categoria prima squadra"
              onChange={(value) => {
                trackProfileEvent("society_profile_category_changed", {
                  profileType: "society",
                  section: "sport",
                });
                patch({ category: value });
              }}
              options={categoryOptions}
              placeholder="Seleziona categoria"
              searchable
              sheetTitle="Categoria prima squadra"
              testID="society-first-team-category"
              value={form.category}
            />
          ) : null}

          <Pressable
            accessibilityHint={
              editor.canOpenClubAdmin
                ? "Apre la gestione delle squadre del club"
                : "La gestione delle squadre si apre dall'area gestionale del club"
            }
            accessibilityRole="button"
            disabled={!editor.canOpenClubAdmin}
            onPress={handleManageTeams}
            style={({ pressed }) => [
              styles.teamsCard,
              pressed ? styles.pressed : null,
            ]}
            testID="society-manage-teams"
          >
            <View style={styles.teamsIcon}>
              <Ionicons
                color={colors.textSecondary}
                name="people-outline"
                size={20}
              />
            </View>
            <View style={styles.teamsText}>
              <AppText variant="titleSm">Squadre del club</AppText>
              <AppText color="secondary" variant="bodySm">
                {formatSocietyCount(
                  editor.editor?.counts.teams,
                  "squadra attiva",
                  "squadre attive",
                )}
              </AppText>
              {/*
                Lo stack /club-admin è gated sul ruolo `club_admin`: a un
                amministratore delegato la CTA non si mostra, invece di
                rimbalzarlo alla root dell'app.
              */}
              {editor.canOpenClubAdmin ? (
                <View style={styles.teamsAction}>
                  <AppText color="accent" variant="actionLabel">
                    Gestisci squadre
                  </AppText>
                  <Ionicons
                    color={colors.accent}
                    name="chevron-forward"
                    size={14}
                  />
                </View>
              ) : null}
            </View>
          </Pressable>

          {clubStructureHasYouth(form.structure) ? (
            <InfoMessage message="Le categorie giovanili derivano dalle squadre attive." />
          ) : null}
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[12],
  },
  options: {
    gap: spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
  teamsAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  teamsCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 72,
    padding: spacing[16],
  },
  teamsIcon: {
    alignItems: "center",
    width: 28,
  },
  teamsText: {
    flex: 1,
    gap: spacing[4],
  },
});
