/**
 * Query key dei media di carriera (HOM-15 §174–§175): lo stato Like/Salva
 * dipende da chi guarda (liked_as, is_saved, blocchi) e dal profilo guardato.
 */

export const CAREER_MEDIA_QK = {
  interactions: (viewerId: string, ownerProfileId: string) =>
    ["career-media-interactions", viewerId, ownerProfileId] as const,
};
