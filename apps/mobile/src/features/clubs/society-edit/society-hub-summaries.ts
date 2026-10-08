/**
 * Sottotitoli dinamici dell'hub Società (REV-PROF-18 §"Contatori hub").
 *
 * Tre regole, e sono il motivo per cui questo è un modulo puro e non una
 * manciata di template dentro la schermata:
 *
 * 1. singolare e plurale non sono un dettaglio: "1 squadra" e "2 squadre"
 *    compaiono nello stesso posto e con gli stessi dati;
 * 2. un contatore che non si è caricato mostra "—", mai 0: zero è
 *    un'informazione, l'assenza di informazione è un'altra cosa;
 * 3. i contatti visibili si contano con la stessa regola del payload
 *    pubblico, quella di `countVisibleContacts`.
 */
import type { ProfileEditSectionKey } from "../../profiles/profile-analytics";
import {
  countVisibleContacts,
  type SocietyContactKey,
  type SocietyContactsDraft,
} from "./society-edit-rules";
import type { SocietyProfileEditor } from "./society-edit-types";

/** Contatore non disponibile. Non è uno zero e non va mostrato come tale. */
export const SOCIETY_COUNT_PLACEHOLDER = "—";

export function formatSocietyCount(
  count: number | null | undefined,
  singular: string,
  plural: string,
): string {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return SOCIETY_COUNT_PLACEHOLDER;
  }

  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function buildContactsDraftFromClub(
  club: SocietyProfileEditor["club"],
): SocietyContactsDraft {
  const values: Record<SocietyContactKey, string> = {
    email: club.clubEmail ?? "",
    facebook: club.facebook ?? "",
    instagram: club.instagram ?? "",
    phone: club.clubPhone ?? "",
    website: club.websiteUrl ?? "",
  };

  return {
    values,
    visibility: {
      email: club.showClubEmail,
      facebook: club.showFacebook,
      instagram: club.showInstagram,
      phone: club.showClubPhone,
      website: club.showWebsite,
    },
  };
}

/**
 * Sottotitolo di una voce dell'hub. `undefined` lascia in piedi il
 * sottotitolo fisso dichiarato nel registro delle sezioni.
 */
export function buildSocietySectionSummary(
  sectionId: ProfileEditSectionKey,
  data: SocietyProfileEditor,
): string | undefined {
  switch (sectionId) {
    case "contacts":
      return formatSocietyCount(
        countVisibleContacts(buildContactsDraftFromClub(data.club)),
        "contatto visibile",
        "contatti visibili",
      );
    case "teams":
      return formatSocietyCount(data.counts.teams, "squadra", "squadre");
    case "affiliates":
      return formatSocietyCount(
        data.counts.affiliates,
        "collegamento",
        "collegamenti",
      );
    case "positions":
      return formatSocietyCount(
        data.counts.positions,
        "posizione aperta",
        "posizioni aperte",
      );
    case "media":
      return formatSocietyCount(data.counts.media, "contenuto", "contenuti");
    default:
      return undefined;
  }
}
