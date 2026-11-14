/**
 * «Come vuoi creare l'articolo?» (HOM-06.2 §7A). `?origin=` dice da dove si apre,
 * `?identity=` suggerisce l'identity di partenza (§21–§23).
 */
import { useLocalSearchParams } from "expo-router";

import { ArticleModeScreen } from "../../src/features/article-editor/components/ArticleModeScreen";

export default function ArticleComposeRoute() {
  const search = useLocalSearchParams();

  return <ArticleModeScreen search={search} />;
}
