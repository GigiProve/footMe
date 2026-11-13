/**
 * HOM-02 §79: dal `data` jsonb di un Post al payload camelCase.
 *
 * Separato da `mapFeedRow` perché lo stesso `data` arriva anche da
 * `fetch_profile_post_detail` (§109: Feed e dettaglio non devono divergere).
 *
 * Tutto è difensivo, ed è voluto: un client nuovo davanti a un server che non
 * ha ancora la migrazione HOM-02 riceve solo le chiavi vecchie. In quel caso il
 * Post si costruisce dal media singolo legacy (`thumbnail_url` + `media_type`),
 * i contatori valgono 0 e le capability seguono la sorgente. Un elemento
 * malformato in un array viene scartato da solo, senza far cadere il Post
 * (§87–88: un media rotto non rompe il Post).
 *
 * HOM-03: gli stessi lettori servono anche Articolo e video editoriale (§38,
 * stesso interaction system) e il poll del processing (§65, stesso `media[]`).
 * Il media porta in più `created_at`, `variants` e `captions` (§71, §84) e lo
 * stato `uploaded` (§64).
 */

import type {
  FeedAuthorMeta,
  FeedContentType,
  FeedIdentityType,
  FeedLinkPreview,
  FeedMediaCaption,
  FeedMediaItem,
  FeedMediaProcessingState,
  FeedMediaVariant,
  FeedMention,
  FeedPostCapabilities,
  FeedTaggedIdentity,
} from "./feed-types";

type Data = Record<string, unknown> | null;

const FEED_CONTENT_TYPES: readonly FeedContentType[] = [
  "club_media",
  "media_profile",
  "media_tribuna",
  "fan_tribuna",
  "fan_media",
  "profile_post",
];

/**
 * Sorgenti con una tabella dei Mi piace (club_media_likes, fan_media_likes,
 * profile_post_likes e, da HOM-03 §104, media_profile_post_likes).
 */
const LIKEABLE: readonly FeedContentType[] = [
  "club_media",
  "fan_media",
  "profile_post",
  "media_profile",
];

const PROCESSING_STATES: readonly FeedMediaProcessingState[] = [
  "uploaded",
  "processing",
  "ready",
  "failed",
];

const CAPTION_KINDS: readonly FeedMediaCaption["kind"][] = [
  "captions",
  "subtitles",
  "transcript",
];

/** Le cinque sorgenti CER-05 hanno commenti e salvati; `profile_post` no (HOM-07/08). */
const LEGACY_ONLY: readonly FeedContentType[] = [
  "club_media",
  "media_profile",
  "media_tribuna",
  "fan_tribuna",
  "fan_media",
];

/** `source_kind` che identificano una fonte Media (vedi `feed_content_index`). */
const MEDIA_SOURCE_KINDS = ["testata", "giornalista", "creator", "pagina"];

