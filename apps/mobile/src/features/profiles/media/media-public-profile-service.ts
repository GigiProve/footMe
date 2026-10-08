/**
 * Payload pubblico del Master Profile Media/Creator (REV-PROF-21).
 *
 * Una sola porta, `fetch_public_media_profile`, per Owner e Visitor: la
 * differenza non sta nella query ma nelle capabilities che la RPC calcola.
 * Il client non compone più l'identità editoriale da sei select sparse, e
 * soprattutto non ricade più sui dati personali del proprietario — nome,
 * città, regione, avatar — per riempire i campi vuoti.
 *
 * Quello che non è elencato in `MediaPublicEntity` non esiste per questa
 * superficie, perché non esce dalla RPC.
 */
import { supabase } from "../../../lib/supabase";
import {
  normalizeMediaCapabilities,
  type MediaProfileCapabilities,
} from "./media-master-profile";

export type MediaPublicChannel = {
  channelType: string;
  /** Etichetta curata dalla realtà, quando esiste. Altrimenti la deriva la UI. */
  label: string | null;
  url: string;
};

export type MediaPublicEntity = {
  affiliationType: string | null;
  channels: MediaPublicChannel[];
  contentTypes: string[];
  /**
   * REV-PROF-22: modalità della copertura geografica. `null` finché la
   * realtà non l'ha dichiarata — non equivale a "Tutta Italia".
   */
  coverageScope: "ITALY" | "REGIONS" | "PROVINCES" | null;
  coverUrl: string | null;
  coveredCompetitions: string[];
  /** REV-PROF-22: zone, quando `coverageScope` è `PROVINCES`. */
  coveredProvinces: string[];
  coveredTeams: string[];
  coveredTerritories: string[];
  coveredTopics: string[];
  creatorType: string | null;
  creatorTypeOther: string | null;
  editorialType: string | null;
  entityName: string | null;
  focusAreas: string[];
  isVerified: boolean;
  logoUrl: string | null;
  profileId: string;
  shortDescription: string | null;
  /** Già filtrato dal backend: presente solo se pubblico. La UI lo valida ancora. */
  websiteUrl: string | null;
};

export type MediaPublicProfile = {
  capabilities: MediaProfileCapabilities;
  entity: MediaPublicEntity;
  isFollowing: boolean;
  mode: "owner" | "visitor";
};

/**
 * `null` quando il profilo non esiste, non è un Media/Creator, o c'è un
 * blocco reciproco. La schermata distingue questo caso da un errore di rete:
 * il primo è "Profilo non disponibile", il secondo ha un Riprova.
 */
export async function fetchPublicMediaProfile(
  profileId: string,
): Promise<MediaPublicProfile | null> {
  const { data, error } = await supabase.rpc("fetch_public_media_profile", {
    p_profile_id: profileId,
  });

  if (error) {
    throw error;
  }

  const payload = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | null
    | undefined;

  if (!payload) {
    return null;
  }

  const entity = (payload.entity ?? {}) as Record<string, unknown>;
  const viewer = (payload.viewer ?? {}) as Record<string, unknown>;

  return {
    capabilities: normalizeMediaCapabilities(viewer),
    entity: {
      affiliationType: text(entity.affiliation_type),
      channels: normalizeChannels(entity.channels),
      contentTypes: stringArray(entity.content_types),
      coverageScope: coverageScope(entity.coverage_scope),
      coverUrl: text(entity.cover_url),
      coveredCompetitions: stringArray(entity.covered_competitions),
      coveredProvinces: stringArray(entity.covered_provinces),
      coveredTeams: stringArray(entity.covered_teams),
      coveredTerritories: stringArray(entity.covered_territories),
      coveredTopics: stringArray(entity.covered_topics),
      creatorType: text(entity.creator_type),
      creatorTypeOther: text(entity.creator_type_other),
      editorialType: text(entity.editorial_type),
      entityName: text(entity.entity_name),
      focusAreas: stringArray(entity.focus_areas),
      isVerified: entity.verification_status === "verified",
      logoUrl: text(entity.logo_url),
      profileId: text(entity.profile_id) ?? profileId,
      shortDescription: text(entity.short_description),
      websiteUrl: text(entity.website_url),
    },
    isFollowing: viewer.is_following === true,
    mode: viewer.mode === "owner" ? "owner" : "visitor",
  };
}

function normalizeChannels(value: unknown): MediaPublicChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const url = text(row.url);
      const channelType = text(row.channel_type);

      return url && channelType
        ? { channelType, label: text(row.label), url }
        : null;
    })
    .filter((channel): channel is MediaPublicChannel => channel !== null);
}

function coverageScope(
  value: unknown,
): "ITALY" | "REGIONS" | "PROVINCES" | null {
  return value === "ITALY" || value === "REGIONS" || value === "PROVINCES"
    ? value
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function text(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}
