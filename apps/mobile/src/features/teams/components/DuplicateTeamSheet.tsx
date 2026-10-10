import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar, BottomSheet, Button } from "../../../ui";
import type { DuplicateCandidate } from "../teams-service";

type Props = {
  candidates: DuplicateCandidate[];
  /** Presente solo per un avviso che il backend dichiara superabile (§20). */
  onCreateAnyway?: (() => void) | null;
  onClose: () => void;
  onOpenExisting: (teamId: string) => void;
  visible: boolean;
};

/**
 * Avviso "Possibile duplicato" (master 06, §19, §20).
 *
 * «Crea comunque compare soltanto per un avviso che il backend dichiara
 * superabile. Non deve essere un bypass client dei vincoli»: per questo
 * l'azione è un prop opzionale e non un bottone che il componente decide da
 * sé di mostrare. Con un conflitto bloccante il chiamante passa `null` e
 * restano chiusura e apertura della risorsa.
 *
 * Chiudere lo sheet torna al form senza creare nulla: non c'è nessun effetto
 * collaterale in `onClose`.
 */
export function DuplicateTeamSheet({
  candidates,
  onClose,
  onCreateAnyway,
  onOpenExisting,
  visible,
}: Props) {
  return (
    <BottomSheet onClose={onClose} title="Possibile duplicato" visible={visible}>
      <View style={styles.body}>
        <AppText color="secondary" variant="bodySm">
          Esiste già una squadra con dati simili.
        </AppText>

        {candidates.map((candidate) => (
          <Pressable
            accessibilityHint="Apre la squadra esistente"
            accessibilityLabel={[
              candidate.name,
              candidate.typeLabel,
              candidate.levelLabel,
            ]
              .filter(Boolean)
              .join(", ")}
            accessibilityRole="button"
            key={candidate.id}
            onPress={() => onOpenExisting(candidate.id)}
            style={({ pressed }) => [
              styles.candidate,
              pressed ? styles.pressed : null,
            ]}
            testID={`duplicate-candidate-${candidate.id}`}
          >
            <Avatar
              name={candidate.name}
              size="md"
              square
              tone="ink"
              uri={candidate.crestUrl ?? undefined}
            />

            <View style={styles.candidateBody}>
              <AppText numberOfLines={1} variant="titleMd">
                {candidate.name}
              </AppText>

              {candidate.typeLabel || candidate.levelLabel ? (
                <AppText color="secondary" numberOfLines={1} variant="meta">
                  {[candidate.typeLabel, candidate.levelLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        ))}

        {candidates.length > 0 ? (
          <Button
            fullWidth
            label="Apri squadra esistente"
            onPress={() => onOpenExisting(candidates[0].id)}
            testID="duplicate-open-existing"
          />
        ) : null}

        {onCreateAnyway ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onCreateAnyway}
            style={styles.secondary}
            testID="duplicate-create-anyway"
          >
            <AppText color="accent" variant="actionLabel">
              Crea comunque
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[12],
  },
  candidate: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  candidateBody: {
    flex: 1,
    gap: spacing[4],
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.7,
  },
});
