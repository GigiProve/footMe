import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { colors, spacing, typography } from "../../../theme/tokens";
import { Button } from "../../../ui";
import type { AdminClubEntry } from "../admin-service";
import { ClubRegistrationRequestCard } from "./club-registration-request-card";
import { EmptyState } from "./empty-state";

type Props = {
  clubs: AdminClubEntry[];
  error: string | null;
  isLoading: boolean;
  onItemPress: (clubId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export function ClubRegistrationRequestList({
  clubs,
  error,
  isLoading,
  onItemPress,
  onRefresh,
  refreshing,
}: Props) {
  if (isLoading) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center", gap: spacing[16], paddingHorizontal: spacing[20] }}>
        <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize[16], textAlign: "center" }}>
          {error}
        </Text>
        <Button label="Riprova" onPress={onRefresh} size="sm" variant="secondary" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: spacing[20] }}
      data={clubs}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyState message="Nessuna richiesta di iscrizione in attesa." />}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <ClubRegistrationRequestCard club={item} onPress={onItemPress} />
      )}
    />
  );
}
