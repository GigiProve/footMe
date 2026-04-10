import { StyleSheet, View } from "react-native";

import type { AgentManagedPlayerEntryDraft, AgentPlayerCandidate } from "../../profiles/agent-profile";
import { AgentManagedPlayersEditor } from "../../profiles/agent/AgentManagedPlayersEditor";
import { spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

type AgentPlayersStepProps = {
  errorMessage?: string;
  isBusy: boolean;
  managedPlayerEntries: AgentManagedPlayerEntryDraft[];
  onContinue: () => void;
  onUpdate: (entries: AgentManagedPlayerEntryDraft[]) => void;
  searchPlayers: (query: string) => Promise<AgentPlayerCandidate[]>;
};

export function AgentPlayersStep({
  errorMessage,
  isBusy,
  managedPlayerEntries,
  onContinue,
  onUpdate,
  searchPlayers,
}: AgentPlayersStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Portfolio calciatori</AppText>
        <AppText variant="bodySm" color="secondary">
          Collega i giocatori già presenti su FootMe oppure inserisci manualmente le
          voci che rappresentano il tuo portfolio attuale.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <AgentManagedPlayersEditor
          entries={managedPlayerEntries}
          errorMessage={errorMessage}
          onChange={onUpdate}
          searchPlayers={searchPlayers}
        />
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        fullWidth
        label="Continua"
        onPress={onContinue}
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[8],
  },
});
