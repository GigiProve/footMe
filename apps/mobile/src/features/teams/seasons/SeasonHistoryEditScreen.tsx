/**
 * Dettaglio e correzione di una stagione conclusa — screen 04.
 *
 * Una struttura, due modalità (§16): in consultazione mostra stagione, Tipo e
 * Livello reali; con la capability `seasons_history_edit` gli stessi campi
 * diventano selector e compaiono "Salva modifiche" e "Annulla".
 *
 * L'identificativo della stagione resta read-only: §17 vieta di «modificare
 * il suo Season ID o creare un duplicato per simulare una correzione». Lo
 * stato resta Conclusa, e l'helper lo dice: «Le modifiche non riaprono la
 * stagione.»
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { ProfileEditFieldsSkeleton } from "../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../profiles/edit/use-unsaved-changes-guard";
import {
  ClassificationFields,
  type ClassificationValue,
} from "./components/ClassificationFields";
import { SeasonFieldRow } from "./components/SeasonFieldRow";
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsScaffold } from "./components/SeasonsScaffold";
import { SEASONS_QK } from "./seasons-keys";
import {
  SEASON_LIFECYCLE_LABEL,
  classificationLine,
  seasonErrorMessage,
} from "./seasons-presentation";
import {
  fetchTeamSeasonDetail,
  toSeasonError,
  updateTeamSeasonHistory,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";

export function SeasonHistoryEditScreen({
  teamSeasonId,
}: {
  teamSeasonId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { showToast } = useToast();

  const [draft, setDraft] = useState<ClassificationValue | null>(null);
  const [levelNotice, setLevelNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  const detailQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonDetail(teamSeasonId),
    queryKey: SEASONS_QK.seasonDetail(actorId, teamSeasonId),
  });

  const detail = detailQuery.data ?? null;

  const initial = useMemo<ClassificationValue>(
    () => ({
      levelId: detail?.levelId ?? null,
      levelLabel: detail?.levelLabel ?? null,
      typeId: detail?.typeId ?? null,
      typeLabel: detail?.typeLabel ?? null,
    }),
    [detail],
  );

  /*
    Nessun effetto per il prefill: il valore mostrato è `draft ?? initial`, e
    `initial` è memoizzato sul payload. Copiarlo in stato dentro un effetto
    avrebbe aggiunto un render in più e una finestra in cui il form mostra un
    valore e il confronto "dirty" un altro.
  */

  const value = draft ?? initial;
  const isDirty =
    value.typeId !== initial.typeId || value.levelId !== initial.levelId;

  const leave = useCallback(() => router.back(), [router]);

  useUnsavedChangesGuard({ isDirty, isSaving, onLeave: leave });

  useEffect(() => {
    if (detail) {
      trackSeasonsEvent("seasons_history_opened", { can_edit: detail.canEdit });
    }
  }, [detail]);

  const save = useCallback(async () => {
    if (!detail || !value.typeId) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await updateTeamSeasonHistory({
        expectedVersion: detail.version,
        levelId: value.levelId,
        teamSeasonId,
        typeId: value.typeId,
      });

      trackSeasonsEvent("seasons_history_correct_result", { outcome: "success" });

      // §17: si aggiornano il dettaglio e la riga storica, non la
      // classificazione corrente né la visibilità pubblica.
      await queryClient.invalidateQueries({
        queryKey: SEASONS_QK.seasonDetail(actorId, teamSeasonId),
      });
      await queryClient.invalidateQueries({ queryKey: ["seasons-history-page"] });
      await queryClient.invalidateQueries({ queryKey: ["seasons-history-options"] });

      setDraft(null);
      showToast({ message: "Modifiche salvate", tone: "success" });
      router.back();
    } catch (caught) {
      const seasonError = toSeasonError(caught);

      trackSeasonsEvent("seasons_history_correct_result", {
        code: seasonError.code,
        outcome: "error",
      });

      if (seasonError.code === "SEASON_VERSION_CONFLICT") {
        // §17: «Conservare il draft, caricare la versione aggiornata e
        // permettere una nuova revisione/conferma. Non ripetere
        // automaticamente una PATCH in conflitto.»
        trackSeasonsEvent("seasons_context_conflict", { code: seasonError.code });
        await queryClient.invalidateQueries({
          queryKey: SEASONS_QK.seasonDetail(actorId, teamSeasonId),
        });
      }

      setErrorMessage(
        seasonErrorMessage(
          seasonError.code,
          "Non è stato possibile salvare le modifiche. Riprova.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [actorId, detail, queryClient, router, showToast, teamSeasonId, value]);

  if (detailQuery.isLoading || !detail) {
    return (
      <SeasonsScaffold onBack={leave} title="Stagione">
        <ProfileEditFieldsSkeleton />
      </SeasonsScaffold>
    );
  }

  const canEdit = detail.canEdit && detail.phase === "past";

  return (
    <SeasonsScaffold
      errorMessage={errorMessage}
      onBack={leave}
      onPrimary={canEdit ? () => void save() : undefined}
      onSecondary={canEdit ? leave : undefined}
      // §16: «Abilitare Salva solo con una modifica valida.»
      primaryDisabled={!isDirty || !value.typeId || isSaving}
      primaryLabel="Salva modifiche"
      primaryLoading={isSaving}
      secondaryLabel="Annulla"
      testID="season-history-edit-screen"
      title={`Stagione ${detail.seasonLabel}`}
    >
      <SeasonsIdentityHeader
        isVerified={detail.clubIsVerified}
        logoUrl={detail.crestUrl}
        name={detail.teamName}
        statusLabel={
          detail.phase === "past" ? SEASON_LIFECYCLE_LABEL.concluded : null
        }
        subtitle={`Squadra di ${detail.clubName}`}
      />

      <View style={styles.form}>
        <SeasonFieldRow
          label="Stagione"
          readOnly
          testID="season-history-season-field"
          value={detail.seasonLabel}
        />

        {canEdit ? (
          <>
            <ClassificationFields
              clubId={detail.clubId}
              levelNotice={levelNotice}
              onChange={(next) => {
                setLevelNotice(
                  next.typeId !== value.typeId && value.levelId && !next.levelId
                    ? "Il livello precedente non è compatibile con il nuovo tipo ed è stato rimosso."
                    : null,
                );
                setDraft(next);
              }}
              seasonId={detail.seasonId}
              seasonLabel={detail.seasonLabel}
              teamId={detail.teamId}
              value={value}
            />

            <AppText color="neutralMuted" variant="caption">
              Le modifiche non riaprono la stagione.
            </AppText>
          </>
        ) : (
          <>
            <SeasonFieldRow
              label="Tipo squadra"
              readOnly
              value={detail.typeLabel}
            />

            <SeasonFieldRow
              label="Livello / campionato"
              readOnly
              // §16: «Se il Livello non è noto, usare un'indicazione discreta
              // di assenza, senza inventarlo.»
              value={detail.levelLabel ?? "Non indicato"}
            />

            {classificationLine(detail.typeLabel, detail.levelLabel) ? null : (
              <AppText color="neutralMuted" variant="caption">
                La classificazione di questa stagione non è registrata.
              </AppText>
            )}
          </>
        )}
      </View>
    </SeasonsScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing[16],
  },
});
