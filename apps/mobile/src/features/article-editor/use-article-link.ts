/**
 * Campo «URL dell'articolo originale» di «Collega da un link» (HOM-06.2 §7F–§7M,
 * §7Y). Valida l'indirizzo, chiede i metadata alla Edge Function condivisa e
 * scrive l'esito nello store come `ExternalSourceState`.
 *
 *  • l'URL inserito NON si perde mai (§7F, §7Y): un errore lo lascia dov'è e
 *    offre «Riprova»; nemmeno un fallimento dei metadata lo cancella;
 *  • il controllo parte da solo qualche istante dopo che l'indirizzo è valido
 *    (incolla), alla conferma da tastiera o all'uscita dal campo, e MAI due volte
 *    per lo stesso indirizzo; una risposta per un indirizzo ormai cambiato si scarta;
 *  • un indirizzo non valido (schema non sicuro, §7G) non esce dal dispositivo;
 *  • analytics (§257): solo l'esito, mai l'URL né il dominio.
 */

import { useEffect, useRef, useState } from "react";

import { trackArticle } from "./article-analytics";
import { safeLinkUrl } from "./article-document";
import { withScheme } from "./article-editing";
import type { ExternalSourceState } from "./article-presentation";
import { fetchArticleSource } from "./article-service";
import { articleStore } from "./article-store";
import { useArticleStoreState } from "./use-article-store";

const AUTO_LOAD_MS = 900;

function sourceUrlOf(source: ExternalSourceState): string {
  return source.status === "empty" ? "" : source.url;
}

export function useArticleLink() {
  const state = useArticleStoreState();
  const [text, setText] = useState(() => sourceUrlOf(articleStore.getState().source));
  const request = useRef(0);

  async function load(raw: string, force = false) {
    const url = withScheme(raw);
    if (url.length === 0) {
      request.current += 1;
      articleStore.dispatch({ source: { status: "empty" }, type: "sourceChanged" });
      return;
    }

    const current = articleStore.getState().source;
    if (!force && current.status !== "failed" && sourceUrlOf(current) === url) return;

    request.current += 1;
    const id = request.current;

    if (!safeLinkUrl(url)) {
      articleStore.dispatch({ source: { domain: null, reason: "invalid", status: "failed", url }, type: "sourceChanged" });
      trackArticle({ name: "external_article_metadata_failure", reason: "invalid" });
      return;
    }

    trackArticle({ name: "external_article_url_submitted" });
    articleStore.dispatch({ source: { status: "loading", url }, type: "sourceChanged" });
    const result = await fetchArticleSource(url);
    // Nel frattempo l'indirizzo è cambiato: la risposta non vale più.
    if (id !== request.current) return;

    articleStore.dispatch({ source: result, type: "sourceChanged" });
    if (result.status === "ready") {
      trackArticle({
        hasImage: Boolean(result.snapshot.image_url),
        hasTitle: Boolean(result.snapshot.title?.trim()),
        name: "external_article_metadata_success",
      });
    } else if (result.status === "failed") {
      trackArticle({ name: "external_article_metadata_failure", reason: result.reason });
    }
  }

  const latest = useRef({ load });
  latest.current = { load };

  // Incolla: l'anteprima parte da sola quando l'indirizzo è valido e nuovo.
  useEffect(() => {
    const url = withScheme(text);
    const current = articleStore.getState().source;
    if (!safeLinkUrl(url) || (current.status !== "failed" && sourceUrlOf(current) === url) || current.status === "loading") return;
    const timer = setTimeout(() => {
      void latest.current.load(text);
    }, AUTO_LOAD_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return {
    commit: () => {
      void load(text);
    },
    retry: () => {
      void load(text, true);
    },
    setText,
    source: state.source,
    text,
  };
}

export type ArticleLink = ReturnType<typeof useArticleLink>;
