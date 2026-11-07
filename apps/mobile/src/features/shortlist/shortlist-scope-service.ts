/**
 * Squadre selezionabili come ambito di una lista personalizzata
 * (DAS-REV-24 §22, §25).
 *
 * Non una nuova lettura del dominio Squadre: `club_teams` ha già la sua RLS,
 * che restituisce le squadre della Società consultabili dall'actor. Qui si
 * chiede solo ciò che il form mostra — id, nome e ordinamento — perché
 * «Avoid select("*")» e perché un campo restituito è un campo che prima o
 * poi qualcuno disegna.
 *
 * Le squadre archiviate restano fuori: §25 — «Una creazione CUSTOM … scope
 * autorizzato», e offrire come destinazione una squadra non più operativa
 * creerebbe una lista che nessuno potrà più collocare.
 */
import { supabase } from "../../lib/supabase";

export type ShortlistScopeTeam = {
  id: string;
  name: string;
};

export async function fetchClubTeamOptions(
  clubId: string,
): Promise<ShortlistScopeTeam[]> {
  const { data, error } = await supabase
    .from("club_teams")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "Squadra",
  }));
}
