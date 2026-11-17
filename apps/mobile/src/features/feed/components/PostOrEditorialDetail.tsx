/**
 * Smista il dettaglio di `club_media` / `media_profile` (HOM-08 §8, §11, §13, §266).
 *
 * `fetch_post_detail` decide in base al server cosa è un Post:
 *  • Post → dettaglio canonico «← Post» (`ProfilePostDetail`);
 *  • `null` (Articolo, video editoriale, o non leggibile) → dettaglio
 *    editoriale, che sa mostrare anche «non disponibile»;
 *  • errore → stato di errore con «Riprova» che RIESEGUE la sonda. Un errore di
 *    rete non è «non è un Post» (HOM-04 §66–§68): montare il dettaglio Post per
 *    farlo ritentare darebbe «non disponibile» a un Articolo che esiste.
 *
 * Una volta riconosciuto come Post resta tale: se la cache lo azzera
 * (eliminazione dal dettaglio) non si rimonta l'altro dettaglio.
 *
 * Costo: la sonda precede il caricamento editoriale (un RPC in serie). Il Feed
 * lo evita da sé passando `position` solo per Articolo e Video: il chiamante in
 * quel caso non monta questo componente.
 */

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type { CommentFocus, CommentTarget, ContentOrigin } from "../content-routes";
import { FEED_QK } from "../feed-keys";
import { fetchPostDetail } from "../feed-service";
import { ContentLoadErrorState } from "./ContentUnavailableState";
import { ContentDetailFrame } from "./detail/ContentDetailFrame";
import { ContentDetailSkeleton } from "./detail/ContentDetailSkeleton";
import { ProfilePostDetail } from "./ProfilePostDetail";

type PostOrEditorialDetailProps = {
  /** HOM-14 §47, §51: commento e thread a cui porta una notifica. */
  commentTarget?: CommentTarget | null;
  contentType: "club_media" | "media_profile";
  focus: CommentFocus | null;
  initialMediaIndex: number | null;
  origin: ContentOrigin | null;
  postId: string;
  /** Il dettaglio editoriale, montato solo quando il server dice «non è un Post». */
  renderEditorial: () => ReactNode;
};

export function PostOrEditorialDetail({
  commentTarget = null,
  contentType,
  focus,
  initialMediaIndex,
  origin,
  postId,
  renderEditorial,
}: PostOrEditorialDetailProps) {
  const [wasPost, setWasPost] = useState(false);
  const probe = useQuery({
    queryFn: () => fetchPostDetail(contentType, postId),
    queryKey: FEED_QK.postDetail(postId),
  });

  if (probe.data && !wasPost) {
    setWasPost(true);
  }

  if (wasPost || probe.data) {
    return (
      <ProfilePostDetail
        commentTarget={commentTarget}
        contentType={contentType}
        focus={focus}
        initialMediaIndex={initialMediaIndex}
        origin={origin}
        postId={postId}
      />
    );
  }

  // «Riprova» in corso: lo skeleton (HOM-15 §202, §206), non l'errore di prima. Un refetch in
  // background dopo un `null` valido NON passa di qui (l'editoriale resta montato).
  const isRetrying = probe.isError && probe.isFetching;

  if (probe.isError && !isRetrying) {
    return (
      <ContentDetailFrame title="Contenuto">
        <ContentLoadErrorState onRetry={() => void probe.refetch()} />
      </ContentDetailFrame>
    );
  }

  if (probe.isLoading || isRetrying) {
    return (
      <ContentDetailFrame title="Contenuto">
        <ContentDetailSkeleton />
      </ContentDetailFrame>
    );
  }

  return <>{renderEditorial()}</>;
}
