/**
 * Corpo del dettaglio pubblico di un Articolo (HOM-06.2 §7D, §7K, §7U, §73–§74).
 *
 *  • EXTERNAL_LINK → `ArticleSourceCard`: «Condiviso da», fonte originale e CTA
 *    «Leggi sul sito originale». Il tap sulla card dal Feed/Profilo/Cerca/Salvati
 *    ha già portato qui (§7K): niente salto al browser senza contesto.
 *  • NATIVE / IMPORTED_TEXT → `ArticleDocumentView`, lo stesso renderer
 *    dell'Anteprima (§73). Per un testo importato già pubblicato altrove,
 *    `ArticleAttribution` sopra il testo (§7U): la fonte resta visibile.
 *
 * Restituisce i figli direttamente (nessun contenitore): la spaziatura è quella
 * del contenitore del dettaglio.
 */

import { articleBodyKind, dedupeTitle, showsAttribution } from "../article-render";
import type { ArticleDetail } from "../article-types";
import { ArticleAttribution } from "./ArticleAttribution";
import { ArticleDocumentView } from "./ArticleDocumentView";
import { ArticleSourceCard } from "./ArticleSourceCard";

type ArticleDetailBodyProps = {
  detail: ArticleDetail;
  /** Nome dell'identity che pubblica su PROLINK. */
  publisherName: string;
  /** Titolo già mostrato come testata del dettaglio: la card non lo ripete. */
  headline: string;
  /** Tap su «Leggi sul sito originale», prima dell'apertura. */
  onOpenSource?: () => void;
};

export function ArticleDetailBody({ detail, publisherName, headline, onOpenSource }: ArticleDetailBodyProps) {
  const kind = articleBodyKind(detail);

  if (kind === "external" && detail.source) {
    return (
      <ArticleSourceCard
        onOpen={onOpenSource}
        publisherName={publisherName}
        source={{ ...detail.source, title: dedupeTitle(detail.source.title, headline) }}
      />
    );
  }

  if (kind === "document") {
    return (
      <>
        {showsAttribution(detail) && detail.attribution ? (
          <ArticleAttribution
            originalAuthor={detail.attribution.originalAuthor}
            originalUrl={detail.attribution.originalUrl}
            publisherName={publisherName}
            sourceName={detail.attribution.sourceName}
          />
        ) : null}
        <ArticleDocumentView document={detail.document} />
      </>
    );
  }

  return null;
}
