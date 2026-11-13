/**
 * Nuovo post (HOM-06.1 §2, §5, §6). `?origin=` dice da dove si apre (§5);
 * `?identity=` suggerisce l'identity di partenza (§21–24).
 */
import { useLocalSearchParams } from "expo-router";

import { PostComposerScreen } from "../../src/features/post-composer/components/PostComposerScreen";

export default function PostComposeRoute() {
  const search = useLocalSearchParams();

  return <PostComposerScreen kind="create" search={search} />;
}
