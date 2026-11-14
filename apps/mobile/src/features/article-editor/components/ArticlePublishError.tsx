/**
 * Errore di pubblicazione dell'Articolo (HOM-06.2 §7M, §7Y, §128–§130, §233, §237).
 *
 * Una riga di stato con icona e testo (l'errore non è mai affidato al solo colore),
 * sempre con copy umana. Il duplicato (§7M) mostra «Questo articolo è già stato
 * collegato.» con «Visualizza articolo» verso quello esistente; un conflitto di
 * versione offre «Ricarica». Niente si cancella: l'utente riprova dalla CTA.
 */

import { useRouter } from "expo-router";

import { contentDetailHref } from "../../feed/content-routes";
import { ComposerStatusBanner } from "../../post-composer/components/ComposerStatusBanner";
import { publishingErrorCopy } from "../../publishing/publishing-presentation";
import type { ContentRef, PublishingErrorKind } from "../../publishing/publishing-types";
import { ARTICLE_DUPLICATE_ACTION } from "../use-article-editor";

type Props = {
  error: PublishingErrorKind | null;
  duplicateRef: ContentRef | null;
  /** Presente quando c'è una versione più recente da riaprire (conflitto, §129). */
  onReload?: (() => void) | null;
};

export function ArticlePublishError({ error, duplicateRef, onReload = null }: Props) {
  const router = useRouter();
  if (!error) {
    return null;
  }

  const message = publishingErrorCopy(error, "article");

  if (error === "article_duplicate" && duplicateRef) {
    return (
      <ComposerStatusBanner
        actionLabel={ARTICLE_DUPLICATE_ACTION}
        message={message}
        onAction={() => router.push(contentDetailHref(duplicateRef.contentType, duplicateRef.contentId) as never)}
        tone="error"
      />
    );
  }

  if ((error === "content_version_conflict" || error === "content_invalid_state") && onReload) {
    return <ComposerStatusBanner actionLabel="Ricarica" message={message} onAction={onReload} tone="error" />;
  }

  return <ComposerStatusBanner message={message} tone="error" />;
}
