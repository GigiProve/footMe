/**
 * Riapertura per riferimento (HOM-06.2 §147, §200, §217): carica il contenuto e
 * sostituisce questa route con lo schermo del suo formato e della sua modalità.
 */
import { useLocalSearchParams } from "expo-router";

import { ArticleOpenScreen } from "../../src/features/article-editor/components/ArticleOpenScreen";

export default function ArticleComposeOpenRoute() {
  const search = useLocalSearchParams();

  return <ArticleOpenScreen search={search} />;
}
