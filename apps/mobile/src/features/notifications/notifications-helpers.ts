import type { AppNotification } from "../clubs/membership-types";

export type NotificationCategory =
  | "richieste"
  | "candidature"
  | "attivita"
  | "store"
  | "sistema";

export type NotificationCategoryFilter = NotificationCategory | "tutte";

type NotificationFilterChip = {
  label: string;
  value: NotificationCategoryFilter;
};

export const NOTIFICATION_FILTERS: readonly NotificationFilterChip[] = [
  { label: "Tutte", value: "tutte" },
  { label: "Richieste", value: "richieste" },
  { label: "Candidature", value: "candidature" },
  { label: "Attività", value: "attivita" },
  { label: "Store", value: "store" },
  { label: "Sistema", value: "sistema" },
];

/**
 * Best-effort category resolution: prefer the explicit `category` column,
 * fall back to a type-based guess so older rows without the column still
 * land in a sensible bucket.
 */
export function resolveNotificationCategory(
  item: AppNotification,
): NotificationCategory {
  if (item.category) {
    return item.category as NotificationCategory;
  }

  if (item.type === "new_follower") return "attivita";
  if (
    item.type === "agent_representation_request" ||
    item.type === "agent_representation_responded" ||
    item.type === "agent_representation_visibility_proposed" ||
    item.type === "agent_representation_removed"
  ) {
    return "richieste";
  }
  if (item.type === "application_received" || item.type === "application_status") {
    return "candidature";
  }
  if (item.type === "content_tag") return "attivita";
  if (item.type === "store_order") return "store";

  return "sistema";
}

export function filterNotificationsByCategory(
  notifications: AppNotification[],
  filter: NotificationCategoryFilter,
): AppNotification[] {
  if (filter === "tutte") return notifications;
  return notifications.filter(
    (item) => resolveNotificationCategory(item) === filter,
  );
}

export function filterUnread(notifications: AppNotification[]): AppNotification[] {
  return notifications.filter((item) => !item.is_read);
}

export type TimeBucket = "oggi" | "ieri" | "precedenti";

export function timeBucketFor(isoDate: string, now: Date = new Date()): TimeBucket {
  const date = new Date(isoDate);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "oggi";
  if (date >= startOfYesterday) return "ieri";
  return "precedenti";
}

const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  oggi: "Oggi",
  ieri: "Ieri",
  precedenti: "Precedenti",
};

export type NotificationSection = {
  data: AppNotification[];
  title: string;
};

export function groupNotificationsByTime(
  notifications: AppNotification[],
  now: Date = new Date(),
): NotificationSection[] {
  const buckets: Record<TimeBucket, AppNotification[]> = {
    oggi: [],
    ieri: [],
    precedenti: [],
  };

  notifications.forEach((item) => {
    buckets[timeBucketFor(item.created_at, now)].push(item);
  });

  return (["oggi", "ieri", "precedenti"] as TimeBucket[])
    .filter((bucket) => buckets[bucket].length > 0)
    .map((bucket) => ({
      data: buckets[bucket],
      title: TIME_BUCKET_LABELS[bucket],
    }));
}

/**
 * Collapses multiple unread `new_follower` notifications into a single
 * summary row (e.g. "Mario e altri 3"), keeping every other notification
 * unchanged. Pure and order-preserving (uses the most recent item's
 * timestamp/id as the anchor for the collapsed row).
 */
export function groupNotifications(
  notifications: AppNotification[],
): AppNotification[] {
  const followerItems = notifications.filter(
    (item) => item.type === "new_follower" && !item.is_read,
  );

  if (followerItems.length <= 1) {
    return notifications;
  }

  const [mostRecent, ...rest] = followerItems;
  const othersCount = rest.length;
  const firstName =
    mostRecent.data?.follower_name ?? mostRecent.title ?? "Qualcuno";

  const collapsed: AppNotification = {
    ...mostRecent,
    title: `${firstName} e altri ${othersCount}`,
    body: "Hanno iniziato a seguirti.",
  };

  const followerIds = new Set(followerItems.map((item) => item.id));

  const result: AppNotification[] = [];
  let inserted = false;

  notifications.forEach((item) => {
    if (!followerIds.has(item.id)) {
      result.push(item);
      return;
    }
    if (!inserted) {
      result.push(collapsed);
      inserted = true;
    }
  });

  return result;
}

export function ctaLabelFor(item: AppNotification): string {
  const category = resolveNotificationCategory(item);

  if (item.type === "new_follower") return "Vedi profilo";
  if (item.type === "content_tag") return "Apri contenuto";
  if (category === "richieste") return "Gestisci richiesta";
  if (category === "candidature") return "Vedi candidatura";
  if (category === "store") return "Vedi ordine";

  return "Apri";
}

export function iconNameForCategory(
  category: NotificationCategory,
): string {
  if (category === "richieste") return "person-add-outline";
  if (category === "candidature") return "briefcase-outline";
  if (category === "attivita") return "pricetag-outline";
  if (category === "store") return "bag-outline";
  return "shield-checkmark-outline";
}
