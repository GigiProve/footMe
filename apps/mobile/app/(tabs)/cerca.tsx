import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import { getUnreadCount } from "../../src/features/clubs/notification-service";
import { ProfileSearchScreen } from "../../src/features/discovery/components/ProfileSearchScreen";
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
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          title="Cerca"
          subtitle="Trova giocatori, allenatori e opportunita'"
          action={
            <HeaderBell
              count={unreadCount}
              onPress={() => router.push("/notifications")}
            />
          }
        />

        <ProfileSearchScreen hideHeader />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
});
