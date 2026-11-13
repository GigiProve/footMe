import { useLocalSearchParams } from "expo-router";

import { parseContentOrigin } from "../../../../src/features/feed/content-routes";
import { ContentInsightsScreen } from "../../../../src/features/content-insights/components/ContentInsightsScreen";
import { parseInsightsContentType } from "../../../../src/features/content-insights/insights-routes";

/**
 * HOM-05: Dettagli e statistiche di un contenuto. Route radice fuori da
 * `(tabs)` (decisione D1: niente bottom nav), a quattro segmenti, quindi non
 * collide con `/content/[type]/[id]`. Tipo o id non validi → stato «non
 * disponibile» dentro la schermata (§65).
 */
export default function ContentInsightsRoute() {
  const { id, origin, type } = useLocalSearchParams<{
    id: string;
    origin?: string;
    type: string;
  }>();

  return (
    <ContentInsightsScreen
      contentType={parseInsightsContentType(type)}
      origin={parseContentOrigin(origin)}
      postId={id ?? ""}
    />
  );
}
