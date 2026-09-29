/**
 * Media e contenuti del Calciatore (§O).
 *
 * La schermata vera è `ProfileMediaEditor`, condivisa con l'Allenatore
 * (REV-PROF-05): qui restano solo le tre cose che appartengono al Calciatore —
 * dove sono salvati i contenuti, come si scrivono e quali tag esistono.
 */
import { normalizePlayerMediaItems, PLAYER_MEDIA_TAG_OPTIONS, type PlayerMediaItemRecord } from "../../player-media";
import { savePlayerProfileMedia } from "../../profile-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import {
  ProfileMediaEditor,
  type ProfileMediaEditorConfig,
} from "./ProfileMediaEditor";

const PLAYER_MEDIA_CONFIG: ProfileMediaEditorConfig = {
  emptyDescription: "Aggiungi foto e video del tuo percorso sportivo.",
  folder: "player-media",
  getItems: (data) =>
    normalizePlayerMediaItems(
      data.playerProfile?.media_items,
      data.playerProfile?.media_urls,
    ),
  persist: async ({ data, items, profileId }) => {
    const playerProfile = data.playerProfile;

    if (!playerProfile) {
      return;
    }

    await savePlayerProfileMedia({
      mediaItems: items as PlayerMediaItemRecord[],
      playerProfile,
      profileId,
    });
  },
  profileType: "player",
  tagOptions: PLAYER_MEDIA_TAG_OPTIONS,
};

export function ProfileMediaScreen() {
  const { userId } = usePlayerEditorGuard();

  return <ProfileMediaEditor config={PLAYER_MEDIA_CONFIG} userId={userId} />;
}
