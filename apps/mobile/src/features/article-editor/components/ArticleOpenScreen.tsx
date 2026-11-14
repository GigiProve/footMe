/**
 * Riapertura per riferimento (HOM-06.2 §147, §165, §200, §217): quando chi apre un
 * contenuto non sa ancora di che formato né di che modalità è — la notifica di una
 * pubblicazione programmata fallita (§200), «Modifica articolo» da un menu — questa
 * schermata lo legge e SOSTITUISCE se stessa con lo schermo giusto:
 *
 *  • Post → composer Post sulla bozza (`openDraftHref`);
 *  • Articolo → editor nella modalità salvata (`articleDraftHref`): NATIVE e
 *    IMPORTED_TEXT sull'editor, EXTERNAL_LINK su «Collega da un link»;
 *  • contenuto eliminato o a cui non si ha accesso → «Il contenuto non è più
 *    disponibile.», identico a «non esiste» (§259).
 *
 * Non scrive nulla: leggere una bozza non la modifica. L'editor di destinazione
 * rilegge il contenuto e applica le sue regole (modifica di un pubblicato, di un
 * programmato, bozza).
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useSession } from "../../auth/use-session";
import { COMPOSER_FALLBACK_HREF } from "../../post-composer/composer-routes";
import { publishingKeys } from "../../publishing/publishing-keys";
import { openDraftHref } from "../../publishing/publishing-routes";
import { fetchContentForEditor, parsePublishingError } from "../../publishing/publishing-service";
import type { ArticleCreationMode, ContentFormat, ContentLifecycleState } from "../../publishing/publishing-types";
import { articleDraftHref, parseArticleParams } from "../article-routes";
import { ArticleLoading, ArticleMessage, openErrorCopy } from "./ArticleMessage";

type SearchParams = Record<string, string | string[] | undefined>;

type OpenPayload = {
  format: ContentFormat;
  status: ContentLifecycleState;
  article?: { creation_mode: ArticleCreationMode } | null;
};

export function ArticleOpenScreen({ search }: { search: SearchParams }) {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user.id ?? profile?.id ?? "";
  const params = parseArticleParams(search);
  const ref = params.draftRef;
  const redirected = useRef(false);

  // Chiave propria: la stessa del payload completo letto dagli editor avrebbe un'altra forma.
  const query = useQuery({
    enabled: userId.length > 0 && ref !== null,
    gcTime: 0,
    queryFn: () => fetchContentForEditor<OpenPayload>(ref as NonNullable<typeof ref>),
    queryKey: [...publishingKeys.editor(userId, ref ?? { contentId: "", contentType: "profile_post" }), "open"],
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
  });

  const payload = query.data;
  const origin = params.origin;

  useEffect(() => {
    if (!ref || !payload || redirected.current || payload.status === "deleted") return;
    redirected.current = true;
    const href =
      payload.format === "article"
        ? articleDraftHref(ref, payload.article?.creation_mode ?? null, origin)
        : openDraftHref("post", ref);
    router.replace(href as never);
  }, [ref, payload, origin, router]);

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(COMPOSER_FALLBACK_HREF as never);
    }
  }

  if (!ref || payload?.status === "deleted") {
    return <ArticleMessage message={openErrorCopy("content_not_found")} onClose={close} />;
  }

  if (query.error) {
    const kind = parsePublishingError(query.error).kind;
    const retryable = kind === "network" || kind === "unknown";
    return <ArticleMessage message={openErrorCopy(kind)} onClose={close} onRetry={retryable ? () => void query.refetch() : undefined} />;
  }

  return <ArticleLoading />;
}
