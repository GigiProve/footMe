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
 */

import { useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, View, type FlatList } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "../../../theme/tokens";
import { AppSidebar } from "../../../ui/sidebar";
import { useSession } from "../../auth/use-session";
import { useUnreadNotificationsCount } from "../../notifications/use-unread-notifications-count";
import { trackFeed } from "../feed-analytics";
import { saveFeedCacheMeta } from "../feed-cache";
import type { FeedItem, FeedScope } from "../feed-types";
import { useFeedCache } from "../use-feed";
import { FeedComposerEntry } from "./FeedComposerEntry";
import { FeedHeader } from "./FeedHeader";
import { FeedPane } from "./FeedPane";
import { FeedTabs } from "./FeedTabs";

export function FeedScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";
  const unreadCount = useUnreadNotificationsCount();

  const [scope, setScope] = useState<FeedScope>("per_te");
  const [hasVisitedSeguiti, setHasVisitedSeguiti] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isComposerOpen, setComposerOpen] = useState(false);

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

    setScope(next);
    if (next === "seguiti") {
      setHasVisitedSeguiti(true);
    }

    if (profileId) {
      void saveFeedCacheMeta(profileId, { activeScope: next });
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <FeedHeader
        hasUnreadNotifications={unreadCount > 0}
        onOpenComposer={() => setComposerOpen(true)}
        onOpenMenu={() => setSidebarOpen(true)}
        onOpenNotifications={() => router.push("/notifications")}
      />

      <FeedTabs active={scope} onChange={handleScopeChange} />

      <View style={styles.panes}>
        <View style={[styles.pane, scope !== "per_te" ? styles.paneHidden : null]}>
          <FeedPane
            cache={cache}
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
              isCacheReady={cacheQuery.isFetched}
              listRef={seguitiListRef}
              profileId={profileId}
              scope="seguiti"
            />
          </View>
        ) : null}
      </View>

      <AppSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <FeedComposerEntry
        onClose={() => setComposerOpen(false)}
        onNavigate={(href) => {
          setComposerOpen(false);
          router.push(href as never);
        }}
        role={profile?.role}
        visible={isComposerOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pane: {
    ...StyleSheet.absoluteFillObject,
  },
  paneHidden: {
    display: "none",
  },
  panes: {
    flex: 1,
    position: "relative",
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
