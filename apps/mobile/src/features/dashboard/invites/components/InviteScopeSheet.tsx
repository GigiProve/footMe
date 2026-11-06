import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Checkbox } from "../../../../ui";
import {
  INVITES_COPY,
  isTeamSelected,
  toggleFilterTeam,
} from "../invites-presentation";
import type { InviteFilterTeam, InvitesFilter } from "../invites-types";

type Props = {
  error: boolean;
  loading: boolean;
  onApply: (filter: InvitesFilter) => void;
  onClose: () => void;
  onRetry: () => void;
  selected: InvitesFilter;
  teams: readonly InviteFilterTeam[];
  visible: boolean;
};

/**
 * Filtro multiselezione per squadra (§14, screen 03).
 *
 * Tre comportamenti che §14 chiede esplicitamente e che qui sono
 * strutturali, non difensivi:
 *
 *  · **checkbox, non radio** — e la selezione di una casella non chiude lo
 *    sheet: «La selezione di un checkbox non chiude lo sheet»;
 *  · lo stato è **temporaneo** finché non si preme Applica. «Chiudere con X,
 *    swipe o back senza Applica conserva il filtro precedentemente
 *    applicato», ed è il motivo per cui `draft` viene risincronizzato
 *    all'apertura invece di vivere nel genitore;
 *  · la deselezione totale **ricade sulla scelta generale** mentre si
 *    guarda, non al momento di Applica: `toggleFilterTeam` normalizza, e la
 *    casella «Tutti gli ambiti» si accende da sola.
 */
export function InviteScopeSheet({
  error,
  loading,
  onApply,
  onClose,
  onRetry,
  selected,
  teams,
  visible,
}: Props) {
  const [draft, setDraft] = useState<InvitesFilter>(selected);

  /* All'apertura lo sheet riparte dal filtro **applicato**: una chiusura
     senza conferma non deve lasciare dietro una selezione mai confermata. */
  useEffect(() => {
    if (visible) {
      setDraft(selected);
    }
  }, [selected, visible]);

  return (
    <BottomSheet onClose={onClose} title={INVITES_COPY.filterTitle} visible={visible}>
      <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
        {INVITES_COPY.filterHelper}
      </AppText>

      {error ? (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            Non è stato possibile caricare le squadre.
          </AppText>
          <Button
            label="Riprova"
            onPress={onRetry}
            size="sm"
            testID="invites-filter-retry"
            variant="neutralOutline"
          />
        </View>
      ) : loading ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          Caricamento…
        </AppText>
      ) : (
        <ScrollView style={styles.list}>
          <Checkbox
            checked={draft.kind === "all"}
            label={INVITES_COPY.allScopes}
            onValueChange={() => setDraft(toggleFilterTeam(draft, null))}
            testID="invites-filter-all"
          />

          {teams.map((team) => (
            <Checkbox
              checked={isTeamSelected(draft, team.teamId)}
              /* §14: un Team non più operativo resta consultabile, ma
                 distinto da un metadato discreto. */
              description={team.isInactive ? "Non attiva" : undefined}
              key={team.teamId}
              label={team.label}
              onValueChange={() => setDraft(toggleFilterTeam(draft, team.teamId))}
              testID={`invites-filter-${team.teamId}`}
            />
          ))}
        </ScrollView>
      )}

      <Button
        fullWidth
        label={INVITES_COPY.apply}
        onPress={() => onApply(draft)}
        size="md"
        style={styles.apply}
        testID="invites-filter-apply"
        variant="primary"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  helper: {
    paddingBottom: spacing[12],
  },
  list: {
    maxHeight: 320,
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
  apply: {
    marginTop: spacing[16],
  },
});
