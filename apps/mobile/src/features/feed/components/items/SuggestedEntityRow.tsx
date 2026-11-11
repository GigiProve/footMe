/**
 * Riga compatta di un'entità suggerita (HOM-01.1 §20).
 *
 * Avatar, nome, ruolo/metadata essenziale e CTA Segui. Nessuna card
 * individuale. La CTA è `FollowAction`, compatta: il nome si accorcia prima di
 * lei ma non sparisce, perché il testo ha `flex: 1` e la CTA no (§95).
 *
 * Profili, Società e Media usano la stessa riga (§18, §61): cambiano solo
 * avatar (quadrato per le Società) e metadata, nessun colore per tipo.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import { FollowAction } from "./FollowAction";

type SuggestedEntityRowProps = {
  name: string;
  metaLine: string;
  avatarUrl: string | null;
  isClub?: boolean;
  isVerified?: boolean;
  isFollowing: boolean;
  isBusy?: boolean;
  onPress: () => void;
  onToggleFollow: () => void;
  showDivider?: boolean;
};

export function SuggestedEntityRow({
  name,
  metaLine,
  avatarUrl,
  isClub = false,
  isVerified = false,
  isFollowing,
  isBusy = false,
  onPress,
  onToggleFollow,
  showDivider = false,
}: SuggestedEntityRowProps) {
  return (
    <View style={[styles.row, showDivider ? styles.divided : null]}>
      <Pressable
        accessibilityLabel={metaLine ? `${name}, ${metaLine}` : name}
        accessibilityRole="button"
        onPress={onPress}
        style={styles.identity}
      >
        <Avatar name={name} size="sm" square={isClub} uri={avatarUrl ?? undefined} />

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText numberOfLines={1} style={styles.name} variant="titleSm">
              {name}
            </AppText>
            {isVerified ? (
              <Ionicons
                accessibilityLabel="Verificato"
                color={colors.accent}
                name="checkmark-circle"
                size={14}
              />
            ) : null}
          </View>
          {metaLine ? (
            <AppText color="muted" numberOfLines={1} variant="feedMeta">
              {metaLine}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      <FollowAction
        isBusy={isBusy}
        isFollowing={isFollowing}
        name={name}
        onPress={onToggleFollow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  divided: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
  identity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingVertical: spacing[8],
  },
});
