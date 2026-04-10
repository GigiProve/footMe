import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export const PLAYER_MEDIA_TAG_OPTIONS = [
  { icon: "football-outline", label: "Gol", value: "goal" },
  { icon: "git-compare-outline", label: "Assist", value: "assist" },
  { icon: "play-circle-outline", label: "Highlights", value: "highlights" },
  { icon: "shield-checkmark-outline", label: "Parata", value: "save" },
] as const satisfies readonly {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}[];

export type PlayerMediaTag = (typeof PLAYER_MEDIA_TAG_OPTIONS)[number]["value"];

export type PlayerMediaItemRecord = {
  created_at: string | null;
  description: string | null;
  id: string;
  is_featured: boolean;
  tag: PlayerMediaTag | null;
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

export function getPlayerMediaTagMeta(
  tag: PlayerMediaTag | null,
): (typeof PLAYER_MEDIA_TAG_OPTIONS)[number] | null {
  if (tag === null) return null;
  return PLAYER_MEDIA_TAG_OPTIONS.find((option) => option.value === tag) ?? null;
}

export function normalizePlayerMediaTag(value: unknown): PlayerMediaTag | null {
  return value === "goal" || value === "assist" || value === "save" || value === "highlights"
    ? value
    : null;
}

export function inferPlayerMediaTypeFromUrl(value: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(value) ? "video" : "image";
}

export function normalizePlayerMediaItems(
  value: unknown,
  fallbackUrls: string[] = [],
): PlayerMediaItemRecord[] {
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((entry, index) => normalizePlayerMediaItem(entry, index))
      .filter((entry): entry is PlayerMediaItemRecord => entry !== null);
  }

  return fallbackUrls
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((url, index) => {
      const type = inferPlayerMediaTypeFromUrl(url);

      return {
        created_at: null,
        description: null,
        id: `legacy-media-${index}`,
        is_featured: false,
        tag: null,
        thumbnail_url: type === "image" ? url : null,
        type,
        url,
      } satisfies PlayerMediaItemRecord;
    });
}

function normalizePlayerMediaItem(
  value: unknown,
  index: number,
): PlayerMediaItemRecord | null {
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
      : inferPlayerMediaTypeFromUrl(url);

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
        : `player-media-${index}`,
    is_featured: typeof entry.is_featured === "boolean" ? entry.is_featured : false,
    tag: normalizePlayerMediaTag(entry.tag),
    thumbnail_url:
      typeof entry.thumbnail_url === "string" && entry.thumbnail_url.trim()
        ? entry.thumbnail_url.trim()
        : type === "image"
          ? url
          : null,
    type,
    url,
  } satisfies PlayerMediaItemRecord;
}
