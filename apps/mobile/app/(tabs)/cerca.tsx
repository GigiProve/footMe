import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { useUnreadNotificationsCount } from "../../src/features/notifications/use-unread-notifications-count";
import { SearchHomeScreen } from "../../src/features/search/components/SearchHomeScreen";
import { spacing } from "../../src/theme/tokens";
import { HeaderBell, ScreenHeader } from "../../src/ui";

export default function CercaScreen() {
  const router = useRouter();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <Screen>
      <View style={styles.headerBlock}>
        <ScreenHeader
          title="Cerca"
          action={
            <HeaderBell
              count={unreadCount}
              onPress={() => router.push("/notifications")}
            />
          }
        />
      </View>

      <SearchHomeScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: spacing[16],
  },
});
