/**
 * Selettore squadre per l'ambito di un accesso amministrativo (screen 08).
 * Non scrive mai direttamente lo stato del genitore: solo `onConfirm` lo fa.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, Avatar, BottomSheet, Button } from "../../../../../ui";
import { DashboardSkeleton } from "../../../components/DashboardStates";
import { useSession } from "../../../../auth/use-session";
import { STALE_MS } from "../../../cache/freshness-policy";
import { ROLES_LOAD_ERROR } from "../../../roles/roles-presentation";
import { ACCESS_QK } from "../access-keys";
import { fetchScopeTeams } from "../access-service";
import { ACCESS_COPY, teamSelectionLabel } from "../access-presentation";

type TeamPickerSheetProps = {
  clubId: string;
  onClose: () => void;
  onConfirm: (teamIds: string[], teamNames: string[]) => void;
  selectedTeamIds: readonly string[];
  visible: boolean;
};

export function TeamPickerSheet(props: TeamPickerSheetProps) {
  const { clubId, onClose, onConfirm, selectedTeamIds, visible } = props;
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  /* §16: «L'apertura preseleziona gli ID già confermati nel draft» e
     «chiudere senza confermare ripristina l'ultima selezione confermata».
     Il parent monta con `key` sull'apertura: lo stato temporaneo nasce
     dalla selezione confermata e muore con la sheet. */
  const [tempSelected, setTempSelected] = useState<string[]>(() => [
    ...selectedTeamIds,
  ]);

  const teamsQuery = useQuery({
    enabled: visible && !!clubId && !!actorId,
    queryFn: () => fetchScopeTeams(clubId),
    queryKey: ACCESS_QK.scopeTeams(actorId, clubId),
    staleTime: STALE_MS.management,
  });

  const toggleTeam = (teamId: string) => {
    setTempSelected((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
  };

  const handleConfirm = () => {
    const teams = teamsQuery.data ?? [];
    const names = teams
      .filter((team) => tempSelected.includes(team.teamId))
      .map((team) => team.name);
    onConfirm(tempSelected, names);
  };

  const teams = teamsQuery.data ?? [];

  return (
    <BottomSheet onClose={onClose} title={ACCESS_COPY.teamPickerTitle} visible={visible}>
      {teamsQuery.isError ? (
        <View style={styles.stateBlock}>
          <AppText color="neutralMuted" variant="bodySm">
            {ROLES_LOAD_ERROR.teams}
          </AppText>
          <Button label="Riprova" onPress={() => teamsQuery.refetch()} variant="ghost" />
        </View>
      ) : teamsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : teams.length === 0 ? (
        <AppText color="neutralMuted" variant="bodySm">
          {ACCESS_COPY.teamPickerEmpty}
        </AppText>
      ) : (
        <>
          <ScrollView style={styles.list}>
            {teams.map((team, index) => (
              /* §16: «l'intera row è selezionabile». La riga **è** la
                 checkbox: annidarne una produrrebbe due controlli per la
                 stessa scelta e due annunci al lettore di schermo. */
              <Pressable
                accessibilityLabel={team.name}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: tempSelected.includes(team.teamId),
                }}
                key={team.teamId}
                onPress={() => toggleTeam(team.teamId)}
                style={[styles.row, index > 0 ? styles.rowDivider : null]}
                testID={`team-option-${team.teamId}`}
              >
                <Ionicons
                  color={
                    tempSelected.includes(team.teamId)
                      ? colors.accent
                      : colors.textNeutralSoft
                  }
                  name={
                    tempSelected.includes(team.teamId)
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={20}
                />

                {/* §16: «Se il Team eredita lo stemma della Society, usa
                    quell'asset. Nessuno scudo inventato.» */}
                <Avatar
                  name={team.name}
                  size="sm"
                  square
                  uri={team.logoUrl ?? undefined}
                />

                <AppText
                  color="neutral"
                  numberOfLines={2}
                  style={styles.teamName}
                  variant="bodyLg"
                >
                  {team.name}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <AppText color="neutralMuted" variant="meta">
              {teamSelectionLabel(tempSelected.length)}
            </AppText>
            <Button
              fullWidth
              label={ACCESS_COPY.teamPickerCta}
              onPress={handleConfirm}
              size="lg"
              testID="team-picker-confirm"
              variant="primary"
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  teamName: {
    flex: 1,
  },
  footer: {
    gap: spacing[8],
    paddingTop: spacing[12],
  },
  list: {
    maxHeight: 360,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  rowDivider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stateBlock: {
    alignItems: "flex-start",
    gap: spacing[8],
  },
});
