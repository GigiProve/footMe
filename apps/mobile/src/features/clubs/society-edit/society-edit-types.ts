/**
 * Modello dell'editor "Modifica profilo Società" (REV-PROF-18).
 *
 * Non è un secondo profilo Società: è la stessa riga `clubs` che alimenta
 * onboarding e Master Profile, letta con i campi che solo il proprietario può
 * vedere — i recapiti spenti e i flag di visibilità — e con i conteggi reali
 * dei flussi collegati.
 *
 * `updatedAt` non è un dato da mostrare: è la chiave con cui il salvataggio
 * dichiara su quale versione ha lavorato, così due amministratori non si
 * sovrascrivono in silenzio.
 */
import type { ClubStructure } from "../../onboarding/club/club-structure";

export type SocietyEditableClub = {
  category: string | null;
  city: string;
  clubColors: string | null;
  clubEmail: string | null;
  clubPhone: string | null;
  clubStructure: ClubStructure;
  country: string | null;
  coverUrl: string | null;
  description: string | null;
  facebook: string | null;
  fieldAddress: string | null;
  foundingYear: number | null;
  headquartersAddress: string | null;
  id: string;
  instagram: string | null;
  logoUrl: string | null;
  name: string;
  province: string | null;
  region: string;
  showClubEmail: boolean;
  showClubPhone: boolean;
  showFacebook: boolean;
  showInstagram: boolean;
  showWebsite: boolean;
  stadium: string | null;
  updatedAt: string | null;
  venueAddressSameAsHeadquarters: boolean;
  verificationStatus: string;
  websiteUrl: string | null;
};

/** Conteggi dei flussi collegati. Reali: l'hub non inventa uno zero. */
export type SocietyEditCounts = {
  affiliates: number;
  media: number;
  positions: number;
  teams: number;
};

/**
 * Stato delle squadre attive. Serve a due cose, entrambe di sola lettura:
 * derivare le categorie giovanili pubbliche e riconoscere una struttura
 * incoerente prima di salvarla.
 */
export type SocietyEditTeamsState = {
  firstTeam: { category: string | null; id: string; name: string } | null;
  hasFirstTeam: boolean;
  hasYouthTeams: boolean;
};

export type SocietyProfileEditor = {
  club: SocietyEditableClub;
  counts: SocietyEditCounts;
  teams: SocietyEditTeamsState;
};

/** Le cinque sezioni che salvano. Gli entry point collegati non ne fanno parte. */
export type SocietyEditSectionId =
  | "contacts"
  | "description"
  | "identity"
  | "sport"
  | "venue";
