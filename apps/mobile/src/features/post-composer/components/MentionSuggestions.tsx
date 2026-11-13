/**
 * Autocomplete mention, mostrato sopra la toolbar mentre si digita «@»
 * (HOM-06.1 §110–111, §185).
 *
 * Riga: avatar/logo, nome + check standard, metadati professionali brevi.
 * `ComposerTaggedIdentity` ha già la forma giusta del candidato (stesso
 * profilo/Società che il motore di ricerca condiviso restituisce, §101): non
 * esiste un tipo parallelo. Il tap seleziona e basta; l'inserimento del token e
 * dell'intervallo (§112) è del reducer.
 *
 * Lista breve a scorrimento limitato (`maxHeight`), `keyboardShouldPersistTaps`
 * perché il tap non deve chiudere la tastiera né togliere il focus al testo.
 * Senza candidati e senza caricamento non rende nulla.
 */

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, VerifiedCheck } from "../../../ui";
import type { ComposerTaggedIdentity } from "../composer-types";
import { ComposerAvatar } from "./ComposerAvatar";

type MentionSuggestionsProps = {
  candidates: ComposerTaggedIdentity[];
  loading?: boolean;
  onSelect: (candidate: ComposerTaggedIdentity) => void;
};

function candidateLabel(candidate: ComposerTaggedIdentity): string {
  return [
    candidate.displayName,
    candidate.isVerified ? "profilo verificato" : null,
    candidate.subtitle,
  ]
    .filter(Boolean)
    .join(", ");
}

export function MentionSuggestions({
  candidates,
  loading = false,
  onSelect,
}: MentionSuggestionsProps) {
  if (candidates.length === 0 && !loading) {
    return null;
  }

  return (
    <View style={styles.container} testID="composer-mention-suggestions">
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      >
        {candidates.map((candidate) => (
          <Pressable
            accessibilityLabel={candidateLabel(candidate)}
            accessibilityRole="button"
            key={`${candidate.identityType}:${candidate.identityId}`}
            onPress={() => onSelect(candidate)}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <ComposerAvatar
              name={candidate.displayName}
              size="sm"
              square={candidate.identityType === "club"}
              uri={candidate.avatarUrl}
            />
            <View style={styles.text}>
              <View style={styles.nameRow}>
                <AppText numberOfLines={1} style={styles.name} variant="titleSm">
                  {candidate.displayName}
                </AppText>
                {candidate.isVerified ? <VerifiedCheck size={14} /> : null}
              </View>
              {candidate.subtitle ? (
                <AppText color="secondary" numberOfLines={1} variant="feedMeta">
                  {candidate.subtitle}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        ))}
        {loading && candidates.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.textMuted} size="small" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  list: {
    maxHeight: 240,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
