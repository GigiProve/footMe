/**
 * Salvataggio per sezione della Modifica profilo Media/Creator (REV-PROF-22).
 *
 * La lettura è `useCompleteProfileQuery`, la stessa query del Master Profile
 * e di tutti gli altri editor: riusarla è ciò che fa comparire una modifica
 * nell'hub e nel profilo senza refetch a catena e senza una seconda copia
 * dei dati.
 *
 * La scrittura **non** passa da `updateCompleteProfessionalProfile`. Quella
 * funzione, per il ruolo `media`, riscrive la riga `media_profiles` intera a
 * partire dal payload dell'onboarding: nome, tipo, logo, descrizione, ambiti,
 * tipi di contenuto e territori insieme. Qui serve l'opposto — cinque insiemi
 * di colonne disgiunti, uno per modulo:
 *
 *   • identità editoriale → entity_name, creator_type, creator_type_other,
 *                           logo_url   (+ profiles.cover_url)
 *   • presentazione       → short_description
 *   • copertura           → focus_areas
 *   • tipi di contenuto   → content_types
 *   • aree coperte        → coverage_scope, covered_territories,
 *                           covered_provinces
 *
 * Nessun insieme nomina una colonna di un altro: salvare la descrizione non
 * può azzerare gli ambiti, e cambiare le aree non può toccare il logo.
 *
 * I **canali ufficiali** non sono su `media_profiles`: vivono su
 * `profile_contacts`, dove li scrive l'onboarding e da dove
 * `get_profile_public_contacts` li filtra con i flag `show_*`. Il loro patch
 * nomina solo le cinque colonne dei canali editoriali e i loro flag: email e
 * LinkedIn, che stanno nella stessa riga, non vengono nominati e quindi non
 * vengono riscritti.
 *
 * I **dati personali** non compaiono affatto: vivono su `profiles` e
 * `profile_private_contacts` e passano dal modulo condiviso, che è
 * account-scoped per costruzione.
 *
 * La `updated_at` letta insieme al profilo torna indietro come condizione
 * della UPDATE su `media_profiles`: se un'altra sessione ha riscritto la riga
 * nel frattempo non viene aggiornata nessuna riga, e il modulo lo dice invece
 * di sovrascrivere in silenzio.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { supabase } from "../../../lib/supabase";
import type { MediaChannelKey } from "../../onboarding/community/media-channels";
import type { MediaCreatorType } from "../../onboarding/community/media-taxonomy";
import type { MediaCoverageScope } from "../media/media-master-profile";
import {
  getCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";

export {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../edit/player-profile-edit-service";

export const MEDIA_CONFLICT_MESSAGE =
  "Il profilo è stato aggiornato da un'altra sessione. Ricarica e riprova.";

export const MEDIA_SAVE_ERROR_MESSAGE =
  "Non è stato possibile salvare le modifiche. Riprova.";

export const MEDIA_LOAD_ERROR_MESSAGE =
  "Non è stato possibile caricare i dati. Riprova.";

export const MEDIA_PERMISSION_REVOKED_MESSAGE =
  "Non hai più i permessi per modificare questo profilo.";

/** Scrittura rifiutata perché la riga è cambiata sotto i piedi. */
export class MediaProfileConflictError extends Error {
  constructor() {
    super(MEDIA_CONFLICT_MESSAGE);
    this.name = "MediaProfileConflictError";
  }
}

export type MediaIdentityPatch = {
  creator_type: MediaCreatorType;
  creator_type_other: string | null;
  entity_name: string;
  logo_url: string | null;
};

export type MediaPresentationPatch = {
  short_description: string | null;
};

export type MediaCoveragePatch = {
  focus_areas: string[];
};

export type MediaContentTypesPatch = {
  content_types: string[];
};

export type MediaAreasPatch = {
  coverage_scope: MediaCoverageScope;
  covered_provinces: string[];
  covered_territories: string[];
};

export type MediaSectionPatch =
  | {
      kind: "identity";
      /**
       * La copertina è l'unico campo dell'identità che non vive su
       * `media_profiles`: il Master Profile la legge da `profiles.cover_url`,
       * ed è lì che va scritta. Viaggia insieme al resto perché insieme viene
       * letta — un logo nuovo con il nome vecchio sarebbe uno stato a metà.
       */
      coverUrl: string | null;
      value: MediaIdentityPatch;
    }
  | { kind: "presentation"; value: MediaPresentationPatch }
  | { kind: "coverage"; value: MediaCoveragePatch }
  | { kind: "contentTypes"; value: MediaContentTypesPatch }
  | { kind: "areas"; value: MediaAreasPatch }
  | {
      kind: "channels";
      values: Record<MediaChannelKey, string>;
      visibility: Record<MediaChannelKey, boolean>;
    };

export type SaveMediaSectionVariables = {
  data: CompleteProfessionalProfile;
  patch: MediaSectionPatch;
};

export async function saveMediaProfileSection(
  profileId: string,
  data: CompleteProfessionalProfile,
  patch: MediaSectionPatch,
): Promise<void> {
  if (patch.kind === "channels") {
    await saveMediaChannels(profileId, patch);
    return;
  }

  if (patch.kind === "identity") {
    /*
      La copertina prima dell'entità: è l'unica scrittura che può fallire per
      un motivo diverso dal conflitto di versione, e farla per prima evita di
      lasciare `media_profiles` aggiornata e `profiles` indietro.
    */
    const { error } = await supabase
      .from("profiles")
      .update({ cover_url: patch.coverUrl })
      .eq("id", profileId);

    if (error) {
      throw error;
    }
  }

  await saveMediaProfileColumns(profileId, data, { ...patch.value });
}

