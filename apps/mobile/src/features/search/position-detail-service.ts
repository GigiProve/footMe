import { supabase } from "../../lib/supabase";

/**
 * Stato dell'azione per l'utente corrente (DAS-REV-03 §15, §17).
 *
 * Calcolato da `public.dashboard_position_action_state`, la stessa funzione
 * che decide se promuovere il reminder in Dashboard: due definizioni di
 * eligibility divergerebbero al primo cambiamento, e §17 vieta di scegliere
 * la CTA arbitrariamente.
 */
export type PositionActionState = {
  action_type: "apply" | "register" | "none";
  already_applied: boolean;
  can_apply: boolean;
  deadline_at: string | null;
  /**
   * Il giorno civile della scadenza, nel fuso della società (DAS-REV-18 §8).
   *
   * Server-owned. Formattare `deadline_at` mostrerebbe il **giorno
   * successivo**, perché il cutoff memorizzato è esclusivo: l'inizio del
   * giorno dopo quello scelto.
   */
  deadline_date: string | null;
  deadline_timezone: string | null;
  is_open: boolean;
  /** Il lifecycle reale dell'annuncio: `published` o `closed` (§32). */
  status: string | null;
  /**
   * `deadline_passed` e `position_closed` sono motivi **distinti**
   * (DAS-REV-18 §32): il primo è una PUBLISHED che ha smesso di ricevere,
   * il secondo una ricerca conclusa. Gli screen 11 e 12 dicono cose
   * diverse, e il renderer non deve indovinare quale sia il caso.
   */
  reason: string | null;
};

export type PositionDetail = {
  action: PositionActionState;
  ad_id: string;
  title: string;
  description: string;
  club_id: string | null;
  club_name: string | null;
  club_logo_url: string | null;
  team_name: string | null;
  category: string | null;
  region: string | null;
  compensation_summary: string | null;
  /**
   * Data locale legacy, senza istante né fuso. Resta per Cerca (CER-01/04) e
   * **non** è il cutoff: §14 vieta di assumerne silenziosamente mezzanotte o
   * fine giornata. Il cutoff autorevole è `action.deadline_at`.
   */
  deadline: string | null;
  published_at: string | null;
  is_saved: boolean;
};

type AdDetailRow = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  region: string | null;
  compensation_summary: string | null;
  deadline: string | null;
  published_at: string | null;
  club_id: string | null;
  clubs: { id: string; logo_url: string | null; name: string | null } | null;
  club_teams: { name: string | null } | null;
};

export async function fetchPositionDetail(
  profileId: string,
  adId: string,
): Promise<PositionDetail | null> {
  const [
    { data: adData, error: adError },
    { data: savedData, error: savedError },
    { data: actionData, error: actionError },
  ] = await Promise.all([
      supabase
        .from("recruiting_ads")
        .select(
          "id, title, description, category, region, compensation_summary, deadline, published_at, club_id, clubs(id, name, logo_url), club_teams(name)",
        )
        .eq("id", adId)
        // DAS-REV-05 §16: «Dettaglio storico disponibile e autorizzato — la
        // row è tappabile e apre il dettaglio Position esistente nella
        // modalità prevista.» Una posizione chiusa resta quindi leggibile;
        // l'eligibility dell'azione la decide comunque
        // `dashboard_position_action_state`, che per una non pubblicata
        // risponde già `action_type: none`, `is_open: false`.
        //
        // Una bozza o una posizione ritirata resta esclusa: è la condizione
        // che rende non navigabile la row storica (`is_navigable`).
        .in("status", ["published", "closed"])
        .maybeSingle(),
      supabase
        .from("saved_ads")
        .select("ad_id")
        .eq("ad_id", adId)
        .eq("profile_id", profileId)
        .maybeSingle(),
      supabase.rpc("dashboard_position_action_state", { p_ad_id: adId }),
    ]);

  if (adError) {
    throw adError;
  }

  if (savedError) {
    throw savedError;
  }

  if (actionError) {
    throw actionError;
  }

  if (!adData) {
    return null;
  }

  const ad = adData as unknown as AdDetailRow;

  return {
    action: (actionData as PositionActionState | null) ?? {
      action_type: "none",
      already_applied: false,
      can_apply: false,
      deadline_at: null,
      deadline_date: null,
      deadline_timezone: null,
      is_open: true,
      reason: null,
      status: null,
    },
    ad_id: ad.id,
    category: ad.category,
    club_id: ad.clubs?.id ?? ad.club_id,
    club_logo_url: ad.clubs?.logo_url ?? null,
    club_name: ad.clubs?.name ?? null,
    compensation_summary: ad.compensation_summary,
    deadline: ad.deadline,
    description: ad.description,
    is_saved: savedData !== null,
    published_at: ad.published_at,
    region: ad.region,
    team_name: ad.club_teams?.name ?? null,
    title: ad.title,
  };
}
