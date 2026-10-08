/**
 * Registro delle dieci voci dell'hub Modifica profilo Procuratore
 * (REV-PROF-16, schermata 1), in due macroaree.
 *
 * Ordine, titoli e sottotitoli fissi sono quelli del mockup; i sottotitoli a
 * conteggio vivono in `agent-hub-summaries`. La rotta è l'unico punto in cui
 * si dichiara dove sta ogni modulo: "Assistiti" porta ai soli assistiti in
 * evidenza — il portfolio resta di REV-PROF-14 — mentre "Carriera" e
 * "Percorsi aggiuntivi" puntano a REV-PROF-15 e "Media e contenuti" alla
 * gestione condivisa. Nessuno dei tre viene riscritto qui.
 *
 * Non esiste una voce "Situazione attuale": agenzia, ruolo e stato
 * dell'incarico si leggono dalla carriera e non si digitano da nessuna parte.
 */
import type {
  ProfileEditHubGroup,
  ProfileEditHubSection,
} from "../edit/ProfileEditHubScreen";

export type AgentEditSection = ProfileEditHubSection;
export type AgentEditSectionGroup = ProfileEditHubGroup;

export const AGENT_EDIT_SECTION_GROUPS: readonly ProfileEditHubGroup[] = [
  {
    sections: [
      {
        icon: "camera-outline",
        id: "personal",
        route: "/profile/agent-edit/personal",
        subtitle: "Foto, copertina e informazioni personali",
        title: "Foto e dati personali",
      },
      {
        icon: "person-outline",
        id: "professional",
        route: "/profile/agent-edit/professional",
        subtitle: "Abilitazione e dati professionali",
        title: "Profilo professionale",
      },
      {
        icon: "pricetags-outline",
        id: "activities",
        route: "/profile/agent-edit/activities",
        subtitle: "Competenze e ambiti",
        title: "Attività e mercati",
      },
      {
        icon: "location-outline",
        id: "opportunities",
        route: "/profile/agent-edit/opportunities",
        subtitle: "Disponibilità e area operativa",
        title: "Opportunità",
      },
      {
        icon: "globe-outline",
        id: "bio",
        route: "/profile/agent-edit/bio",
        subtitle: "Presentazione e lingue",
        title: "Bio e lingue",
      },
    ],
    title: "Profilo",
  },
  {
    sections: [
      {
        icon: "people-outline",
        // Solo la scelta di chi va in evidenza: creare, invitare, approvare o
        // eliminare un assistito resta nella Gestione assistiti.
        id: "assistiti",
        route: "/profile/agent-edit/assistiti",
        title: "Assistiti",
      },
      {
        icon: "briefcase-outline",
        // REV-PROF-15: la carriera ha già il suo gestore, non se ne fa un altro.
        id: "career",
        route: "/profile/agent-career",
        title: "Carriera",
      },
      {
        icon: "walk-outline",
        // Stesso gestore, aperto direttamente sulla schermata Percorsi
        // aggiuntivi: nessun secondo hub, nessuna versione semplificata.
        id: "paths",
        route: "/profile/agent-career?section=paths",
        title: "Percorsi aggiuntivi",
      },
      {
        icon: "call-outline",
        id: "contacts",
        route: "/profile/agent-edit/contacts",
        title: "Contatti pubblici",
      },
      {
        icon: "play-circle-outline",
        id: "media",
        route: "/profile/agent-edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Percorso e visibilità",
  },
] as const;
