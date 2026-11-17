import { supabase } from "../../lib/supabase";

/**
 * Identità di chi pubblica un contenuto nel dettaglio `/content/[type]/[id]`.
 *
 * HOM-15 §26–§28: l'header del dettaglio è lo stesso del Feed — avatar/logo,
 * nome e verifica PROLINK — quindi qui servono anche logo e verifica, con la
 * stessa regola di `feed_content_index.publisher_is_verified`: Società →
 * `clubs.verification_status`, Media → `media_profiles.verification_status`,
 * persone (Tifosi) → nessuna verifica.
 */
export type ContentPublisher = {
  avatarUrl: string | null;
  isVerified: boolean;
  name: string;
};

/**
 * Nome, logo e verifica di un profilo che pubblica (Media/Creator o Tifoso).
 *
 * I profili Media usano `entity_name` / `logo_url` quando presenti, con
 * fallback su `full_name` / `avatar_url` del profilo — la stessa precedenza di
 * `loadPublisherNames` in media-profile-post-service.ts.
 */
export async function fetchContentPublisher(
  profileId: string,
): Promise<ContentPublisher> {
  const [profileResult, mediaResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", profileId)
      .maybeSingle(),
    supabase
      .from("media_profiles")
      .select("entity_name, logo_url, verification_status")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  const profile = profileResult.data as {
    avatar_url: string | null;
    full_name: string | null;
  } | null;

  // `media_profiles` è assente per i profili non Media: non è un errore.
  const media = mediaResult.error
    ? null
    : (mediaResult.data as {
        entity_name: string | null;
        logo_url: string | null;
        verification_status: string | null;
      } | null);

  const name =
    media?.entity_name?.trim() || profile?.full_name?.trim() || "Profilo ProLink";

  return {
    avatarUrl: media?.logo_url ?? profile?.avatar_url ?? null,
    isVerified: media?.verification_status === "verified",
    name,
  };
}

/**
 * HOM-06.2 §7D: la Società che pubblica, per l'header e per «Condiviso da
 * [Società]» / «Pubblicato da [Società]». Il dettaglio storico di `club_media`
 * non la porta (mostra «Società»). `null` se non leggibile: il chiamante ripiega
 * sul nome che ha già, mai su un nome inventato.
 */
export async function fetchClubPublisher(clubId: string): Promise<ContentPublisher | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select("name, logo_url, verification_status")
    .eq("id", clubId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const club = data as {
    logo_url: string | null;
    name: string | null;
    verification_status: string | null;
  };
  const name = club.name?.trim();

  return name
    ? { avatarUrl: club.logo_url, isVerified: club.verification_status === "verified", name }
    : null;
}
