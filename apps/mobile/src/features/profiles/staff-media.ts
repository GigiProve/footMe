import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export const STAFF_MEDIA_TAG_OPTIONS = [
  { icon: "barbell-outline", label: "Allenamento", value: "training" },
  { icon: "git-network-outline", label: "Tattica", value: "tactics" },
  { icon: "football-outline", label: "Partita", value: "match" },
  { icon: "people-outline", label: "Highlights squadra", value: "team_highlights" },
  { icon: "analytics-outline", label: "Analisi", value: "analysis" },
  { icon: "mic-outline", label: "Intervista", value: "interview" },
  { icon: "stats-chart-outline", label: "Match Analyst", value: "match_analyst" },
  { icon: "body-outline", label: "Preparazione atletica", value: "athletic_prep" },
  { icon: "medkit-outline", label: "Recupero", value: "recovery" },
] as const satisfies readonly {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}[];

export type StaffMediaTag = (typeof STAFF_MEDIA_TAG_OPTIONS)[number]["value"];

export type StaffMediaItemRecord = {
  created_at: string | null;
  description: string | null;
  id: string;
  is_featured: boolean;
  tag: StaffMediaTag | null;
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

export function getStaffMediaTagMeta(
  tag: StaffMediaTag | null,
): (typeof STAFF_MEDIA_TAG_OPTIONS)[number] | null {
  if (tag === null) return null;
  return STAFF_MEDIA_TAG_OPTIONS.find((option) => option.value === tag) ?? null;
}

export function normalizeStaffMediaTag(value: unknown): StaffMediaTag | null {
  return value === "training" ||
    value === "tactics" ||
    value === "match" ||
    value === "team_highlights" ||
    value === "analysis" ||
    value === "interview" ||
    value === "match_analyst" ||
    value === "athletic_prep" ||
    value === "recovery"
    ? value
    : null;
}

export function inferStaffMediaTypeFromUrl(value: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(value) ? "video" : "image";
}

export function normalizeStaffMediaItems(
  value: unknown,
  fallbackUrls: string[] = [],
): StaffMediaItemRecord[] {
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((entry, index) => normalizeStaffMediaItem(entry, index))
      .filter((entry): entry is StaffMediaItemRecord => entry !== null);
  }

  return fallbackUrls
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((url, index) => {
      const type = inferStaffMediaTypeFromUrl(url);

      return {
        created_at: null,
        description: null,
        id: `legacy-staff-media-${index}`,
        is_featured: false,
        tag: null,
        thumbnail_url: type === "image" ? url : null,
        type,
        url,
      } satisfies StaffMediaItemRecord;
    });
}

function normalizeStaffMediaItem(
  value: unknown,
  index: number,
): StaffMediaItemRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const url = typeof entry.url === "string" ? entry.url.trim() : "";

  if (!url) {
    return null;
  }

  const type =
    entry.type === "video" || entry.type === "image"
      ? entry.type
      : inferStaffMediaTypeFromUrl(url);

  return {
    created_at:
      typeof entry.created_at === "string" && entry.created_at.trim()
        ? entry.created_at
        : null,
    description:
      typeof entry.description === "string" && entry.description.trim()
        ? entry.description.trim()
        : null,
    id:
      typeof entry.id === "string" && entry.id.trim()
        ? entry.id
        : `staff-media-${index}`,
    is_featured: typeof entry.is_featured === "boolean" ? entry.is_featured : false,
    tag: normalizeStaffMediaTag(entry.tag),
    thumbnail_url:
      typeof entry.thumbnail_url === "string" && entry.thumbnail_url.trim()
        ? entry.thumbnail_url.trim()
        : type === "image"
          ? url
          : null,
    type,
    url,
  } satisfies StaffMediaItemRecord;
}
