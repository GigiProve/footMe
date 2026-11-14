/**
 * Home/Feed: header fisso, tab, due pane.
 *
 * PERCHÉ ENTRAMBI I PANE SONO MONTATI
 *
 * Il §18 chiede che la posizione di scroll sia conservata SEPARATAMENTE per
 * ogni tab. Tenendo entrambe le liste montate e nascondendo l'inattiva con
 * `display: "none"`, la FlatList conserva il proprio offset nativo e il cambio
 * tab ripristina la posizione senza una riga di codice dedicata. Smontarla
 * costringerebbe a riapplicare l'offset a ogni passaggio, con lo scatto visibile
 * che ne consegue.
 *
 * Il pane "Seguiti" viene montato solo al primo accesso alla tab, così il primo
 * disegno della Home paga una lista sola.
 *
 * PERCHÉ NON SI USA `Screen`
 *
 * `src/components/ui/screen.tsx` impone `paddingHorizontal: 20` e
 * `paddingVertical: 24`: un header a tutta larghezza e una lista edge-to-edge
 * non ci stanno dentro. Il componente non va modificato, ci dipendono altre
 * schermate: questa gestisce la propria SafeAreaView.
 *
 * VIDEO (HOM-03)
 *
 * Il controller video è UNO per tutta la Home, condiviso dai due pane tramite il
 * provider: così «un solo video attivo» (§18) vale anche passando da Per te a
 * Seguiti. Il ciclo di vita lo governa da qui, in un punto solo: background
 * dell'app e uscita dalla schermata (cambio sezione, §77–79) via
 * `useFeedVideoLifecycle`; cambio tab Home (§78) con `pause("tab")`. Nessuna
 * ripresa automatica in nessuno dei tre casi (§20, §78).
 */

import { useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, View, type FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { colors } from "../../../theme/tokens";
import { articleNewHref } from "../../article-editor/article-routes";
import { useSession } from "../../auth/use-session";
import { useUnreadNotificationsCount } from "../../notifications/use-unread-notifications-count";
import {
  composerOriginForScope,
  launcherExtraActionsForRole,
  OPEN_POSITION_HREF,
} from "../../post-composer/composer-entry";
import { composerHref } from "../../post-composer/composer-routes";
import { CreateContentSheet } from "../../publishing/components/CreateContentSheet";
import { trackPublishing } from "../../publishing/publishing-analytics";
import { publishingKeys } from "../../publishing/publishing-keys";
import {
  draftsEntrySubtitle,
  draftsEntryTab,
  launcherRows,
  resolveLauncherMode,
  type LauncherRowId,
} from "../../publishing/publishing-presentation";
import { draftsHref } from "../../publishing/publishing-routes";
import { fetchContentLauncher } from "../../publishing/publishing-service";
import { trackFeed } from "../feed-analytics";
import { saveFeedCacheMeta } from "../feed-cache";
import { createFeedVideoController } from "../feed-video-controller";
import type { FeedItem, FeedScope } from "../feed-types";
import { useFeedCache } from "../use-feed";
import { FeedVideoProvider } from "../use-feed-video";
import { useFeedVideoLifecycle } from "../use-feed-video-lifecycle";
import { FeedHeader } from "./FeedHeader";
import { FeedPane } from "./FeedPane";
import { FeedTabs } from "./FeedTabs";

export function FeedScreen() {
  const router = useRouter();
  const { profile, session } = useSession();
  const profileId = profile?.id ?? "";
  // Stessa chiave utente del composer e della lista Bozze: le invalidazioni dopo ogni azione le raggiungono tutte.
  const publishingUserId = session?.user.id ?? profile?.id ?? "";
  const unreadCount = useUnreadNotificationsCount();

  const [scope, setScope] = useState<FeedScope>("per_te");
  const [hasVisitedSeguiti, setHasVisitedSeguiti] = useState(false);
  const [isLauncherOpen, setLauncherOpen] = useState(false);
  const [videoController] = useState(createFeedVideoController);
  useFeedVideoLifecycle(videoController);

  const perTeListRef = useRef<FlatList<FeedItem> | null>(null);
  const seguitiListRef = useRef<FlatList<FeedItem> | null>(null);

  const cacheQuery = useFeedCache(profileId);
  const cache = cacheQuery.data;

  // §27: la tab attiva è parte dello stato ripristinabile. Si applica una volta
  // sola, quando la cache arriva, per non sovrascrivere una scelta dell'utente.
  const restoredScopeRef = useRef(false);
  useEffect(() => {
    if (restoredScopeRef.current || !cacheQuery.isFetched) {
      return;
    }
    restoredScopeRef.current = true;

    if (cache?.activeScope === "seguiti") {
      setScope("seguiti");
      setHasVisitedSeguiti(true);
    }
  }, [cache?.activeScope, cacheQuery.isFetched]);

  useEffect(() => {
    trackFeed({ name: "home_open" });
  }, []);

  useEffect(() => {
    trackFeed({ name: "feed_tab_open", scope });
  }, [scope]);

  function handleScopeChange(next: FeedScope) {
    if (next === scope) {
      return;
    }

    // §78: cambiando tab il video attivo va in pausa e al ritorno non riparte.
    videoController.pause("tab");
    setScope(next);
    if (next === "seguiti") {
      setHasVisitedSeguiti(true);
    }

    if (profileId) {
      void saveFeedCacheMeta(profileId, { activeScope: next });
    }
  }

  // HOM-06.1 §2–3, HOM-06.2 §4–§10: il «+» non è «+ = Post» né «+ = Crea contenuto»:
  // dipende dalle azioni realmente disponibili (`fetch_content_launcher`). Solo Post e
  // nulla in sospeso → composer diretto, un tap (§5); altrimenti il foglio «Crea
  // contenuto» (§6). Senza lo stato (rete) il Post resta un tap, come HOM-06.1.
  // L'origin è la tab da cui si apre, così a pubblicazione fatta si torna qui (§123).
  const composerOrigin = composerOriginForScope(scope);
  const extraActions = launcherExtraActionsForRole(profile?.role);

  const launcherQuery = useQuery({
    enabled: publishingUserId.length > 0,
    queryFn: fetchContentLauncher,
    queryKey: publishingKeys.launcher(publishingUserId),
    // Un errore non blocca il «+»: senza stato il Post resta un tap (`resolveLauncherMode`).
    retry: 1,
    staleTime: 30_000,
  });
  const launcher = launcherQuery.data ?? null;

  function handleOpenComposer() {
    if (resolveLauncherMode(launcher, extraActions) === "direct_post") {
      router.push(composerHref({ origin: composerOrigin }) as never);
      return;
    }

    trackPublishing({
      canPublishArticle: launcher?.canPublishArticle ?? false,
      name: "content_launcher_open",
      pending: launcher ? launcher.draftsCount + launcher.scheduledCount + launcher.failedCount : 0,
    });
    setLauncherOpen(true);
  }

  function handleLauncherSelect(row: LauncherRowId) {
    setLauncherOpen(false);

    switch (row) {
      case "post":
        trackPublishing({ name: "post_selected" });
        router.push(composerHref({ origin: composerOrigin }) as never);
        break;
      case "article":
        trackPublishing({ name: "article_selected" });
        router.push(articleNewHref(composerOrigin) as never);
        break;
      case "drafts":
        trackPublishing({ from: "launcher", name: "drafts_scheduled_open" });
        router.push(draftsHref(draftsEntryTab(launcher)) as never);
        break;
      case "open_position":
        // Azione già offerta dal vecchio menu (modulo legacy, destinazione invariata).
        router.push(OPEN_POSITION_HREF as never);
        break;
    }
  }

  return (
    <FeedVideoProvider controller={videoController}>
      <SafeAreaView style={styles.root}>
        <FeedHeader
          hasUnreadNotifications={unreadCount > 0}
          onOpenComposer={handleOpenComposer}
          onOpenNotifications={() => router.push("/notifications")}
        />

        <FeedTabs active={scope} onChange={handleScopeChange} />

        <View style={styles.panes}>
          <View style={[styles.pane, scope !== "per_te" ? styles.paneHidden : null]}>
            <FeedPane
              cache={cache}
              isActive={scope === "per_te"}
              isCacheReady={cacheQuery.isFetched}
              listRef={perTeListRef}
              profileId={profileId}
              scope="per_te"
            />
          </View>

          {hasVisitedSeguiti ? (
            <View style={[styles.pane, scope !== "seguiti" ? styles.paneHidden : null]}>
              <FeedPane
                cache={cache}
                isActive={scope === "seguiti"}
                isCacheReady={cacheQuery.isFetched}
                listRef={seguitiListRef}
                profileId={profileId}
                scope="seguiti"
              />
            </View>
          ) : null}
        </View>

        <CreateContentSheet
          draftsSubtitle={draftsEntrySubtitle(launcher)}
          onClose={() => setLauncherOpen(false)}
          onSelect={handleLauncherSelect}
          rows={launcherRows(launcher, extraActions)}
          visible={isLauncherOpen}
        />
      </SafeAreaView>
    </FeedVideoProvider>
  );
}

const styles = StyleSheet.create({
  pane: {
    ...StyleSheet.absoluteFill,
  },
  paneHidden: {
    display: "none",
  },
  panes: {
    flex: 1,
    position: "relative",
  },
  // HOM-01.1 §9: superficie aperta bianca come header e tab, senza stacco.
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
