/**
 * Riepiloghi dinamici delle righe dell'hub "Modifica profilo" (§F.2).
 *
 * Modulo puro: nessun accesso a rete, nessun componente. Le regole difficili
 * stanno tutte qui, dove si possono provare:
 *
 * - il conteggio della Carriera è il numero di **esperienze**, non di stagioni;
 * - nessun enum tecnico, nessun `null`, nessun `ALL_ITALY` arriva a schermo;
 * - un valore mancante produce un invito a completare, mai una stringa vuota.
 */
import { buildPlayerCareerView } from "../career/player-career-model";
import { buildPublicContacts } from "../master/PublicContactsList";
import { normalizePlayerMediaItems } from "../player-media";
import {
  getPlayerPositionLabel,
  getPlayerPositionLabels,
  toPlayerExperienceForm,
} from "../player-sports";
import {
  buildAvailabilityZonesLabel,
  formatContractStatus,
} from "../profile-display-helpers";
import type { CompleteProfessionalProfile } from "../profile-service";

const MISSING = "Da completare";

function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Elenca ciò che è davvero compilato, con la stessa copy dello Screen Master
 * quando la sezione è completa.
 */
function buildFilledSummary(filled: string[]): string {
  if (filled.length === 0) {
    return MISSING;
  }

  const sentence =
    filled.length === 1
      ? filled[0]
      : `${filled.slice(0, -1).join(", ")} e ${filled[filled.length - 1]}`;

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** "Foto profilo e copertina". */
export function buildPhotoSummary(data: CompleteProfessionalProfile): string {
  const filled: string[] = [];

  if (data.profile.avatar_url) {
    filled.push("foto profilo");
  }

  if (data.profile.cover_url) {
    filled.push("copertina");
  }

  return buildFilledSummary(filled);
}

/** "Nascita, nazionalità e residenza". */
export function buildPersonalSummary(
  data: CompleteProfessionalProfile,
): string {
  const filled: string[] = [];

  if (data.profile.birth_date) {
    filled.push("nascita");
  }

  if (data.profile.nationality) {
    filled.push("nazionalità");
  }

  if (data.profile.residence ?? data.profile.city) {
    filled.push("residenza");
  }

  return buildFilledSummary(filled);
}

/** "Attaccante · Ala destra". Il ruolo secondario è opzionale. */
export function buildTechnicalSummary(
  data: CompleteProfessionalProfile,
): string {
  const primary = data.playerProfile?.primary_position;

  if (!primary) {
    return MISSING;
  }

  const primaryLabel = getPlayerPositionLabel(primary, MISSING);
  // §F.2 / header (profile-edit-helpers.ts:805-807): sui dati storici il
  // ruolo secondario può coincidere col principale (es. entrambi "striker").
  // Si confronta sull'etichetta tradotta, non sul codice, per restare
  // coerente con l'header che usa la stessa regola.
  const secondaryLabel = getPlayerPositionLabels(
    data.playerProfile?.secondary_positions,
  ).find((label) => label !== primaryLabel);

  return secondaryLabel ? `${primaryLabel} · ${secondaryLabel}` : primaryLabel;
}

/**
 * "Disponibile · Tutta Italia" / "Disponibile · Lazio, Sicilia" /
 * "Non disponibile al trasferimento".
 *
 * Quando la disponibilità è spenta i territori restano salvati ma non vengono
 * nominati: il riepilogo dice solo che non si è disponibili (§J.2).
 */
export function buildOpportunitiesSummary(
  data: CompleteProfessionalProfile,
): string {
  const player = data.playerProfile;
  // Allineato al Master Profile (career/PlayerDetailsTab.tsx:52-53): i
  // profili storici possono avere solo `is_open_to_transfer` valorizzato,
  // senza il campo più recente `willing_to_change_club`. Guardare un solo
  // campo faceva dire "Non disponibile" nell'hub mentre il profilo pubblico
  // mostrava "Disponibile".
  const isOpenToTransfer =
    data.profile.is_open_to_transfer || player?.willing_to_change_club;

  if (!isOpenToTransfer || !player) {
    return "Non disponibile al trasferimento";
  }

  const zones = buildAvailabilityZonesLabel(
    player.availability_type,
    player.transfer_regions,
    player.transfer_provinces,
  );

  return zones ? `Disponibile · ${zones}` : "Disponibile";
}

/**
 * "ASD Romano Prodi · Sotto contratto", derivato dalla Carriera (§K.1).
 *
 * `now` è iniettabile perché "esperienza corrente" dipende dalla stagione in
 * corso: senza, il risultato cambierebbe col passare del tempo.
 */
export function buildCurrentSituationSummary(
  data: CompleteProfessionalProfile,
  now?: Date,
): string {
  const current = buildPlayerCareerExperiences(data, now).find(
    (experience) => experience.isCurrent,
  );
  const contract = formatContractStatus(data.playerProfile?.contract_status);

  if (!current) {
    return contract ?? "Nessuna esperienza attuale";
  }

  return contract ? `${current.clubName} · ${contract}` : current.clubName;
}

/** Numero di **esperienze**, mai di stagioni (§L). */
export function buildCareerSummary(data: CompleteProfessionalProfile): string {
  const count = buildPlayerCareerExperiences(data).length;

  return count === 0
    ? "Nessuna esperienza"
    : pluralize(count, "esperienza", "esperienze");
}

export function buildAwardsSummary(data: CompleteProfessionalProfile): string {
  const count = data.playerPalmares.length;

  return count === 0
    ? "Nessun riconoscimento"
    : pluralize(count, "riconoscimento", "riconoscimenti");
}

/** Conta i contatti effettivamente pubblici, non quelli salvati (§N.4). */
export function buildPublicContactsSummary(
  data: CompleteProfessionalProfile,
): string {
  const count = buildPublicContacts(data.userContacts).length;

  return count === 0
    ? "Nessun contatto visibile"
    : pluralize(count, "contatto visibile", "contatti visibili");
}

export function buildMediaSummary(data: CompleteProfessionalProfile): string {
  const count = normalizePlayerMediaItems(
    data.playerProfile?.media_items,
    data.playerProfile?.media_urls,
  ).length;

  return count === 0 ? "Nessun contenuto" : pluralize(count, "contenuto", "contenuti");
}

function buildPlayerCareerExperiences(
  data: CompleteProfessionalProfile,
  now?: Date,
) {
  return buildPlayerCareerView(
    data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
    now ? { now } : {},
  ).experiences;
}

export type PlayerEditSectionId =
  | "photo"
  | "personal"
  | "technical"
  | "opportunities"
  | "situation"
  | "career"
  | "awards"
  | "contacts"
  | "media";

const SUMMARY_BUILDERS: Record<
  PlayerEditSectionId,
  (data: CompleteProfessionalProfile) => string
> = {
  awards: buildAwardsSummary,
  career: buildCareerSummary,
  contacts: buildPublicContactsSummary,
  media: buildMediaSummary,
  opportunities: buildOpportunitiesSummary,
  personal: buildPersonalSummary,
  photo: buildPhotoSummary,
  situation: buildCurrentSituationSummary,
  technical: buildTechnicalSummary,
};

export function buildSectionSummary(
  sectionId: PlayerEditSectionId,
  data: CompleteProfessionalProfile,
): string {
  return SUMMARY_BUILDERS[sectionId](data);
}
