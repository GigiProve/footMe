/**
 * Media e contenuti (REV-PROF-22, voce dell'hub).
 *
 * Non è una galleria nuova: è `MediaMediaTab`, la stessa superficie Media del
 * Master Profile, dentro la cornice dei moduli di Modifica profilo — app bar,
 * back verso l'hub, nessuna bottom navigation. Griglia, filtri, viewer,
 * dettaglio e composer restano quelli condivisi di REV-PROF-12.
 *
 * Di conseguenza la griglia non ha l'icona Salvati sulle thumbnail — "Salva"
 * vive nel dettaglio contenuto, dov'è sempre stato — mentre all'owner resta
 * la CTA di pubblicazione.
 *
 * Da qui non si raggiungono Articoli, importazione, bozze o programmazione:
 * appartengono a HOM-06.2 e non vengono duplicati in Modifica profilo.
 *
 * Il modulo non salva niente di suo e non ha una CTA sticky: pubblicare è il
 * composer, e il conteggio dell'hub si riallinea al ritorno perché la query
 * del conteggio viene invalidata qui.
 */
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import type { MediaContentItem } from "../../career/MediaTabContent";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { MediaContentComposer } from "../../media/MediaContentComposer";
import { MediaMediaTab } from "../../media/MediaMediaTab";
import { dedupeMediaContentById } from "../../media/media-master-profile";
import {
  MEDIA_TAB_PAGE_SIZE,
  fetchMediaProfileMediaPage,
} from "../../media/media-media-tab-service";
import { mediaContentCountQueryKey } from "../MediaProfileEditHubScreen";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  useCompleteProfileQuery,
} from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

const CONTENT_ERROR = "Non è stato possibile caricare i contenuti. Riprova.";

export function MediaContentsScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const queryClient = useQueryClient();
  const data = profileQuery.data;
  const mediaProfileId = data?.profile.id ?? null;

  const [items, setItems] = useState<MediaContentItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!mediaProfileId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const page = await fetchMediaProfileMediaPage(
        mediaProfileId,
        userId,
        0,
        MEDIA_TAB_PAGE_SIZE,
      );
      setItems(page.items);
      setOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch {
      setErrorMessage(CONTENT_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [mediaProfileId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!mediaProfileId || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const page = await fetchMediaProfileMediaPage(
        mediaProfileId,
        userId,
        offset,
        MEDIA_TAB_PAGE_SIZE,
      );
      // Una pubblicazione durante lo scroll può far riconsegnare la coda
      // della pagina precedente: la lista non deve mostrarla due volte.
      setItems((current) => dedupeMediaContentById([...current, ...page.items]));
      setOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch {
      setErrorMessage(CONTENT_ERROR);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, mediaProfileId, offset, userId]);

  return (
    <ProfileEditScaffold
      onBack={() => router.back()}
      testID="media-profile-edit-contents"
      title="Media e contenuti"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="media-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={MEDIA_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="media-edit-error"
        />
      ) : null}

      {data && mediaProfileId ? (
        <>
          <MediaMediaTab
            entityName={data.mediaProfile?.entity_name ?? null}
            errorMessage={errorMessage}
            hasMore={hasMore}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            isOwner
            items={items}
            onAddContentPress={() => setComposerOpen(true)}
            onLoadMore={() => void loadMore()}
            /* Dettaglio canonico del contenuto, lo stesso del feed. */
            onOpenContent={(ref) =>
              router.push({
                params: { id: ref.postId, type: ref.contentType },
                pathname: "/content/[type]/[id]",
              })
            }
            onRetry={() => void load()}
            viewerMode="owner"
          />

          <MediaContentComposer
            entityName={data.mediaProfile?.entity_name ?? "Redazione"}
            mediaProfileId={mediaProfileId}
            onClose={() => setComposerOpen(false)}
            onCreated={() => {
              setComposerOpen(false);
              void load();
              // Il riepilogo dell'hub è un conteggio a parte: va riletto,
              // altrimenti resta indietro di un contenuto.
              void queryClient.invalidateQueries({
                queryKey: mediaContentCountQueryKey(userId),
              });
            }}
            userId={userId}
            visible={isComposerOpen}
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}
