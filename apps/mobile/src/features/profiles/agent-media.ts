export const AGENT_MEDIA_TAG_OPTIONS = [
  { label: "Trasferimento", value: "transfer" },
  { label: "Firma", value: "signature" },
  { label: "Evento", value: "event" },
  { label: "Highlights", value: "highlights" },
] as const;

export const AGENT_MEDIA_OPERATION_TYPE_OPTIONS = [
  { label: "Inserimento", value: "insertion" },
  { label: "Prova", value: "trial" },
  { label: "Firma", value: "signature" },
  { label: "Rinnovo", value: "renewal" },
  { label: "Prestito", value: "loan" },
] as const;

export type AgentMediaTag = (typeof AGENT_MEDIA_TAG_OPTIONS)[number]["value"];
export type AgentMediaOperationType =
  (typeof AGENT_MEDIA_OPERATION_TYPE_OPTIONS)[number]["value"];

export type AgentMediaTaggedPlayerRecord = {
  avatar_url: string | null;
  display_name: string;
  profile_id: string;
};

export type AgentMediaItemRecord = {
  created_at: string | null;
  description: string | null;
  id: string;
  operation_type: AgentMediaOperationType | null;
  tag: AgentMediaTag | null;
  tagged_players: AgentMediaTaggedPlayerRecord[];
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

export function getAgentMediaTagMeta(
  tag: AgentMediaTag | null,
): (typeof AGENT_MEDIA_TAG_OPTIONS)[number] | null {
  if (tag === null) {
    return null;
  }

  return AGENT_MEDIA_TAG_OPTIONS.find((option) => option.value === tag) ?? null;
}

export function getAgentMediaOperationTypeMeta(
  operationType: AgentMediaOperationType | null,
): (typeof AGENT_MEDIA_OPERATION_TYPE_OPTIONS)[number] | null {
  if (operationType === null) {
    return null;
  }

  return (
    AGENT_MEDIA_OPERATION_TYPE_OPTIONS.find(
      (option) => option.value === operationType,
    ) ?? null
  );
}

export function normalizeAgentMediaTag(value: unknown): AgentMediaTag | null {
  return value === "transfer" ||
    value === "signature" ||
    value === "event" ||
    value === "highlights"
    ? value
    : null;
}

export function normalizeAgentMediaOperationType(
  value: unknown,
): AgentMediaOperationType | null {
  return value === "insertion" ||
    value === "trial" ||
    value === "signature" ||
    value === "renewal" ||
    value === "loan"
    ? value
    : null;
}

export function inferAgentMediaTypeFromUrl(value: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(value) ? "video" : "image";
}

export function normalizeAgentMediaItems(value: unknown): AgentMediaItemRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  return value
    .map((entry, index) => normalizeAgentMediaItem(entry, index))
    .filter((entry): entry is AgentMediaItemRecord => entry !== null);
}

function normalizeAgentMediaItem(
  value: unknown,
  index: number,
): AgentMediaItemRecord | null {
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
      : inferAgentMediaTypeFromUrl(url);

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
        : `agent-media-${index}`,
    operation_type: normalizeAgentMediaOperationType(entry.operation_type),
    tag: normalizeAgentMediaTag(entry.tag),
    tagged_players: normalizeAgentMediaTaggedPlayers(entry.tagged_players),
    thumbnail_url:
      typeof entry.thumbnail_url === "string" && entry.thumbnail_url.trim()
        ? entry.thumbnail_url.trim()
        : type === "image"
          ? url
          : null,
    type,
    url,
  } satisfies AgentMediaItemRecord;
}

function normalizeAgentMediaTaggedPlayers(
  value: unknown,
): AgentMediaTaggedPlayerRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  return value
    .map((entry) => normalizeAgentMediaTaggedPlayer(entry))
    .filter((entry): entry is AgentMediaTaggedPlayerRecord => entry !== null);
}

function normalizeAgentMediaTaggedPlayer(
  value: unknown,
): AgentMediaTaggedPlayerRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const profileId =
    typeof entry.profile_id === "string" ? entry.profile_id.trim() : "";
  const displayName =
    typeof entry.display_name === "string" ? entry.display_name.trim() : "";

  if (!profileId || !displayName) {
    return null;
  }

  return {
    avatar_url:
      typeof entry.avatar_url === "string" && entry.avatar_url.trim()
        ? entry.avatar_url.trim()
        : null,
    display_name: displayName,
    profile_id: profileId,
  } satisfies AgentMediaTaggedPlayerRecord;
}
