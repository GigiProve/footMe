/**
 * Sheet del wizard «Crea gruppo» (DAS-REV-32 §12, §15; PNG 06 e 09).
 *
 * - «Crea gruppo per»: Società preliminare da Messaggi. Selezione singola e
 *   «Continua»; non è uno dei tre step (§12).
 * - «Seleziona squadra»: Team reali dal server in ordine server, più «Nessuna
 *   squadra» solo se l'actor può creare a livello societario (§15). Nessun
 *   elenco locale di squadre.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar, BottomSheet, Button, Radio } from "../../../../../ui";
import { GROUPS_COPY } from "../../groups-copy";
import type { TeamChoice } from "../../groups-presentation";
import type { GroupCreateContext, GroupTeamsLookup } from "../../groups-types";

type SocietySheetProps = {
  contexts: readonly GroupCreateContext[];
  onClose: () => void;
  onConfirm: (clubId: string) => void;
};

export function GroupSocietySheet({ contexts, onClose, onConfirm }: SocietySheetProps) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <BottomSheet onClose={onClose} title={GROUPS_COPY.createFor} visible>
      <AppText color="neutralMuted" style={styles.supporting} variant="bodySm">
        {GROUPS_COPY.createForSupporting}
      </AppText>
      <ScrollView accessibilityRole="radiogroup" style={styles.list}>
        {contexts.map((context) => {
          const checked = chosen === context.clubId;

          return (
            <Pressable
              accessibilityLabel={context.isVerified ? `${context.clubName}, ${GROUPS_COPY.societyVerified}` : context.clubName}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              key={context.clubId}
              onPress={() => setChosen(context.clubId)}
              style={styles.societyRow}
              testID={`group-society-${context.clubId}`}
            >
              <Avatar name={context.clubName} size="md" square tone="ink" uri={context.logoUrl ?? undefined} />
              <View style={styles.societyText}>
                <AppText color="neutral" numberOfLines={2} variant="titleSm">
                  {context.clubName}
                </AppText>
                <AppText color="neutralMuted" variant="meta">
                  {GROUPS_COPY.societyKind}
                </AppText>
              </View>
              {context.isVerified ? <Ionicons color={colors.accent} name="checkmark-circle" size={16} /> : null}
              <View style={[styles.circle, checked ? styles.circleChecked : null]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.confirm}>
        <Button
          disabled={chosen === null}
          fullWidth
          label={GROUPS_COPY.continue}
          onPress={() => {
            if (chosen) onConfirm(chosen);
          }}
          testID="group-society-continue"
        />
      </View>
    </BottomSheet>
  );
}

type TeamSheetProps = {
  error: boolean;
  loading: boolean;
  lookup: GroupTeamsLookup | null;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (choice: string | null) => void;
  value: TeamChoice;
  visible: boolean;
};

export function GroupTeamSheet({ error, loading, lookup, onClose, onRetry, onSelect, value, visible }: TeamSheetProps) {
  return (
    <BottomSheet onClose={onClose} title={GROUPS_COPY.teamChoose} visible={visible}>
      {error ? (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            {GROUPS_COPY.teamsLoadError}
          </AppText>
          <Button label={GROUPS_COPY.retry} onPress={onRetry} variant="neutralOutline" />
        </View>
      ) : loading || !lookup ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          {GROUPS_COPY.loading}
        </AppText>
      ) : (
        <ScrollView accessibilityRole="radiogroup" style={styles.list}>
          {lookup.canCreateWithoutTeam ? (
            <Radio
              checked={value === null}
              label={GROUPS_COPY.teamNone}
              onPress={() => onSelect(null)}
              testID="group-team-none"
              tone="brand"
            />
          ) : null}

          {lookup.teams.map((team) => (
            <Radio
              checked={value === team.teamId}
              key={team.teamId}
              label={team.teamName}
              onPress={() => onSelect(team.teamId)}
              testID={`group-team-${team.teamId}`}
              tone="brand"
            />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    width: 22,
  },
  circleChecked: {
    borderColor: colors.accent,
    borderWidth: 6,
  },
  confirm: {
    paddingTop: spacing[16],
  },
  supporting: {
    paddingBottom: spacing[8],
  },
  list: {
    maxHeight: 360,
  },
  societyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingVertical: spacing[6],
  },
  societyText: {
    flex: 1,
  },
  state: {
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
});
