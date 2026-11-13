/**
 * Modifica post (HOM-06.1 §143–164). `?type=&id=&origin=&version=` li costruisce
 * `composerEditHref` dal menu di gestione HOM-04.
 */
import { useLocalSearchParams } from "expo-router";

import { PostComposerScreen } from "../../src/features/post-composer/components/PostComposerScreen";

export default function PostComposeEditRoute() {
  const search = useLocalSearchParams();

  return <PostComposerScreen kind="edit" search={search} />;
}
