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

type RelativeBucket =
  | { unit: "now" }
  | { unit: "minutes"; value: number }
  | { unit: "hours"; value: number }
  | { unit: "yesterday" }
  | { unit: "days"; value: number }
  | { unit: "date"; date: Date };

/**
 * Stesse soglie di `formatRelativeTime` (24 ore → ieri a 48 ore → giorni fino a
 * 7), così la variante compatta e quella parlata non possono divergere fra loro.
 * Nessun calcolo su giorni di calendario: i risultati non dipendono dal fuso.
 */
function bucketOf(date: Date, now: Date): RelativeBucket {
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMins < 1) return { unit: "now" };
  if (diffMins < 60) return { unit: "minutes", value: diffMins };

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { unit: "hours", value: diffHours };
  if (diffHours < 48) return { unit: "yesterday" };

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return { unit: "days", value: diffDays };

  return { unit: "date", date };
}

/**
 * HOM-02 §10: tempo relativo per la riga autore del Post, senza il "fa" della
 * variante storica: "5 min", "1 h", "ieri", "2 giorni fa", poi data compatta
 * ("12 lug", con l'anno se non è quello corrente). `formatRelativeTime` resta
 * com'è perché altre schermate ne dipendono. `now` è iniettabile per i test.
 */
export function formatCompactRelativeTime(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) return "";

  const bucket = bucketOf(date, now);

  switch (bucket.unit) {
    case "now":
      return "ora";
    case "minutes":
      return `${bucket.value} min`;
    case "hours":
      return `${bucket.value} h`;
    case "yesterday":
      return "ieri";
    case "days":
      return `${bucket.value} giorni fa`;
    case "date":
      return date.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
        ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
      });
  }
}

/**
 * HOM-02 §75: la stessa informazione per lo screen reader ("2 ore fa", non
 * "2 h"): "pubblicato 2 ore fa".
 */
export function formatSpokenRelativeTime(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) return "";

  const bucket = bucketOf(date, now);

  switch (bucket.unit) {
    case "now":
      return "adesso";
    case "minutes":
      return bucket.value === 1 ? "1 minuto fa" : `${bucket.value} minuti fa`;
    case "hours":
      return bucket.value === 1 ? "1 ora fa" : `${bucket.value} ore fa`;
    case "yesterday":
      return "ieri";
    case "days":
      return `${bucket.value} giorni fa`;
    case "date":
      return `il ${date.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
      })}`;
  }
}
