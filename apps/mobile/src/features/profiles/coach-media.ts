import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export const COACH_MEDIA_TAG_OPTIONS = [
  { icon: "barbell-outline", label: "Allenamento", value: "training" },
  { icon: "git-network-outline", label: "Tattica", value: "tactics" },
  { icon: "football-outline", label: "Partita", value: "match" },
  { icon: "people-outline", label: "Highlights squadra", value: "team_highlights" },
  { icon: "analytics-outline", label: "Analisi", value: "analysis" },
  { icon: "mic-outline", label: "Intervista", value: "interview" },
] as const satisfies readonly {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}[];

export type CoachMediaTag = (typeof COACH_MEDIA_TAG_OPTIONS)[number]["value"];

export type CoachMediaItemRecord = {
  created_at: string | null;
  description: string | null;
  id: string;
  is_featured: boolean;
  tag: CoachMediaTag;
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

export function getCoachMediaTagMeta(tag: CoachMediaTag) {
  return (
    COACH_MEDIA_TAG_OPTIONS.find((option) => option.value === tag) ??
    COACH_MEDIA_TAG_OPTIONS[0]
  );
}

export function normalizeCoachMediaTag(value: unknown): CoachMediaTag {
  return value === "tactics" ||
    value === "match" ||
    value === "team_highlights" ||
    value === "analysis" ||
    value === "interview"
    ? value
    : "training";
}

export function inferCoachMediaTypeFromUrl(value: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(value) ? "video" : "image";
}

export function normalizeCoachMediaItems(
  value: unknown,
  fallbackUrls: string[] = [],
): CoachMediaItemRecord[] {
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((entry, index) => normalizeCoachMediaItem(entry, index))
      .filter((entry): entry is CoachMediaItemRecord => entry !== null);
  }

  return fallbackUrls
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((url, index) => {
      const type = inferCoachMediaTypeFromUrl(url);

      return {
        created_at: null,
        description: null,
        id: `legacy-coach-media-${index}`,
        is_featured: false,
        tag: "training",
        thumbnail_url: type === "image" ? url : null,
        type,
        url,
      } satisfies CoachMediaItemRecord;
    });
}

function normalizeCoachMediaItem(
  value: unknown,
  index: number,
): CoachMediaItemRecord | null {
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
      : inferCoachMediaTypeFromUrl(url);

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
        : `coach-media-${index}`,
    is_featured: typeof entry.is_featured === "boolean" ? entry.is_featured : false,
    tag: normalizeCoachMediaTag(entry.tag),
    thumbnail_url:
      typeof entry.thumbnail_url === "string" && entry.thumbnail_url.trim()
        ? entry.thumbnail_url.trim()
        : type === "image"
          ? url
          : null,
    type,
    url,
  } satisfies CoachMediaItemRecord;
}
