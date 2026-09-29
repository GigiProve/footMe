/**
 * Media e contenuti dell'Allenatore (REV-PROF-05).
 *
 * Nessun sistema Media dedicato: è la stessa schermata del Calciatore, con i
 * tag dell'Allenatore e la sua tabella di destinazione. Upload, anteprima,
 * evidenza, eliminazione, error handling e conteggi arrivano da lì e non
 * vengono riscritti.
 */
import {
  COACH_MEDIA_TAG_OPTIONS,
  normalizeCoachMediaItems,
  type CoachMediaItemRecord,
} from "../../coach-media";
import { saveCoachProfileMedia } from "../../profile-service";
import {
  ProfileMediaEditor,
  type ProfileMediaEditorConfig,
} from "../../edit/sections/ProfileMediaEditor";
import { useCoachEditorGuard } from "../use-coach-editor-guard";

const COACH_MEDIA_CONFIG: ProfileMediaEditorConfig = {
  emptyDescription: "Aggiungi foto e video per mostrare il tuo lavoro sul campo.",
  folder: "coach-media",
  getItems: (data) => normalizeCoachMediaItems(data.coachProfile?.media_items),
  persist: async ({ data, items, profileId }) => {
    const coachProfile = data.coachProfile;

    if (!coachProfile) {
      return;
    }

    await saveCoachProfileMedia({
      coachProfile,
      mediaItems: items as CoachMediaItemRecord[],
      profileId,
    });
  },
  profileType: "coach",
  tagOptions: COACH_MEDIA_TAG_OPTIONS,
};

export function CoachMediaScreen() {
  const { userId } = useCoachEditorGuard();

  return <ProfileMediaEditor config={COACH_MEDIA_CONFIG} userId={userId} />;
}
