/**
 * Registro delle otto sezioni dell'editor (§F.1), in due macroaree.
 *
 * L'ordine e i titoli sono quelli della task; la rotta è l'unico punto in cui
 * si dichiara dove vive ogni sezione.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";

import type { PlayerEditSectionId } from "./player-hub-summaries";

export type PlayerEditSection = {
  icon: keyof typeof Ionicons.glyphMap;
  id: PlayerEditSectionId;
  route: Href;
  title: string;
};

export type PlayerEditSectionGroup = {
  sections: readonly PlayerEditSection[];
  title: string;
};

export const PLAYER_EDIT_SECTION_GROUPS: readonly PlayerEditSectionGroup[] = [
  {
    sections: [
      {
        icon: "camera-outline",
        id: "photo",
        route: "/profile/edit/photo",
        title: "Foto e identità",
      },
      {
        icon: "person-outline",
        id: "personal",
        route: "/profile/edit/personal",
        title: "Dati personali",
      },
      {
        icon: "football-outline",
        id: "technical",
        route: "/profile/edit/technical",
        title: "Profilo tecnico",
      },
      {
        icon: "location-outline",
        id: "opportunities",
        route: "/profile/edit/opportunities",
        title: "Opportunità",
      },
      {
        icon: "shield-outline",
        id: "situation",
        route: "/profile/edit/situation",
        title: "Situazione attuale",
      },
    ],
    title: "Profilo",
  },
  {
    sections: [
      {
        icon: "briefcase-outline",
        id: "career",
        route: "/profile/edit/career",
        title: "Carriera e statistiche",
      },
      {
        icon: "trophy-outline",
        id: "awards",
        route: "/profile/edit/awards",
        title: "Palmarès",
      },
      {
        icon: "call-outline",
        id: "contacts",
        route: "/profile/edit/contacts",
        title: "Contatti pubblici",
      },
      {
        icon: "play-circle-outline",
        id: "media",
        route: "/profile/edit/media",
        title: "Media e contenuti",
      },
    ],
    title: "Percorso e visibilità",
  },
] as const;
