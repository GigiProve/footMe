/**
 * «Collega da un link» (HOM-06.2 §7F–§7M): modalità EXTERNAL_LINK.
 */
import { useLocalSearchParams } from "expo-router";

import { ArticleLinkScreen } from "../../src/features/article-editor/components/ArticleLinkScreen";

export default function ArticleComposeLinkRoute() {
  const search = useLocalSearchParams();

  return <ArticleLinkScreen search={search} />;
}
