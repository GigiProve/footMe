/**
 * Registro delle otto voci dell'hub Modifica profilo Allenatore
 * (REV-PROF-05, schermata 1), in due macroaree.
 *
 * Ordine, titoli e sottotitoli fissi sono quelli del mockup; i sottotitoli
 * dinamici vivono in `coach-hub-summaries`. La rotta è l'unico punto in cui si
 * dichiara dove sta ogni modulo: "Carriera" punta a REV-PROF-04 e "Media e
 * contenuti" alla gestione condivisa, perché nessuno dei due viene
 * riscritto qui.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";

import type { CoachEditSectionId } from "./coach-hub-summaries";

export type CoachEditSection = {
  icon: keyof typeof Ionicons.glyphMap;
  id: CoachEditSectionId;
  route: Href;
  /** Sottotitolo fisso. Le voci a conteggio lo calcolano dai dati. */
  subtitle?: string;
  title: string;
};

export type CoachEditSectionGroup = {
  sections: readonly CoachEditSection[];
  title: string;
};

export const COACH_EDIT_SECTION_GROUPS: readonly CoachEditSectionGroup[] = [
  {
    sections: [
      {
        icon: "camera-outline",
        id: "personal",
        route: "/profile/coach-edit/personal",
        subtitle: "Foto, copertine e informazioni personali",
        title: "Foto e dati personali",
      },
      {
        icon: "person-outline",
        id: "technical",
        route: "/profile/coach-edit/technical",
        subtitle: "Ruolo, patentino e categorie allenate",
        title: "Profilo allenatore",
      },
      {
        icon: "location-outline",
        id: "opportunities",
        route: "/profile/coach-edit/opportunities",
        subtitle: "Disponibilità e zone",
        title: "Opportunità",
      },
      {
        icon: "git-network-outline",
        id: "philosophy",
        route: "/profile/coach-edit/philosophy",
        subtitle: "Modulo, stile e lingue",
        title: "Filosofia e stile di gioco",
      },
    ],
    title: "Profilo",
  },
  {
    sections: [
      {
        icon: "briefcase-outline",
        id: "career",
        // REV-PROF-04: la carriera ha già il suo gestore, non se ne fa un altro.
        route: "/profile/coach-career",
        title: "Carriera",
      },
      {
        icon: "trophy-outline",
        id: "awards",
        route: "/profile/coach-edit/awards",
        title: "Palmarès",
      },
      {
        icon: "call-outline",
        id: "contacts",
        route: "/profile/coach-edit/contacts",
        title: "Contatti pubblici",
      },
      {
        icon: "play-circle-outline",
        id: "media",
        route: "/profile/coach-edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Percorso e visibilità",
  },
] as const;
