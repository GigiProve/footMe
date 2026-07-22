import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Input } from "../../../ui";

type ChatHeaderProps = {
  avatarUrl?: string | null;
  isSearchMode: boolean;
  name: string;
  onBack: () => void;
  onCloseSearch: () => void;
  onOpenActions: () => void;
  onOpenProfile: () => void;
  onSearchQueryChange: (value: string) => void;
  resultsCount: number | null;
  searchQuery: string;
  subtitle?: string;
};

export function ChatHeader({
  avatarUrl,
  isSearchMode,
  name,
  onBack,
  onCloseSearch,
  onOpenActions,
  onOpenProfile,
  onSearchQueryChange,
  resultsCount,
  searchQuery,
  subtitle,
}: ChatHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Torna ai messaggi" accessibilityRole="button" onPress={onBack}>
        <Ionicons color={colors.textPrimary} name="chevron-back" size={22} />
      </Pressable>

      {isSearchMode ? (
        <View style={styles.searchWrap}>
          <Input
            autoFocus
            onChangeText={onSearchQueryChange}
            placeholder="Cerca nella conversazione..."
            value={searchQuery}
          />
          {resultsCount !== null ? (
            <AppText color="muted" variant="caption">
              {resultsCount} risultati
            </AppText>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={onOpenProfile} style={styles.identity}>
          <Avatar name={name} size="sm" uri={avatarUrl} />
          <View style={styles.textBlock}>
            <AppText numberOfLines={1} style={styles.name} variant="titleSm">
              {name}
            </AppText>
            {subtitle ? (
              <AppText color="muted" numberOfLines={1} variant="caption">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      )}

      <View style={styles.actions}>
        {isSearchMode ? (
          <Pressable accessibilityLabel="Chiudi ricerca" accessibilityRole="button" onPress={onCloseSearch}>
            <Ionicons color={colors.textPrimary} name="close" size={22} />
          </Pressable>
        ) : (
          <>
            <Pressable accessibilityLabel="Apri profilo" accessibilityRole="button" onPress={onOpenProfile}>
              <Ionicons color={colors.textPrimary} name="information-circle-outline" size={22} />
            </Pressable>
            <Pressable accessibilityLabel="Azioni chat" accessibilityRole="button" onPress={onOpenActions}>
              <Ionicons color={colors.textPrimary} name="ellipsis-vertical" size={20} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    height: sizes.chatHeaderHeight,
    paddingHorizontal: spacing[16],
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: spacing[10],
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
  },
  searchWrap: {
    flex: 1,
  },
  textBlock: {
    flex: 1,
  },
});
