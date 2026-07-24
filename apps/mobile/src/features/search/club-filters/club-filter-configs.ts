import type { ClubTipologia } from "./club-filter-types";

export type ClubFilterSectionId =
  | "tipologia"
  | "categoria"
  | "zona"
  | "struttura"
  | "opportunita"
  | "relazione";

export const CLUB_FILTER_MODAL_TITLE = "Filtri società";

export const CLUB_FILTER_SECTIONS: { id: ClubFilterSectionId; title: string }[] = [
  { id: "tipologia", title: "Tipologia" },
  { id: "categoria", title: "Categoria" },
  { id: "zona", title: "Zona" },
  { id: "struttura", title: "Struttura sportiva" },
  { id: "opportunita", title: "Opportunità" },
  { id: "relazione", title: "Relazione personale" },
];

export const CLUB_TIPOLOGIA_OPTIONS: { label: string; value: ClubTipologia }[] = [
  { label: "Tutte", value: "all" },
  { label: "Società principali", value: "club" },
  { label: "Squadre del club", value: "team" },
  { label: "Società affiliate", value: "affiliate" },
];

export const CLUB_CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: "Serie C", value: "Serie C" },
  { label: "Serie D", value: "Serie D" },
  { label: "Eccellenza", value: "Eccellenza" },
  { label: "Promozione", value: "Promozione" },
  { label: "Prima Categoria", value: "Prima Categoria" },
  { label: "Seconda Categoria", value: "Seconda Categoria" },
  { label: "Terza Categoria", value: "Terza Categoria" },
  { label: "Settore giovanile", value: "Settore giovanile" },
  { label: "Altre categorie", value: "Altre categorie" },
];

export const CLUB_STRUCTURE_OPTIONS: {
  label: string;
  value: keyof import("./club-filter-types").ClubStructureState;
}[] = [
  { label: "Prima squadra", value: "senior" },
  { label: "Settore giovanile", value: "youth" },
  { label: "Squadre del club", value: "teams" },
  { label: "Società affiliate", value: "affiliates" },
];

export const CLUB_OPPORTUNITY_OPTIONS: {
  label: string;
  value: keyof import("./club-filter-types").ClubOpportunitiesState;
}[] = [
  { label: "Con posizioni aperte", value: "openPositions" },
  { label: "Posizioni per calciatori", value: "forPlayers" },
  { label: "Posizioni per allenatori", value: "forCoaches" },
  { label: "Posizioni per staff", value: "forStaff" },
];

export const CLUB_RELATION_OPTIONS: {
  label: string;
  value: keyof import("./club-filter-types").ClubRelationState;
}[] = [
  { label: "Società seguite", value: "followed" },
  { label: "Società salvate", value: "saved" },
];
