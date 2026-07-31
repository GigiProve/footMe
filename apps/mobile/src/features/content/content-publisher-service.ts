import { supabase } from "../../lib/supabase";

export type ContentPublisher = {
  avatarUrl: string | null;
  name: string;
};

/**
 * Nome e logo di chi pubblica un contenuto, per le superfici che non li
 * portano già nella loro riga di dettaglio (`media_tribuna_posts` e
 * `fan_media_posts`, aggiunte al dettaglio contenuto da CER-05).
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
      .select("entity_name, logo_url")
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
    : (mediaResult.data as { entity_name: string | null; logo_url: string | null } | null);

  const name =
    media?.entity_name?.trim() || profile?.full_name?.trim() || "Profilo FootMe";

  return { avatarUrl: media?.logo_url ?? profile?.avatar_url ?? null, name };
}