async function saveMediaProfileColumns(
  profileId: string,
  data: CompleteProfessionalProfile,
  columns: Record<string, unknown>,
): Promise<void> {
  const current = data.mediaProfile ?? null;

  /*
    Nessuna riga ancora: può succedere a un profilo creato prima che il ramo
    Media dell'onboarding la scrivesse. Si inserisce, invece di trattarlo
    come un conflitto.
  */
  if (!current) {
    const { error } = await supabase
      .from("media_profiles")
      .insert({ ...columns, profile_id: profileId });

    if (error) {
      throw error;
    }

    return;
  }

  let query = supabase
    .from("media_profiles")
    .update(columns)
    .eq("profile_id", profileId);

  if (current.updated_at) {
    query = query.eq("updated_at", current.updated_at);
  }

  const { data: updated, error } = await query
    .select("profile_id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  /*
    Zero righe aggiornate con la riga che esiste: la `updated_at` non combacia
    più. Non si riprova senza condizione — sarebbe un last-write-wins cieco
    proprio su identità e copertura pubblica.
  */
  if (!updated) {
    throw new MediaProfileConflictError();
  }
}

/**
 * `profile_contacts` è una riga per utente, non per realtà editoriale: un
 * upsert mirato alle sole colonne dei canali lascia intatte email e LinkedIn,
 * che appartengono ad altre superfici.
 *
 * Nessun controllo di versione qui: la riga è account-scoped e il modello
 * attuale ha un solo proprietario per account, quindi non esiste una seconda
 * sessione autorizzata che possa riscriverla in parallelo. Il giorno in cui
 * esisteranno collaboratori, i canali resteranno comunque dell'owner.
 */
async function saveMediaChannels(
  profileId: string,
  patch: Extract<MediaSectionPatch, { kind: "channels" }>,
): Promise<void> {
  const { error } = await supabase.from("profile_contacts").upsert({
    facebook: patch.values.facebook || null,
    instagram: patch.values.instagram || null,
    profile_id: profileId,
    show_facebook: patch.visibility.facebook,
    show_instagram: patch.visibility.instagram,
    show_tiktok: patch.visibility.tiktok,
    show_website: patch.visibility.website,
    show_youtube: patch.visibility.youtube,
    tiktok: patch.values.tiktok || null,
    website: patch.values.website || null,
    youtube: patch.values.youtube || null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Salva una sezione e riscrive la cache condivisa con il profilo riletto:
 * hub, Master Profile owner e tab Info si allineano senza reload manuale.
 */
export function useMediaSectionSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveMediaSectionVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SaveMediaSectionVariables) => {
      await saveMediaProfileSection(data.profile.id, data, patch);

      return getCompleteProfessionalProfile(data.profile.id);
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(
        completeProfileQueryKey(profileId ?? fresh.profile.id),
        fresh,
      );
    },
  });
}

/** Messaggio da mostrare per un errore di salvataggio. */
export function describeMediaSaveError(error: unknown): string {
  if (error instanceof MediaProfileConflictError) {
    return MEDIA_CONFLICT_MESSAGE;
  }

  /*
    Le RLS di `media_profiles` e `profiles` rifiutano la scrittura con un
    errore di policy quando il permesso non c'è più. È un caso diverso da una
    rete che cade, e merita una frase che dica che cosa è successo.
  */
  const code = (error as { code?: string } | null)?.code;

  return code === "42501" || code === "PGRST301"
    ? MEDIA_PERMISSION_REVOKED_MESSAGE
    : MEDIA_SAVE_ERROR_MESSAGE;
}

/**
 * Canali letti dal profilo completo, nella forma che i moduli usano. Vive qui
 * perché hub e Screen 7 devono leggerli allo stesso modo: il conteggio della
 * riga e il contenuto della schermata non possono divergere.
 */
export function readMediaChannelForm(data: CompleteProfessionalProfile): {
  facebook: string;
  instagram: string;
  tiktok: string;
  visibility: Record<MediaChannelKey, boolean>;
  website: string;
  youtube: string;
} {
  const contacts = data.userContacts;

  return {
    facebook: contacts.facebook ?? "",
    instagram: contacts.instagram ?? "",
    tiktok: contacts.tiktok ?? "",
    visibility: {
      facebook: contacts.showFacebook,
      instagram: contacts.showInstagram,
      tiktok: contacts.showTikTok ?? false,
      website: contacts.showWebsite ?? false,
      youtube: contacts.showYouTube ?? false,
    },
    website: contacts.website ?? "",
    youtube: contacts.youtube ?? "",
  };
}

/**
 * Contenuti del modulo Media condiviso: i post `kind = 'media'` pubblicati
 * dalla realtà. È lo stesso insieme che la tab Media del Master Profile
 * mostra, contato invece che paginato.
 */
export async function countMediaProfileContents(
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("media_profile_posts")
    .select("id", { count: "exact", head: true })
    .eq("media_profile_id", profileId)
    .eq("kind", "media")
    .eq("status", "published");

  if (error) {
    throw error;
  }

  return count ?? 0;
}
