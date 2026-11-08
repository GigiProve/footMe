import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button, Radio } from "../../../../../ui";
import { EVENTS_COPY } from "../../events-copy";
import type { SelectionEventTeam } from "../../events-types";

type Props = {
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (team: SelectionEventTeam) => void;
  onRetry: () => void;
  selectedId: string | null;
  teams: readonly SelectionEventTeam[];
  visible: boolean;
};

/**
 * «Seleziona squadra» (DAS-REV-28 §9, §14; screen 06).
 *
 * Una sola squadra, radio. §14: «Conferma committa la selezione nel draft,
 * non salva l'evento. X/back annullano la scelta temporanea dello sheet.»
 * Per questo la scelta provvisoria vive qui e riparte dal valore confermato
 * a ogni apertura.
 *
 * §9: nessuna «Intera società», «Tutte le squadre» o selezione multipla, e
 * nessuna creazione inline di una squadra. §37 distingue zero squadre da un
 * caricamento fallito: due stati, nessuna scelta arbitraria.
 */
export function EventTeamSheet({
  error,
  loading,
  onClose,
  onConfirm,
  onRetry,
  selectedId,
  teams,
  visible,
}: Props) {
  const [pending, setPending] = useState<string | null>(selectedId);
  const [openedWith, setOpenedWith] = useState<string | null | undefined>(undefined);

  /* Riparte dal valore confermato a ogni apertura. Aggiustato durante il
     render, non in un effetto: niente render a cascata. */
  if (visible && openedWith !== selectedId) {
    setOpenedWith(selectedId);
    setPending(selectedId);
  } else if (!visible && openedWith !== undefined) {
    setOpenedWith(undefined);
  }

  const chosen = teams.find((team) => team.id === pending) ?? null;

  return (
    <BottomSheet onClose={onClose} title={EVENTS_COPY.teamSheetTitle} visible={visible}>
      {error ? (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            {EVENTS_COPY.teamsError}
          </AppText>
          <Button label={EVENTS_COPY.retry} onPress={onRetry} variant="neutralOutline" />
        </View>
      ) : loading ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          Caricamento…
        </AppText>
      ) : teams.length === 0 ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          {EVENTS_COPY.teamsEmpty}
        </AppText>
      ) : (
        <ScrollView accessibilityRole="radiogroup" style={styles.list}>
          {teams.map((team) => (
            <View key={team.id} style={styles.option}>
              <Radio
                checked={pending === team.id}
                label={team.contextLabel && team.contextLabel !== team.name
                  ? `${team.name} · ${team.contextLabel}`
                  : team.name}
                onPress={() => setPending(team.id)}
                testID={`event-team-${team.id}`}
                tone="brand"
              />
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.confirm}>
        <Button
          disabled={!chosen}
          fullWidth
          label={EVENTS_COPY.confirm}
          onPress={() => {
            if (chosen) {
              onConfirm(chosen);
            }
          }}
          testID="event-team-confirm"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  confirm: {
    paddingTop: spacing[16],
  },
  list: {
    maxHeight: 360,
  },
  option: {
    paddingVertical: spacing[4],
  },
  state: {
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
});
