/**
 * Media e contenuti del Tifoso (REV-PROF-20, voce dell'hub).
 *
 * Non è una galleria nuova: è `FanMediaTab`, la stessa superficie Media del
 * Master Profile, dentro la cornice dei moduli di Modifica profilo — app bar,
 * back verso l'hub, nessuna bottom navigation. Griglia, filtri, viewer e
 * pubblicazione restano quelli condivisi, e il composer è quello già in uso
 * per foto e video.
 *
 * REV-PROF-12 è rispettata di conseguenza: la griglia non ha bookmark sulle
 * thumbnail — il "Salva" vive nel dettaglio contenuto — mentre all'owner
 * resta la CTA di pubblicazione.
 *
 * Il modulo non salva niente di suo e non ha una CTA sticky: pubblicare è il
 * composer, e il conteggio dell'hub si riallinea al ritorno perché la query
 * del conteggio viene invalidata qui.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { FanCreateTribunaModal } from "../../fan/fan-composers";
import { FanMediaTab } from "../../fan/FanMediaTab";
import { useFanMediaFeed } from "../../fan/use-fan-media-feed";
import { fanMediaCountQueryKey } from "../FanProfileEditHubScreen";
import {
  FAN_LOAD_ERROR_MESSAGE,
  useCompleteProfileQuery,
} from "../fan-profile-edit-service";
import { useFanEditorGuard } from "../use-fan-editor-guard";

export function FanMediaScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const queryClient = useQueryClient();
  const data = profileQuery.data;

  const [isComposerOpen, setComposerOpen] = useState(false);

  const media = useFanMediaFeed({
    profileId: data?.profile.id ?? "",
    viewerProfileId: userId,
  });

  return (
    <ProfileEditScaffold
      onBack={() => router.back()}
      testID="fan-profile-edit-media"
      title="Media e contenuti"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="fan-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={FAN_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="fan-edit-error"
        />
      ) : null}

      {data && userId ? (
        <>
          <FanMediaTab
            errorMessage={media.errorMessage}
            hasMore={media.hasMore}
            isLoading={media.isLoading}
            isLoadingMore={media.isLoadingMore}
            isOwner
            items={media.items}
            onAddContentPress={() => setComposerOpen(true)}
            onLoadMore={media.loadMore}
            /* Dettaglio canonico del contenuto, lo stesso del feed. */
            onOpenContent={(ref) =>
              router.push({
                params: { id: ref.postId, type: ref.contentType },
                pathname: "/content/[type]/[id]",
              })
            }
            onRetry={media.reload}
            profileName={data.profile.full_name}
            viewerMode="owner"
          />

          <FanCreateTribunaModal
            kind={isComposerOpen ? "photo" : null}
            onClose={() => setComposerOpen(false)}
            onCreated={() => {
              setComposerOpen(false);
              media.reload();
              // Il riepilogo dell'hub è un conteggio a parte: va riletto,
              // altrimenti resta indietro di un contenuto.
              void queryClient.invalidateQueries({
                queryKey: fanMediaCountQueryKey(userId),
              });
            }}
            profileId={data.profile.id}
            publisherName={data.profile.full_name}
            userId={userId}
            visible={isComposerOpen}
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}
