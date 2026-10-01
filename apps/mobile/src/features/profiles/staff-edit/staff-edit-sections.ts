/**
 * Registro delle sette voci dell'hub Modifica profilo Staff tecnico
 * (REV-PROF-08, schermata 1), in due macroaree.
 *
 * Ordine, titoli e sottotitoli fissi sono quelli del mockup; i sottotitoli
 * dinamici vivono in `staff-hub-summaries`. La rotta è l'unico punto in cui si
 * dichiara dove sta ogni modulo: "Carriera" e "Percorsi aggiuntivi" puntano a
 * REV-PROF-07 e "Media e contenuti" alla gestione condivisa, perché nessuno
 * dei tre viene riscritto qui.
 *
 * Non esiste una voce "Situazione attuale": società, ruolo e categoria attuali
 * si leggono dalla carriera e non si digitano da nessuna parte.
 */
import type {
  ProfileEditHubGroup,
  ProfileEditHubSection,
} from "../edit/ProfileEditHubScreen";

export type StaffEditSection = ProfileEditHubSection;
export type StaffEditSectionGroup = ProfileEditHubGroup;

export const STAFF_EDIT_SECTION_GROUPS: readonly ProfileEditHubGroup[] = [
  {
    sections: [
      {
        icon: "camera-outline",
        id: "personal",
        route: "/profile/staff-edit/personal",
        subtitle: "Foto, copertina e informazioni personali",
        title: "Foto e dati personali",
      },
      {
        icon: "person-outline",
        id: "professional",
        route: "/profile/staff-edit/professional",
        subtitle: "Ruoli e ruolo principale",
        title: "Profilo professionale",
      },
      {
        icon: "location-outline",
        id: "opportunities",
        route: "/profile/staff-edit/opportunities",
        subtitle: "Disponibilità e zone",
        title: "Opportunità",
      },
    ],
    title: "Profilo",
  },
  {
    sections: [
      {
        icon: "briefcase-outline",
        // REV-PROF-07: la carriera ha già il suo gestore, non se ne fa un altro.
        id: "career",
        route: "/profile/staff-career",
        title: "Carriera",
      },
      {
        icon: "walk-outline",
        // Stesso gestore, aperto direttamente sulla schermata Percorsi
        // aggiuntivi: nessun secondo hub, nessuna versione semplificata.
        id: "paths",
        route: "/profile/staff-career?section=paths",
        title: "Percorsi aggiuntivi",
      },
      {
        icon: "call-outline",
        id: "contacts",
        route: "/profile/staff-edit/contacts",
        title: "Contatti pubblici",
      },
      {
        icon: "play-circle-outline",
        id: "media",
        route: "/profile/staff-edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Percorso e visibilità",
  },
] as const;
