/**
 * Registro delle voci dell'hub Modifica profilo Media/Creator (REV-PROF-22,
 * Screen 1), in tre macroaree.
 *
 * Sei moduli sotto "Profilo pubblico", nell'ordine obbligatorio del mockup;
 * una voce sotto "Account", che è l'unica riga self-only dell'hub; una voce
 * sotto "Contenuti", che punta al modulo Media condiviso.
 *
 * Non esistono — e non si aggiungono per analogia con altri ruoli o con la
 * Home — voci per Articoli, "Scrivi su PROLINK", "Collega da un link",
 * "Incolla un articolo", bozze, programmati, Tribuna editor o Post: la
 * creazione editoriale appartiene a HOM-06.2, e Modifica profilo non è un
 * CMS.
 */
import type {
  ProfileEditHubGroup,
  ProfileEditHubSection,
} from "../edit/ProfileEditHubScreen";

export type MediaEditSection = ProfileEditHubSection;
export type MediaEditSectionGroup = ProfileEditHubGroup;

export const MEDIA_EDIT_SECTION_GROUPS: readonly ProfileEditHubGroup[] = [
  {
    sections: [
      {
        icon: "id-card-outline",
        id: "identity",
        route: "/profile/media-edit/identity",
        subtitle: "Logo, copertina, nome e tipo",
        title: "Identità editoriale",
      },
      {
        icon: "document-text-outline",
        id: "presentation",
        route: "/profile/media-edit/presentation",
        title: "Presentazione",
      },
      {
        icon: "globe-outline",
        id: "coverage",
        route: "/profile/media-edit/coverage",
        title: "Copertura",
      },
      {
        icon: "albums-outline",
        id: "contentTypes",
        route: "/profile/media-edit/content-types",
        title: "Tipi di contenuto",
      },
      {
        icon: "location-outline",
        id: "areas",
        route: "/profile/media-edit/areas",
        title: "Aree coperte",
      },
      {
        icon: "link-outline",
        id: "channels",
        route: "/profile/media-edit/channels",
        title: "Canali ufficiali",
      },
    ],
    title: "Profilo pubblico",
  },
  {
    sections: [
      {
        /*
          L'unica riga che non riguarda la realtà editoriale. Il riepilogo
          dice a chi sono visibili quei dati; il motivo per cui non escono è
          che il serializer pubblico non li proietta, non che la riga lo
          annuncia.
        */
        icon: "lock-closed-outline",
        id: "personal",
        route: "/profile/media-edit/personal",
        subtitle: "Visibili solo a te",
        title: "Dati personali",
      },
    ],
    title: "Account",
  },
  {
    sections: [
      {
        icon: "play-circle-outline",
        // Il modulo Media è condiviso (REV-PROF-12): la voce ci porta dentro,
        // non apre una galleria del Media/Creator.
        id: "media",
        route: "/profile/media-edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Contenuti",
  },
] as const;
