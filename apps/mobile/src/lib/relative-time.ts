export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Ora";
  if (diffMins < 60) return `${diffMins} min fa`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} h fa`;
  if (diffHours < 48) return "Ieri";

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} giorni fa`;

  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
