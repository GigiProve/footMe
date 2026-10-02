/**
 * Registro delle nove voci dell'hub Modifica profilo Dirigente
 * (REV-PROF-11, schermata 1), in due macroaree.
 *
 * Ordine, titoli e sottotitoli fissi sono quelli del mockup; i sottotitoli a
 * conteggio vivono in `director-hub-summaries`. La rotta è l'unico punto in
 * cui si dichiara dove sta ogni modulo: "Carriera" e "Percorsi aggiuntivi"
 * puntano a REV-PROF-10 e "Media e contenuti" alla gestione condivisa, perché
 * nessuno dei tre viene riscritto qui.
 *
 * Non esiste una voce "Situazione attuale": società, ruolo e categoria
 * attuali si leggono dalla carriera e non si digitano da nessuna parte.
 * Non esistono nemmeno "Salvati" e "Seguiti", che la task esclude
 * esplicitamente dall'hub.
 */
import type {
  ProfileEditHubGroup,
  ProfileEditHubSection,
} from "../edit/ProfileEditHubScreen";

export type DirectorEditSection = ProfileEditHubSection;
export type DirectorEditSectionGroup = ProfileEditHubGroup;

export const DIRECTOR_EDIT_SECTION_GROUPS: readonly ProfileEditHubGroup[] = [
  {
    sections: [
      {
        icon: "camera-outline",
        id: "personal",
        route: "/profile/director-edit/personal",
        subtitle: "Foto, copertina e informazioni personali",
        title: "Foto e dati personali",
      },
      {
        icon: "person-outline",
        id: "professional",
        route: "/profile/director-edit/professional",
        subtitle: "Ruoli e ruolo principale",
        title: "Profilo professionale",
      },
      {
        icon: "disc-outline",
        id: "responsibilities",
        route: "/profile/director-edit/responsibilities",
        subtitle: "Competenze e ambito principale",
        title: "Responsabilità e focus",
      },
      {
        icon: "location-outline",
        id: "opportunities",
        route: "/profile/director-edit/opportunities",
        subtitle: "Disponibilità e area operativa",
        title: "Opportunità",
      },
      {
        icon: "globe-outline",
        id: "bio",
        route: "/profile/director-edit/bio",
        subtitle: "Presentazione e lingue",
        title: "Bio e lingue",
      },
    ],
    title: "Profilo",
  },
  {
    sections: [
      {
        icon: "briefcase-outline",
        // REV-PROF-10: la carriera ha già il suo gestore, non se ne fa un altro.
        id: "career",
        route: "/profile/director-career",
        title: "Carriera",
      },
      {
        icon: "walk-outline",
        // Stesso gestore, aperto direttamente sulla schermata Percorsi
        // aggiuntivi: nessun secondo hub, nessuna versione semplificata.
        id: "paths",
        route: "/profile/director-career?section=paths",
        title: "Percorsi aggiuntivi",
      },
      {
        icon: "call-outline",
        id: "contacts",
        route: "/profile/director-edit/contacts",
        title: "Contatti pubblici",
      },
      {
        icon: "play-circle-outline",
        id: "media",
        route: "/profile/director-edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Percorso e visibilità",
  },
] as const;
