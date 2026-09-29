/**
 * Carriera e statistiche (§L).
 *
 * Questa schermata non ricostruisce nulla: monta il flusso condiviso di
 * REV-ONB-02 (scelta del tipo, editor, validazione, split per categoria) e si
 * limita a persisterlo.
 *
 * A differenza del vecchio modal, ogni operazione viene salvata subito. Così
 * la lista non ha bisogno di una seconda CTA "Salva" accanto a quella
 * dell'editor, e lo stato mostrato coincide sempre con quello sul server: in
 * caso di errore non resta una carriera modificata solo a schermo.
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button, ConfirmModal } from "../../../../ui";
import { PlayerCareerExperienceCard } from "../../../onboarding/career/PlayerCareerExperienceCard";
import { PlayerExperienceForm as PlayerExperienceFormComponent } from "../../../onboarding/career/PlayerExperienceForm";
import { PlayerExperienceTypeSelector } from "../../../onboarding/career/PlayerExperienceTypeSelector";
import type { PlayerCareerEntry } from "../../../onboarding/career/player-career-types";
import {
  formsToPlayerEntries,
  generatePlayerEntryId,
  playerEntriesToForms,
  splitPlayerEntryBySeasonDetails,
} from "../../../onboarding/career/player-career-utils";
import { trackProfileEvent } from "../../profile-analytics";
import { sortPlayerExperiencesBySeason } from "../../player-sports";
import { buildInitialState } from "../../profile-edit-helpers";
import { searchTeams } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type FlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; editIndex: number | null; entry: PlayerCareerEntry };

const TYPE_BADGE_LABELS: Record<PlayerCareerEntry["type"], string> = {
  CUSTOM_PERIOD: "PERIODO PERSONALIZZATO",
  MULTI_SEASON: "PIÙ STAGIONI",
  SINGLE_SEASON: "SINGOLA STAGIONE",
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function CareerSectionScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /*
    La lista deriva dal dato appena letto, non da una copia locale: un
    salvataggio fallito non può lasciare a schermo una carriera che sul server
    non esiste.
  */
  const groupedEntries = useMemo(() => {
    if (!data) {
      return [];
    }

    return formsToPlayerEntries(
      sortPlayerExperiencesBySeason(buildInitialState(data).careerEntries),
    );
  }, [data]);

  const handleBack = useUnsavedChangesGuard({
    isDirty: false,
    isSaving: save.isPending,
    onLeave: () => router.back(),
  });

  const persist = useCallback(
    (nextEntries: PlayerCareerEntry[], onDone?: () => void) => {
      if (!data) {
        return;
      }

      setErrorMessage(null);
      save.mutate(
        {
          data,
          patch: {
            careerEntries: sortPlayerExperiencesBySeason(
              playerEntriesToForms(nextEntries),
            ),
          },
        },
        {
          onError: (error) => {
            trackProfileEvent("profile_edit_section_save_failed", {
              profileType: "player",
              section: "career",
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
              profileType: "player",
              section: "career",
              success: true,
            });
            onDone?.();
          },
        },
      );
    },
    [data, save],
  );

  function handleFormSave(saved: PlayerCareerEntry) {
    const splitEntries = splitPlayerEntryBySeasonDetails(saved);
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const nextEntries =
      editIndex === null
        ? [...groupedEntries, ...splitEntries]
        : [
            ...groupedEntries.slice(0, editIndex),
            ...splitEntries,
            ...groupedEntries.slice(editIndex + 1),
          ];

    persist(nextEntries, () => setScreen({ type: "list" }));
  }

  function handleDelete() {
    if (pendingDeleteIndex === null) {
      return;
    }

    persist(
      groupedEntries.filter((_, index) => index !== pendingDeleteIndex),
      () => setPendingDeleteIndex(null),
    );
  }

  const title =
    screen.type === "form"
      ? screen.editIndex === null
        ? "Aggiungi esperienza"
        : "Modifica esperienza"
      : screen.type === "select-type"
        ? "Aggiungi esperienza"
        : "Carriera e statistiche";

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={
        screen.type === "list" ? handleBack : () => setScreen({ type: "list" })
      }
      testID="profile-edit-career"
      title={title}
    >
      {profileQuery.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {profileQuery.isError ? (
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare questa sezione.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => profileQuery.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : null}

      {data && screen.type === "select-type" ? (
        <PlayerExperienceTypeSelector
          onSelect={(type) =>
            setScreen({
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
            })
          }
          subtitle="Scegli come vuoi inserire questa esperienza."
          title="Aggiungi esperienza"
        />
      ) : null}

      {data && screen.type === "form" ? (
        <>
          <View style={styles.typeBadge}>
            <AppText color="secondary" variant="caption">
              {TYPE_BADGE_LABELS[screen.entry.type]}
            </AppText>
          </View>
          {/* L'editor porta la propria CTA: qui non ne serve una seconda. */}
          <PlayerExperienceFormComponent
            entry={screen.entry}
            existingEntries={groupedEntries}
            isEditing={screen.editIndex !== null}
            onCancel={() => setScreen({ type: "list" })}
            onSave={handleFormSave}
            searchTeams={searchTeams}
          />
        </>
      ) : null}

      {data && screen.type === "list" ? (
        <>
          {groupedEntries.length === 0 ? (
            <View style={styles.empty} testID="career-empty">
              <AppText variant="titleSm">Nessuna esperienza</AppText>
              <AppText color="secondary" variant="bodySm">
                Aggiungi le tue esperienze calcistiche: più stagioni complete,
                una singola stagione o un periodo personalizzato.
              </AppText>
            </View>
          ) : null}

          {groupedEntries.map((entry, index) => (
            <PlayerCareerExperienceCard
              entry={entry}
              key={entry.id}
              onDelete={() => setPendingDeleteIndex(index)}
              onEdit={() =>
                setScreen({ editIndex: index, entry: { ...entry }, type: "form" })
              }
            />
          ))}

          <Button
            label="Aggiungi esperienza"
            leftIcon={
              <Ionicons color={colors.accent} name="add-outline" size={20} />
            }
            onPress={() => setScreen({ type: "select-type" })}
            testID="career-add"
            variant="secondary"
          />
        </>
      ) : null}

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel="Elimina"
        isBusy={save.isPending}
        message="L'esperienza e le sue statistiche non saranno più visibili nel tuo profilo."
        onCancel={() => setPendingDeleteIndex(null)}
        onConfirm={handleDelete}
        title="Eliminare questa esperienza?"
        visible={pendingDeleteIndex !== null}
      />
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  empty: {
    gap: spacing[8],
    padding: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
  },
});
