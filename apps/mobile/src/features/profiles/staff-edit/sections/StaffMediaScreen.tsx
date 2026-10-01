/**
 * Media e contenuti dello Staff tecnico (REV-PROF-08).
 *
 * Nessun sistema Media dedicato: è la stessa schermata del Calciatore e
 * dell'Allenatore, con i tag dello Staff tecnico e la sua tabella di
 * destinazione. Upload, anteprima, evidenza, eliminazione, error handling e
 * conteggi arrivano da lì e non vengono riscritti.
 */
import {
  ProfileMediaEditor,
  type ProfileMediaEditorConfig,
} from "../../edit/sections/ProfileMediaEditor";
import { saveStaffProfileMedia } from "../../profile-service";
import {
  STAFF_MEDIA_TAG_OPTIONS,
  normalizeStaffMediaItems,
  type StaffMediaItemRecord,
} from "../../staff-media";
import { useStaffEditorGuard } from "../use-staff-editor-guard";

const STAFF_MEDIA_CONFIG: ProfileMediaEditorConfig = {
  emptyDescription:
    "Aggiungi foto e video per mostrare il tuo lavoro con la squadra.",
  folder: "staff-media",
  getItems: (data) => normalizeStaffMediaItems(data.staffProfile?.media_items),
  persist: async ({ data, items, profileId }) => {
    const staffProfile = data.staffProfile;

    if (!staffProfile) {
      return;
    }

    await saveStaffProfileMedia({
      mediaItems: items as StaffMediaItemRecord[],
      profileId,
      staffProfile,
    });
  },
  profileType: "staff",
  tagOptions: STAFF_MEDIA_TAG_OPTIONS,
};

export function StaffMediaScreen() {
  const { userId } = useStaffEditorGuard();

  return <ProfileMediaEditor config={STAFF_MEDIA_CONFIG} userId={userId} />;
}
