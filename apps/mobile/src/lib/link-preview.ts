/**
 * Lightweight client-side link preview.
 *
 * Fetches an article URL on-device and extracts Open Graph / Twitter card
 * metadata from the raw HTML. React Native has no CORS restriction, so this
 * works without any backend. Anything that cannot be parsed comes back `null`
 * and the user fills it in manually in the link importer.
 */

export type LinkPreview = {
  author: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  title: string | null;
  url: string;
};

const FETCH_TIMEOUT_MS = 8000;
/** Stop reading huge pages: OG/Twitter tags always live in <head>. */
const MAX_HTML_LENGTH = 600_000;

/**
 * Normalize a user-typed URL to an absolute https URL, or null if it cannot
 * plausibly be a URL.
 */
export function normalizeLinkUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^www\./i.test(trimmed) || /\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const url = normalizeLinkUrl(rawUrl);
  const fallback: LinkPreview = {
    author: null,
    description: null,
    imageUrl: null,
    siteName: null,
    title: null,
    url: url ?? rawUrl.trim(),
  };

  if (!url) {
    return fallback;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; FootMeLinkPreview/1.0)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ...fallback, siteName: hostnameOf(url) };
    }

    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);

    const title =
      matchMeta(html, [
        ...metaPatterns("og:title"),
        ...metaPatterns("twitter:title"),
      ]) ?? matchMeta(html, [/<title[^>]*>([^<]*)<\/title>/i]);

    const description = matchMeta(html, [
      ...metaPatterns("og:description"),
      ...metaPatterns("twitter:description"),
      ...metaPatterns("description"),
    ]);

    const imageUrl = matchMeta(html, [
      ...metaPatterns("og:image"),
      ...metaPatterns("twitter:image"),
      ...metaPatterns("twitter:image:src"),
    ]);

    const siteName =
      matchMeta(html, metaPatterns("og:site_name")) ?? hostnameOf(url);

    const author = matchMeta(html, [
      ...metaPatterns("article:author"),
      ...metaPatterns("author"),
    ]);

    return {
      author: plausibleAuthor(author),
      description,
      imageUrl: resolveImageUrl(imageUrl, url),
      siteName,
      title,
      url,
    };
  } catch {
    return { ...fallback, siteName: hostnameOf(url) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build the two attribute-order variants for a <meta> tag matched by either
 * `property` or `name` (OG uses property, Twitter/standard use name).
 */
function metaPatterns(key: string): RegExp[] {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i",
    ),
  ];
}

function matchMeta(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html);

    if (match && match[1]) {
      const value = decodeEntities(match[1]).trim();

      if (value) {
        return value;
      }
    }
  }

  return null;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&nbsp;/g, " ");
}

function hostnameOf(url: string): string | null {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url);

  if (!match) {
    return null;
  }

  return match[1].replace(/^www\./i, "");
}

/** Resolve protocol-relative and root-relative og:image values to absolute. */
function resolveImageUrl(image: string | null, baseUrl: string): string | null {
  if (!image) {
    return null;
  }

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  if (image.startsWith("//")) {
    return `https:${image}`;
  }

  const origin = /^(https?:\/\/[^/]+)/i.exec(baseUrl);

  if (image.startsWith("/") && origin) {
    return `${origin[1]}${image}`;
  }

  return null;
}

/** Drop machine-readable author values (URLs) that are not display names. */
function plausibleAuthor(author: string | null): string | null {
  if (!author) {
    return null;
  }

  if (/^https?:\/\//i.test(author)) {
    return null;
  }

  return author;
}
