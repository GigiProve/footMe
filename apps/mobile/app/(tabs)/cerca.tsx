import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import { getUnreadCount } from "../../src/features/clubs/notification-service";
import { SearchHomeScreen } from "../../src/features/search/components/SearchHomeScreen";
import { spacing } from "../../src/theme/tokens";
import { HeaderBell, ScreenHeader } from "../../src/ui";

export default function CercaScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", profileId],
    queryFn: () => getUnreadCount(profileId),
    enabled: !!profileId,
  });

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
