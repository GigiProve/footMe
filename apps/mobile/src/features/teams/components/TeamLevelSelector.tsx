import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { OnboardingTextField } from "../../onboarding/ui";
import { TEAMS_QK } from "../teams-keys";
import { trackTeamsEvent } from "../teams-analytics";
import { teamErrorMessage } from "../teams-presentation";
import {
  fetchTeamLevelOptions,
  reportMissingTeamLevel,
  toTeamError,
  type TaxonomyOption,
} from "../teams-service";
import { TeamSelectorModal } from "./TeamSelectorModal";

const DEBOUNCE_MS = 250;

type Props = {
  clubId: string;
  onClose: () => void;
  onSelect: (option: TaxonomyOption | null) => void;
  seasonId: string | null;
  seasonLabel: string | null;
  teamId: string | null;
  typeId: string | null;
  typeLabel: string | null;
  /** Vedi `TeamSelectorModal`: vincolo cromatico di DAS-REV-10 §4. */
  tone?: "brand" | "neutral";
  value: string | null;
  visible: boolean;
};

/**
 * Selector del Livello/campionato (master 04, §16).
 *
 * La ricerca è remota, quindi ha un debounce e si appoggia a TanStack Query
 * per le risposte obsolete: una risposta appartenente a una query precedente
 * non può sovrascrivere la lista corrente, perché è salvata sotto una chiave
 * diversa e non è più quella osservata.
 *
 * In coda alla lista c'è l'aiuto di §16, che esiste per dire una cosa sola:
 * si può proseguire senza Livello. La segnalazione non è un prerequisito e
 * un suo errore non impedisce di creare la squadra.
 */
export function TeamLevelSelector({
  clubId,
  onClose,
  onSelect,
  seasonId,
  seasonLabel,
  teamId,
  tone = "brand",
  typeId,
  typeLabel,
  value,
  visible,
}: Props) {
  const neutral = tone === "neutral";
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [isReporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [isSending, setSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const levelsQuery = useQuery({
    enabled: visible && !!typeId,
    queryFn: () =>
      fetchTeamLevelOptions(typeId as string, seasonId, debounced || null),
    queryKey: TEAMS_QK.levels(typeId ?? "", seasonId, debounced),
  });

  const submitReport = useCallback(async () => {
    setSending(true);
    setReportError(null);

    try {
      await reportMissingTeamLevel({
        clubId,
        proposedLabel: reportText,
        teamId,
        typeId,
      });

      trackTeamsEvent("teams_level_report_submitted", { outcome: "success" });
      // §16: il feedback di successo segue la conferma backend.
      setReportSent(true);
      setReportText("");
    } catch (error) {
      const teamError = toTeamError(error);
      trackTeamsEvent("teams_level_report_submitted", {
        code: teamError.code,
        outcome: "error",
      });
      // Il testo resta: §16 lo chiede esplicitamente.
      setReportError(
        teamErrorMessage(
          teamError.code,
          "Non è stato possibile inviare la segnalazione. Riprova.",
        ),
      );
    } finally {
      setSending(false);
    }
  }, [clubId, reportText, teamId, typeId]);

  return (
    <TeamSelectorModal
      contextLine={[typeLabel, seasonLabel ? `Stagione ${seasonLabel}` : null]
        .filter(Boolean)
        .join(" · ")}
      errorMessage={
        levelsQuery.isError
          ? "Non è stato possibile caricare i campionati. Riprova."
          : null
      }
      footer={
        <View style={styles.help}>
          <AppText color={neutral ? "neutral" : "primary"} variant="titleSm">
            Non trovi il tuo campionato?
          </AppText>

          <AppText color={neutral ? "neutralMuted" : "secondary"} variant="bodySm">
            Puoi continuare senza specificarlo.
          </AppText>

          {reportSent ? (
            <AppText color="success" variant="bodySm">
              Segnalazione inviata.
            </AppText>
          ) : isReporting ? (
            <View style={styles.reportForm}>
              <OnboardingTextField
                errorMessage={reportError ?? undefined}
                label="Nome del campionato"
                maxLength={80}
                onChangeText={setReportText}
                placeholder="Es. Under 18 Interregionale"
                testID="team-level-report-field"
                value={reportText}
              />

              <Button
                disabled={reportText.trim().length < 2 || isSending}
                label={isSending ? "Invio…" : "Invia segnalazione"}
                onPress={() => void submitReport()}
                size="sm"
                testID="team-level-report-submit"
                variant={neutral ? "neutralOutline" : "secondary"}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setReporting(true)}
              style={styles.action}
              testID="team-level-report-open"
            >
              <AppText color="accent" variant="actionLabel">
                Segnala categoria mancante →
              </AppText>
            </Pressable>
          )}
        </View>
      }
      isLoading={levelsQuery.isLoading}
      items={(levelsQuery.data ?? []).map((option) => ({
        id: option.id,
        isRetired: option.isActive === false,
        label: option.label,
      }))}
      onClear={value ? () => onSelect(null) : undefined}
      onClose={onClose}
      onRetry={() => void levelsQuery.refetch()}
      onSearchChange={setQuery}
      onSelect={(id) => {
        const option = (levelsQuery.data ?? []).find((item) => item.id === id);
        onSelect(option ?? null);
      }}
      searchPlaceholder="Cerca livello o campionato"
      searchValue={query}
      title="Livello / campionato"
      tone={tone}
      value={value}
      visible={visible}
    />
  );
}

const styles = StyleSheet.create({
  help: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[6],
    paddingTop: spacing[16],
  },
  reportForm: {
    gap: spacing[12],
    paddingTop: spacing[6],
  },
  action: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
