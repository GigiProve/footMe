import { useQuery } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { getUnreadCount } from "../clubs/notification-service";

/**
 * Unread notifications count for the current profile. Extracted from the
 * pattern duplicated across `(tabs)/cerca.tsx`, `(tabs)/profile.tsx`, etc.
 * Existing screens are not refactored to use this yet — that's a follow-up.
 */
export function useUnreadNotificationsCount() {
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  const { data } = useQuery({
    enabled: !!profileId,
    queryFn: () => getUnreadCount(profileId),
    queryKey: ["notifications-unread", profileId],
  });

  return data ?? 0;
}
