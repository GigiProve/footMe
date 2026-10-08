/**
 * Registro delle voci dell'hub Modifica profilo Tifoso (REV-PROF-20,
 * schermata 1), in due macroaree.
 *
 * Cinque moduli sotto "Profilo", nell'ordine obbligatorio del mockup, e una
 * sola voce sotto "Contenuti", che punta al modulo Media condiviso: il Tifoso
 * non ha un content manager proprio, e questa task non ne scrive uno.
 *
 * Non esistono voci per contatti pubblici, bio, opportunità o dati
 * professionali: non appartengono al modello Tifoso e non si aggiungono per
 * analogia con gli altri ruoli.
 */
import type {
  ProfileEditHubGroup,
  ProfileEditHubSection,
} from "../edit/ProfileEditHubScreen";

export type FanEditSection = ProfileEditHubSection;
export type FanEditSectionGroup = ProfileEditHubGroup;

export const FAN_EDIT_SECTION_GROUPS: readonly ProfileEditHubGroup[] = [
  {
    sections: [
      {
        icon: "person-outline",
        id: "personal",
        route: "/profile/fan-edit/personal",
        subtitle: "Foto, copertina e informazioni personali",
        title: "Foto e dati personali",
      },
      {
        icon: "shield-outline",
        id: "favoriteClub",
        route: "/profile/fan-edit/favorite-club",
        title: "Squadra del cuore",
      },
      {
        icon: "football-outline",
        id: "interests",
        route: "/profile/fan-edit/interests",
        title: "Interessi calcistici",
      },
      {
        icon: "trophy-outline",
        id: "categories",
        route: "/profile/fan-edit/categories",
        title: "Categorie seguite",
      },
      {
        icon: "location-outline",
        id: "areas",
        route: "/profile/fan-edit/areas",
        title: "Aree di interesse",
      },
    ],
    title: "Profilo",
  },
  {
    sections: [
      {
        icon: "images-outline",
        // Il modulo Media è condiviso (REV-PROF-12): la voce ci porta dentro,
        // non apre una galleria del Tifoso.
        id: "media",
        route: "/profile/fan-edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Contenuti",
  },
] as const;
