/**
 * Modelli di rendering pubblico dell'Articolo (HOM-06.2 §7D, §7K, §7U, §49,
 * §63–§70, §216). Puro: niente React, niente rete.
 *
 *  • rich link (§65, §69): card editoriale con anteprima; senza anteprima
 *    utilizzabile, il fallback «dominio» + «Apri link». Nessuna CTA
 *    pubblicitaria (§65): la card è un unico link.
 *  • fonte esterna (§7D, §7K): «Condiviso da [publisher]», «Fonte originale ·
 *    dominio», CTA «Leggi sul sito originale». L'identity PROLINK non è mai
 *    presentata come autrice del testo esterno.
 *  • attribuzione di un testo importato già pubblicato altrove (§7U): publisher,
 *    fonte, autore originale e link originale solo se sicuro. Non certifica la
 *    titolarità dei diritti: la dichiarazione resta privata (§7Q, §216).
 *
 * Gli URL aperti dall'utente passano sempre da `safeLinkUrl` (solo https).
 */

import { safeLinkUrl, urlDomain } from "./article-document";
import { publisherLine, sourceLine } from "./article-presentation";
import type { ArticleBlock, ArticleDetail, ArticleMark } from "./article-types";

export type RichLinkBlock = Extract<ArticleBlock, { type: "rich_link" }>;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Le immagini della fonte si caricano solo in https: niente upgrade silenzioso, l'asset potrebbe non esistere. */
export function httpsAssetUrl(raw: string | null | undefined): string | null {
  const value = clean(raw);
  return value && /^https:\/\/[^\s]+$/i.test(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Marks e liste                                                       */
/* ------------------------------------------------------------------ */

export function markFlags(marks: readonly ArticleMark[] | undefined): { bold: boolean; italic: boolean } {
  return { bold: marks?.includes("bold") === true, italic: marks?.includes("italic") === true };
}

/** §43–§44: il numero vale per la lista, non per il documento (ogni lista riparte da 1). */
export function listMarker(kind: "unordered_list" | "ordered_list", index: number): string {
  return kind === "ordered_list" ? `${index + 1}.` : "•";
}

/* ------------------------------------------------------------------ */
/* Rich link (§63–§70)                                                 */
/* ------------------------------------------------------------------ */

export type RichLinkModel =
  | {
      variant: "card";
      href: string;
      domain: string | null;
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      faviconUrl: string | null;
      accessibilityLabel: string;
    }
  | { variant: "fallback"; href: string; domain: string | null; accessibilityLabel: string };

/**
 * `null` se l'URL non è sicuro: il blocco non si disegna e non si apre nulla
 * (§67). La preview arriva dal server (§68); senza titolo, descrizione né
 * immagine è come non averla (§69).
 */
export function richLinkModel(block: RichLinkBlock): RichLinkModel | null {
  const href = safeLinkUrl(block.url ?? "");
  if (!href) {
    return null;
  }

  const preview = block.preview ?? null;
  const domain = clean(preview?.domain)?.toLowerCase().replace(/^www\./, "") ?? urlDomain(href);
  const title = clean(preview?.title);
  const description = clean(preview?.description);
  const imageUrl = httpsAssetUrl(preview?.image_url);

  if (!title && !description && !imageUrl) {
    return {
      accessibilityLabel: domain ? `Apri link, ${domain}` : "Apri link",
      domain,
      href,
      variant: "fallback",
    };
  }

  return {
    accessibilityLabel: [title ?? domain, domain && title ? domain : null].filter(Boolean).join(", ") || "Apri link",
    description,
    domain,
    faviconUrl: httpsAssetUrl(preview?.favicon_url),
    href,
    imageUrl,
    title,
    variant: "card",
  };
}

/* ------------------------------------------------------------------ */
/* Fonte esterna (§7D, §7K)                                            */
/* ------------------------------------------------------------------ */

export const SOURCE_CTA_LABEL = "Leggi sul sito originale";

export type ArticleSourceInput = {
  openUrl: string | null;
  domain: string;
  siteName: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
};

export type SourceCardModel = {
  eyebrow: string;
  /** `null` = URL assente o non sicuro: la CTA è disabilitata (anteprima di una bozza, §7K). */
  href: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  sourceLine: string | null;
  ctaLabel: string;
  ctaAccessibilityLabel: string;
};

export function sourceCardModel(source: ArticleSourceInput, publisherName: string): SourceCardModel {
  const name = publisherName.trim();
  const href = source.openUrl ? safeLinkUrl(source.openUrl) : null;
  const domain = clean(source.domain);
  return {
    ctaAccessibilityLabel: domain ? `${SOURCE_CTA_LABEL}, ${domain}` : SOURCE_CTA_LABEL,
    ctaLabel: SOURCE_CTA_LABEL,
    description: clean(source.description),
    eyebrow: name ? (publisherLine("external_link", name, false) ?? `Condiviso da ${name}`) : "Condiviso",
    faviconUrl: httpsAssetUrl(source.faviconUrl),
    href,
    imageUrl: httpsAssetUrl(source.imageUrl),
    sourceLine: sourceLine(domain, clean(source.siteName)),
    title: clean(source.title),
  };
}

/** Nel dettaglio il titolo è già la testata: la card non lo ripete se coincide (§7K non lo vieta, evita il doppione). */
export function dedupeTitle(title: string | null, headline: string | null | undefined): string | null {
  const value = clean(title);
  const head = clean(headline);
  if (!value) return null;
  return head && head.toLowerCase() === value.toLowerCase() ? null : value;
}

/* ------------------------------------------------------------------ */
/* Dettaglio: che cosa mostrare                                        */
/* ------------------------------------------------------------------ */

export type ArticleBodyKind = "external" | "document" | "none";

/**
 * Il corpo del dettaglio (§7K, §49). `none` = il server non ha un documento né
 * una fonte da mostrare (vecchi articoli senza documento): il chiamante ripiega
 * sul corpo piano storico invece di una pagina vuota.
 */
export function articleBodyKind(detail: Pick<ArticleDetail, "creationMode" | "document" | "source"> | null): ArticleBodyKind {
  if (!detail) {
    return "none";
  }
  if (detail.creationMode === "external_link") {
    return detail.source ? "external" : "none";
  }
  return (detail.document?.blocks?.length ?? 0) > 0 ? "document" : "none";
}

/** §7U: l'attribuzione compare solo per un testo importato dichiarato come già pubblicato altrove. */
export function showsAttribution(detail: Pick<ArticleDetail, "creationMode" | "attribution">): boolean {
  return detail.creationMode === "imported_text" && detail.attribution?.publishedElsewhere === true;
}

/* ------------------------------------------------------------------ */
/* Attribuzione di un testo importato (§7U)                            */
/* ------------------------------------------------------------------ */

export type AttributionInput = {
  publisherName: string;
  sourceName: string | null;
  originalAuthor: string | null;
  originalUrl: string | null;
};

export type AttributionModel = {
  publishedBy: string;
  source: string | null;
  author: string | null;
  link: { href: string; label: string; accessibilityLabel: string } | null;
};

export function attributionModel(input: AttributionInput): AttributionModel {
  const name = input.publisherName.trim();
  const sourceName = clean(input.sourceName);
  const author = clean(input.originalAuthor);
  const href = input.originalUrl ? safeLinkUrl(input.originalUrl) : null;
  const domain = href ? urlDomain(href) : null;

  return {
    author: author ? `Autore originale · ${author}` : null,
    link: href
      ? {
          accessibilityLabel: domain ? `Apri l'articolo originale, ${domain}` : "Apri l'articolo originale",
          href,
          label: "Apri l'articolo originale",
        }
      : null,
    publishedBy: name ? (publisherLine("imported_text", name, true) ?? `Pubblicato da ${name}`) : "Pubblicato su PROLINK",
    source: sourceName ? `Fonte originale · ${sourceName}` : null,
  };
}
