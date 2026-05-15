import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export const DIRECTOR_MEDIA_TAG_OPTIONS = [
  { icon: "mic-outline", label: "Intervista", value: "interview" },
  { icon: "person-add-outline", label: "Presentazione", value: "presentation" },
  { icon: "search-outline", label: "Scouting", value: "scouting" },
  { icon: "calendar-outline", label: "Evento", value: "event" },
  { icon: "people-outline", label: "Networking", value: "networking" },
  { icon: "business-outline", label: "Club", value: "club" },
  { icon: "swap-horizontal-outline", label: "Mercato", value: "market" },
  { icon: "school-outline", label: "Giovani", value: "youth" },
  { icon: "megaphone-outline", label: "Annuncio", value: "announcement" },
  { icon: "trophy-outline", label: "Risultato", value: "result" },
] as const satisfies readonly {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}[];

export type DirectorMediaTag =
  (typeof DIRECTOR_MEDIA_TAG_OPTIONS)[number]["value"];

export type DirectorMediaLinkedTarget = {
  avatar_url: string | null;
  display_name: string;
  role: string | null;
  subtitle: string | null;
  target_id: string;
  target_type: "profile" | "club";
};

export type DirectorMediaItemRecord = {
  created_at: string | null;
  description: string | null;
  id: string;
  is_featured: boolean;
  linked_targets: DirectorMediaLinkedTarget[];
  tag: DirectorMediaTag | null;
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

export type DirectorMediaTargetCandidate = DirectorMediaLinkedTarget;

export function getDirectorMediaTagMeta(
  tag: DirectorMediaTag | null,
): (typeof DIRECTOR_MEDIA_TAG_OPTIONS)[number] | null {
  if (tag === null) {
    return null;
  }

  return DIRECTOR_MEDIA_TAG_OPTIONS.find((option) => option.value === tag) ?? null;
}

export function normalizeDirectorMediaTag(value: unknown): DirectorMediaTag | null {
  return value === "interview" ||
    value === "presentation" ||
    value === "scouting" ||
    value === "event" ||
    value === "networking" ||
    value === "club" ||
    value === "market" ||
    value === "youth" ||
    value === "announcement" ||
    value === "result"
    ? value
    : null;
}

export function inferDirectorMediaTypeFromUrl(value: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(value) ? "video" : "image";
}

export function normalizeDirectorMediaItems(value: unknown): DirectorMediaItemRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  return value
    .map((entry, index) => normalizeDirectorMediaItem(entry, index))
    .filter((entry): entry is DirectorMediaItemRecord => entry !== null);
}

function normalizeDirectorMediaItem(
  value: unknown,
  index: number,
): DirectorMediaItemRecord | null {
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
      : inferDirectorMediaTypeFromUrl(url);

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
        : `director-media-${index}`,
    is_featured: typeof entry.is_featured === "boolean" ? entry.is_featured : false,
    linked_targets: normalizeDirectorMediaLinkedTargets(entry.linked_targets),
    tag: normalizeDirectorMediaTag(entry.tag),
    thumbnail_url:
      typeof entry.thumbnail_url === "string" && entry.thumbnail_url.trim()
        ? entry.thumbnail_url.trim()
        : type === "image"
          ? url
          : null,
    type,
    url,
  } satisfies DirectorMediaItemRecord;
}

function normalizeDirectorMediaLinkedTargets(
  value: unknown,
): DirectorMediaLinkedTarget[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  return value
    .map((entry) => normalizeDirectorMediaLinkedTarget(entry))
    .filter((entry): entry is DirectorMediaLinkedTarget => entry !== null);
}

function normalizeDirectorMediaLinkedTarget(
  value: unknown,
): DirectorMediaLinkedTarget | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const targetType =
    entry.target_type === "profile" || entry.target_type === "club"
      ? entry.target_type
      : null;
  const targetId =
    typeof entry.target_id === "string" ? entry.target_id.trim() : "";
  const displayName =
    typeof entry.display_name === "string" ? entry.display_name.trim() : "";

  if (!targetType || !targetId || !displayName) {
    return null;
  }

  return {
    avatar_url:
      typeof entry.avatar_url === "string" && entry.avatar_url.trim()
        ? entry.avatar_url.trim()
        : null,
    display_name: displayName,
    role:
      typeof entry.role === "string" && entry.role.trim()
        ? entry.role.trim()
        : null,
    subtitle:
      typeof entry.subtitle === "string" && entry.subtitle.trim()
        ? entry.subtitle.trim()
        : null,
    target_id: targetId,
    target_type: targetType,
  } satisfies DirectorMediaLinkedTarget;
}
