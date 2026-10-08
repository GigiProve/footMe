/**
 * View model pubblico dell'articolo (REV-PROF-21, "Tab Articoli — principio").
 *
 * Un articolo può nascere in tre modi, che HOM-06.2 chiama `NATIVE`,
 * `EXTERNAL_LINK` e `IMPORTED_TEXT` e che il repository persiste già su
 * `media_profile_posts.source_type` come `platform`, `link` e `pasted`. La
 * tab Articoli non ha tre liste e non mostra le origini come tab: legge un
 * solo view model normalizzato, e l'origine decide soltanto come si firma il
 * contenuto.
 *
 * Il corpo dell'articolo non passa da qui: la lista mostra anteprime, e
 * l'estratto arriva da un campo pubblico invece di essere ritagliato dal
 * testo lato client.
 */
import {
  formatExternalDomain,
  normalizeExternalUrl,
} from "./media-master-profile";
import type {
  MediaProfilePost,
  MediaProfilePostTaggedTarget,
} from "../media-profile-post-service";

/** Le tre origini canoniche, nei nomi di HOM-06.2. */
export type MediaArticleOrigin = "NATIVE" | "EXTERNAL_LINK" | "IMPORTED_TEXT";

export type MediaArticleViewModel = {
  /** "Mercato", "Interviste": la categoria canonica dell'articolo. */
  category: string;
  commentCount: number;
  coverUrl: string | null;
  /** "19 giu", localizzata. Assente se la data non è utilizzabile. */
  dateLabel: string | null;
  /** Dominio pubblico della fonte esterna: "dominio.it". */
  domainLabel: string | null;
  excerpt: string | null;
  /** URL esterno già normalizzato e validato, o `null`. */
  externalUrl: string | null;
  id: string;
  isExternal: boolean;
  origin: MediaArticleOrigin;
  /**
   * Firma della card: "di Marco Rossi" per un articolo nativo, "Condiviso da
   * TuttoDilettanti" per un link. Mai dedotta dal proprietario del profilo.
   */
  primaryAttribution: string | null;
  /** "Fonte originale · dominio.it", solo per i link. */
  sourceAttribution: string | null;
  taggedTargets: readonly MediaProfilePostTaggedTarget[];
  /** "3 min". Assente quando il dato non c'è: non si mostra "0 min". */
  tagline: string | null;
  title: string;
};

/**
 * `source_type` è il campo persistito; `origin` è il nome del contratto
 * pubblico. La traduzione sta in un posto solo, così il giorno in cui
 * HOM-06.2 scriverà direttamente l'origine canonica cambia solo questa
 * funzione.
 */
export function resolveMediaArticleOrigin(
  post: Pick<MediaProfilePost, "external_url" | "source_type">,
): MediaArticleOrigin {
  if (post.source_type === "link") {
    return "EXTERNAL_LINK";
  }

  if (post.source_type === "pasted") {
    return "IMPORTED_TEXT";
  }

  /*
    Difensivo, per i contenuti anteriori all'introduzione di `source_type`:
    un articolo con un URL esterno e nessuna origine dichiarata è un link, non
    un testo scritto su PROLINK.
  */
  return post.external_url ? "EXTERNAL_LINK" : "NATIVE";
}

export function buildMediaArticleViewModel(
  post: MediaProfilePost,
  publisherName: string | null,
): MediaArticleViewModel {
  const origin = resolveMediaArticleOrigin(post);
  const externalUrl = normalizeExternalUrl(post.external_url);
  const domainLabel = formatExternalDomain(post.external_url);
  const sourceLabel = normalizeText(post.source_name) ?? domainLabel;
  const authorName = normalizeText(post.author_name);
  const publisher = normalizeText(publisherName) ?? normalizeText(post.publisher_name);

  return {
    category: post.category.trim(),
    commentCount: post.comment_count,
    coverUrl: normalizeText(post.cover_url),
    dateLabel: formatArticleDate(post.published_at ?? post.created_at),
    domainLabel,
    excerpt: normalizeText(post.excerpt),
    externalUrl,
    id: post.id,
    isExternal: origin === "EXTERNAL_LINK",
    origin,
    primaryAttribution: buildPrimaryAttribution(origin, authorName, publisher),
    sourceAttribution:
      origin === "EXTERNAL_LINK" && sourceLabel
        ? `Fonte originale · ${sourceLabel}`
        : null,
    tagline: formatReadingTime(post),
    taggedTargets: post.tagged_targets,
    title: post.title.trim(),
  };
}

/**
 * Chi firma il contenuto.
 *
 * Un articolo collegato da un link non viene attribuito all'identity PROLINK
 * come se l'avesse scritta: si dice chi l'ha condiviso, e la fonte originale
 * resta su una riga propria. Un articolo nativo porta l'autore pubblico
 * definito dall'articolo — una persona della redazione o una firma
 * editoriale — e, quando non c'è, la realtà che pubblica. Nessuno dei due
 * casi ricade sul nome del proprietario dell'account.
 */
function buildPrimaryAttribution(
  origin: MediaArticleOrigin,
  authorName: string | null,
  publisherName: string | null,
): string | null {
  if (origin === "EXTERNAL_LINK") {
    return publisherName ? `Condiviso da ${publisherName}` : null;
  }

  if (authorName) {
    return `di ${authorName}`;
  }

  return publisherName;
}

/**
 * Tempo di lettura: assente, si omette. "0 min" non è un'informazione, e un
 * contenuto solo-anteprima non ha un corpo da leggere su PROLINK.
 */
function formatReadingTime(
  post: Pick<
    MediaProfilePost,
    "display_mode" | "kind" | "reading_time_minutes"
  >,
): string | null {
  if (post.kind === "news" || post.display_mode === "preview") {
    return null;
  }

  return post.reading_time_minutes > 0
    ? `${post.reading_time_minutes} min`
    : null;
}

/**
 * Data localizzata e breve: "19 giu". `Date` interpreta il timestamp UTC e lo
 * formatta nel fuso del dispositivo, che è il comportamento atteso.
 */
export function formatArticleDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

/**
 * Nome accessibile della card (REV-PROF-21 §Accessibilità). Una card non deve
 * essere una sequenza incomprensibile di frammenti, e i metadati assenti non
 * vengono annunciati come vuoti.
 */
export function buildMediaArticleAccessibilityLabel(
  article: MediaArticleViewModel,
): string {
  const parts = [`Articolo: ${article.title}`];

  if (article.category) {
    parts.push(`categoria ${article.category}`);
  }

  if (article.primaryAttribution) {
    parts.push(`pubblicato da ${stripSignaturePrefix(article.primaryAttribution)}`);
  }

  if (article.dateLabel) {
    parts.push(article.dateLabel);
  }

  if (article.tagline) {
    parts.push(`${article.tagline} di lettura`);
  }

  if (article.isExternal) {
    parts.push("link esterno");
  }

  return `${parts.join(", ")}.`;
}

/** "di Marco Rossi" → "Marco Rossi": nel parlato il "di" lo mette la frase. */
function stripSignaturePrefix(value: string): string {
  return value.replace(/^(di|Condiviso da)\s+/i, "");
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}