/** Proporzione usata quando il server non conosce le dimensioni (righe legacy). */
export const DEFAULT_MEDIA_ASPECT_RATIO = 4 / 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(record: Data, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(record: Data, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveInt(record: Data, key: string): number | null {
  const value = num(record, key);
  return value !== null && value > 0 ? Math.round(value) : null;
}

function array(record: Data, key: string): Record<string, unknown>[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function asFeedContentType(value: unknown): FeedContentType | null {
  return typeof value === "string" && FEED_CONTENT_TYPES.includes(value as FeedContentType)
    ? (value as FeedContentType)
    : null;
}

export function readIdentityType(
  data: Data,
  authorKind: "club" | "profile" | null,
  sourceKind: string | null,
): FeedIdentityType {
  const value = data?.["author_identity_type"];
  if (value === "person" || value === "society" || value === "media") {
    return value;
  }
  if (authorKind === "club") {
    return "society";
  }
  return sourceKind && MEDIA_SOURCE_KINDS.includes(sourceKind) ? "media" : "person";
}

export function readAuthorMeta(data: Data): FeedAuthorMeta {
  const meta = isRecord(data?.["author_meta"]) ? (data["author_meta"] as Data) : null;
  return {
    role: str(meta, "role"),
    primaryPosition: str(meta, "primary_position"),
    clubName: str(meta, "club_name"),
    teamLabel: str(meta, "team_label"),
    clubCategory: str(meta, "club_category"),
    mediaKind: str(meta, "media_kind"),
  };
}

function readMediaItem(
  raw: Record<string, unknown>,
  fallbackId: string,
  index: number,
): FeedMediaItem | null {
  const type = raw["media_type"];
  if (type !== "image" && type !== "video") {
    return null;
  }

  const url = str(raw, "url");
  const width = positiveInt(raw, "width");
  const height = positiveInt(raw, "height");
  const processing = raw["processing_state"];
  const availability = raw["availability"];

  return {
    id: str(raw, "media_id") ?? `${fallbackId}:${index}`,
    type,
    position: num(raw, "position") ?? index,
    url,
    thumbnailUrl: str(raw, "thumbnail_url"),
    width,
    height,
    aspectRatio: width && height ? width / height : null,
    durationSeconds: positiveInt(raw, "duration_seconds"),
    altText: str(raw, "alt_text"),
    // Uno stato ignoto vale "ready": l'URL resta l'arbitro della disponibilità.
    processingState: PROCESSING_STATES.includes(processing as FeedMediaProcessingState)
      ? (processing as FeedMediaProcessingState)
      : "ready",
    availability:
      availability === "unavailable" || !url ? "unavailable" : "available",
    createdAt: str(raw, "created_at"),
    variants: readVariants(raw),
    captions: readCaptions(raw),
  };
}

/** I campi HOM-03 di un media che il server non ha mandato (righe legacy). */
function legacyMediaFields(): Pick<FeedMediaItem, "createdAt" | "variants" | "captions"> {
  return { createdAt: null, variants: [], captions: [] };
}

/** §72: una variante senza URL non è riproducibile e si scarta. */
function readVariants(raw: Record<string, unknown>): FeedMediaVariant[] {
  return array(raw, "variants").flatMap((variant): FeedMediaVariant[] => {
    const url = str(variant, "url");
    if (!url) {
      return [];
    }
    return [
      {
        url,
        mimeType: str(variant, "mime_type"),
        width: positiveInt(variant, "width"),
        height: positiveInt(variant, "height"),
        bitrate: positiveInt(variant, "bitrate"),
      },
    ];
  });
}

/** §84: solo i tre tipi previsti; un tipo ignoto non è usabile dal player. */
function readCaptions(raw: Record<string, unknown>): FeedMediaCaption[] {
  return array(raw, "captions").flatMap((caption): FeedMediaCaption[] => {
    const url = str(caption, "url");
    const kind = caption["kind"];
    if (!url || !CAPTION_KINDS.includes(kind as FeedMediaCaption["kind"])) {
      return [];
    }
    return [
      {
        url,
        language: str(caption, "language"),
        kind: kind as FeedMediaCaption["kind"],
        label: str(caption, "label"),
      },
    ];
  });
}

/**
 * §23–25: la collection è unica e ordinata. Il server manda già l'ordine;
 * l'ordinamento qui è solo una difesa contro un array arrivato in disordine.
 * Senza `media` (server pre-HOM-02) si usa il media singolo legacy.
 *
 * HOM-03: `legacy.type` forza il tipo del media singolo quando il chiamante lo
 * conosce meglio di `data.media_type` (la cover di un Articolo è un'immagine).
 * `legacy.videoUrl` è per il video editoriale (`media_profile`), dove la
 * colonna `thumbnail_url` della riga contiene l'URL del VIDEO e non
 * un'immagine: diventa `url`, e la thumbnail resta null (placeholder).
 */
export function readMedia(
  data: Data,
  postKey: string,
  legacy: {
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    type?: FeedMediaItem["type"];
    videoUrl?: string | null;
  },
): FeedMediaItem[] {
  if (Array.isArray(data?.["media"])) {
    return array(data, "media")
      .map((raw, index) => readMediaItem(raw, postKey, index))
      .filter((item): item is FeedMediaItem => item !== null)
      .sort((a, b) => a.position - b.position);
  }

  const url = legacy.videoUrl ?? legacy.thumbnailUrl;
  if (!url) {
    return [];
  }

  const type = legacy.videoUrl
    ? "video"
    : (legacy.type ?? (data?.["media_type"] === "video" ? "video" : "image"));
  return [
    {
      id: `${postKey}:0`,
      type,
      position: 0,
      url,
      thumbnailUrl: legacy.videoUrl ? null : legacy.thumbnailUrl,
      width: null,
      height: null,
      aspectRatio: null,
      durationSeconds: legacy.durationSeconds,
      altText: null,
      processingState: "ready",
      availability: "available",
      ...legacyMediaFields(),
    },
  ];
}

/** §18: una mention senza id, tipo o range valido non è apribile e si scarta. */
export function readMentions(data: Data, body: string | null): FeedMention[] {
  const length = body?.length ?? 0;
  return array(data, "mentions").flatMap((raw): FeedMention[] => {
    const identityId = str(raw, "identity_id");
    const identityType = raw["identity_type"];
    const displayName = str(raw, "display_name");
    const start = num(raw, "start");
    const end = num(raw, "end");
    if (
      !identityId ||
      (identityType !== "profile" && identityType !== "club") ||
      !displayName ||
      start === null ||
      end === null ||
      start < 0 ||
      end <= start ||
      end > length
    ) {
      return [];
    }
    return [{ identityId, identityType, displayName, start, end }];
  });
}

export function readTagged(data: Data): FeedTaggedIdentity[] {
  return array(data, "tagged").flatMap((raw): FeedTaggedIdentity[] => {
    const identityId = str(raw, "identity_id");
    const identityType = raw["identity_type"];
    const displayName = str(raw, "display_name");
    if (
      !identityId ||
      !displayName ||
      (identityType !== "profile" && identityType !== "club" && identityType !== "team")
    ) {
      return [];
    }
    return [{ identityId, identityType, displayName, avatarUrl: str(raw, "avatar_url") }];
  });
}

/** §43: solo https e un dominio; senza i due non c'è preview da mostrare. */
export function readLinkPreview(data: Data): FeedLinkPreview | null {
  const raw = isRecord(data?.["link_preview"]) ? (data["link_preview"] as Data) : null;
  const url = str(raw, "url");
  if (!url || !/^https:\/\//i.test(url)) {
    return null;
  }

  const domain = str(raw, "domain") ?? url.replace(/^https:\/\//i, "").split(/[/?#]/)[0];
  if (!domain) {
    return null;
  }

  return {
    url,
    title: str(raw, "title"),
    description: str(raw, "description"),
    domain: domain.replace(/^www\./i, ""),
    thumbnailUrl: str(raw, "thumbnail_url"),
  };
}

/**
 * §81: le capability arrivano dal server. Il default per sorgente vale solo
 * per un server pre-HOM-02 e non concede mai modifica, eliminazione o insights.
 */
export function readCapabilities(
  data: Data,
  contentType: FeedContentType,
): FeedPostCapabilities {
  const raw = isRecord(data?.["capabilities"]) ? (data["capabilities"] as Data) : null;
  const flag = (key: string, fallback: boolean) =>
    typeof raw?.[key] === "boolean" ? (raw[key] as boolean) : fallback;
  const legacy = LEGACY_ONLY.includes(contentType);

  return {
    canLike: flag("can_like", LIKEABLE.includes(contentType)),
    canComment: flag("can_comment", legacy),
    canShare: flag("can_share", true),
    canSave: flag("can_save", legacy),
    canReport: flag("can_report", true),
    canEdit: flag("can_edit", false),
    canDelete: flag("can_delete", false),
    canViewInsights: flag("can_view_insights", false),
  };
}

export function readCount(data: Data, key: string): number {
  const value = num(data, key);
  return value !== null && value > 0 ? Math.floor(value) : 0;
}
