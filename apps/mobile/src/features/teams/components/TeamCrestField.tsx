import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import type { TeamInheritanceMode } from "../teams-service";

type Props = {
  clubLogoUrl: string | null;
  isUploading: boolean;
  mode: TeamInheritanceMode;
  onReset: () => void;
  onUpload: () => void;
  url: string | null;
};

/**
 * Stemma della squadra (master 02, 05 — §17).
 *
 * Due sole azioni, e quale sia dipende dalla **modalità**, non
 * dall'uguaglianza fra due immagini: "Usa uno stemma diverso" quando si
 * eredita, "Usa lo stemma della società" quando c'è un override. L'immagine
 * mostrata in modalità ereditata è quella reale della parent, non una copia
 * salvata sul Team.
 *
 * Lo stemma non è obbligatorio: senza alcuna immagine resta il fallback
 * neutro delle iniziali, che §17 preferisce a uno stemma inventato.
 */
export function TeamCrestField({
  clubLogoUrl,
  isUploading,
  mode,
  onReset,
  onUpload,
  url,
}: Props) {
  const shown = mode === "inherited" ? clubLogoUrl : url;

  return (
    <View style={styles.block}>
      <AppText color="secondary" variant="meta">
        Stemma
      </AppText>

      <View style={styles.row}>
        <Avatar name="Squadra" size="md" square tone="ink" uri={shown ?? undefined} />

        <View style={styles.body}>
          <AppText variant="bodySm">
            {mode === "inherited" ? "Stemma della società" : "Stemma personalizzato"}
          </AppText>

          {isUploading ? (
            <View style={styles.uploading}>
              <ActivityIndicator color={colors.accent} size="small" />
              <AppText color="muted" variant="caption">
                Caricamento…
              </AppText>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={mode === "inherited" ? onUpload : onReset}
              style={styles.action}
              testID="team-crest-action"
            >
              <AppText color="accent" variant="actionLabel">
                {mode === "inherited"
                  ? "Usa uno stemma diverso"
                  : "Usa lo stemma della società"}
              </AppText>
            </Pressable>
          )}

          {mode === "custom" && !isUploading ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onUpload}
              style={styles.action}
              testID="team-crest-replace"
            >
              <AppText color="accent" variant="actionLabel">
                Sostituisci immagine
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[6],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  action: {
    justifyContent: "center",
    minHeight: sizes.touchTarget - spacing[14],
  },
  uploading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget - spacing[14],
  },
});
