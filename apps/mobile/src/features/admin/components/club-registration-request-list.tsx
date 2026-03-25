import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState as SharedEmptyState } from "../../../ui";
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
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AppText variant="bodyLg" color="secondary" align="center">
          {error}
        </AppText>
        <Button label="Riprova" onPress={onRefresh} size="sm" variant="secondary" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
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

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: spacing[16],
    paddingHorizontal: spacing[20],
  },
  listContent: {
    padding: spacing[20],
  },
});
