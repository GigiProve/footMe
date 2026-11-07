/**
 * Proiezione professionale del candidato (§16, §17, §18).
 *
 * Trasforma il profilo canonico — lo **stesso** `CompleteProfessionalProfile`
 * che apre il Master Profile — nei tre blocchi del dettaglio: profilo
 * professionale, carriera in sintesi, esperienze recenti.
 *
 * Due vincoli di §16 decidono la forma di questo file:
 *
 *   · «Recupera identità, foto, ruolo corrente, società attuale, qualifiche,
 *     carriera e statistiche dai profili canonici, tramite servizi/read model
 *     condivisi» — da cui l'input, che non è una copia e non è un secondo
 *     profilo;
 *   · «Non implementare una seconda somma diversa sul client» (§18) — da cui
 *     `buildPlayerCareerView` e `buildCareerView`, che sono *la* somma: qui
 *     non si addiziona niente, si legge il loro risultato.
 *
 * E uno di §16 decide cosa **non** c'è: nessun ramo restituisce `0` o una
 * stringa vuota per un dato mancante. «Zero è mostrabile solo come valore
 * effettivo. Una metrica assente o privata non diventa zero.»
 */
import {
  buildCareerView,
  type CareerEntryLike,
  type CoachCareerView,
} from "../../profiles/career/coach-career-model";
import {
  buildPlayerCareerView,
  type CareerStat,
  type PlayerCareerView,
} from "../../profiles/career/player-career-model";
import { parseDirectorCareerEntries } from "../../profiles/career/director-career-model";
import type { CompleteProfessionalProfile } from "../../profiles/profile-service";
import { summarizeList } from "../../profiles/profile-display-helpers";
import { formatSpecialization } from "../../profiles/profile-edit-helpers";
import {
  getPlayerPositionLabel,
  getPreferredFootLabel,
  SENIOR_CATEGORY_OPTIONS,
  toPlayerExperienceForm,
} from "../../profiles/player-sports";
import type { ApplicantProfileType } from "./applications-types";

export type CandidateStat = {
  key: "appearances" | "goals" | "assists";
  label: string;
  value: CareerStat;
};

export type CandidateExperience = {
  /** §18: l'id canonico, così il tap può aprire la carriera con l'ancora. */
  id: string;
  clubName: string;
  logoUrl: string;
  /** «Serie D · 2025/26» oppure «Allenatore · 2025/26». */
  line: string;
};

export type CandidateInsight = {
  /** §18: «5 stagioni · Categoria più alta Serie C», o solo la prima metà. */
  careerSummary: string | null;
  experiences: CandidateExperience[];
  /** §15: «Profilo sportivo» per il calciatore, «Profilo professionale» per gli altri. */
  professionalEyebrow: string;
  /** Fino a due righe di valori. Vuoto = la sezione non si disegna. */
  professionalLines: string[];
  /**
   * `null` per Allenatore, Staff e Dirigente: §17 — «nessun blocco
   * Presenze/Gol/Assist». Non è una lista vuota, è l'assenza del blocco.
   */
  stats: CandidateStat[] | null;
};

/**
 * §18: «Mostra normalmente le ultime 2 esperienze, fino a 3 quando utile e
 * compatibile con il pattern.» Il mockup ne mostra due; la terza entra solo
 * quando la seconda non basta a dire qualcosa (una carriera di tre tappe
 * brevi), e quel giudizio non ha una regola nel documento. Due è il default
 * e il massimo è tre.
 */
const MAX_EXPERIENCES = 2;

/**
 * §18: «La categoria più alta è calcolabile solo con la tassonomia e
 * l'ordinamento di dominio validi per il percorso pertinente. Non confrontare
 * stringhe, ID numerici arbitrari o competizioni incomparabili. Se il dato
 * non è affidabile, omettilo.»
 *
 * L'unica gerarchia di dominio esistente è quella delle categorie senior
 * (`SENIOR_CATEGORY_OPTIONS`, ordinata dalla più alta alla più bassa). Le
 * categorie giovanili sono una scala parallela e non comparabile: una
 * stagione in Primavera non è "più alta" né "più bassa" della Promozione, e
 * mescolarle produrrebbe un primato inventato. Restano quindi fuori dal
 * confronto — se nessuna stagione ha una categoria senior riconosciuta, il
 * dato non viene mostrato.
 */
const SENIOR_RANK = new Map(
  SENIOR_CATEGORY_OPTIONS.map((option, index) => [option.value, index]),
);

export function highestSeniorCategory(
  categories: readonly (string | null | undefined)[],
): string | null {
  let best: { label: string; rank: number } | null = null;

  for (const raw of categories) {
    const label = raw?.trim();

    if (!label) {
      continue;
    }

    const rank = SENIOR_RANK.get(label);

    if (rank === undefined) {
      continue;
    }

    if (!best || rank < best.rank) {
      best = { label, rank };
    }
  }

  return best?.label ?? null;
}

function seasonsLabel(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return count === 1 ? "1 stagione" : `${count} stagioni`;
}

function joinSummary(parts: (string | null)[]): string | null {
  const kept = parts.filter((part): part is string => Boolean(part));

  return kept.length > 0 ? kept.join(" · ") : null;
}

// ---------------------------------------------------------------------------
// Calciatore
// ---------------------------------------------------------------------------

function playerInsight(
  profile: CompleteProfessionalProfile,
  view: PlayerCareerView,
): CandidateInsight {
  const player = profile.playerProfile;

  const positions = [
    player?.primary_position ?? null,
    ...(player?.secondary_positions ?? []),
  ]
    .flatMap((value) => {
      const trimmed = typeof value === "string" ? value.trim() : "";

      return trimmed ? [getPlayerPositionLabel(trimmed, trimmed)] : [];
    })
    /* §17: «ruolo principale e secondari effettivi, senza duplicazioni». Un
       secondario uguale al principale è un dato ridondante, non un secondo
       ruolo. */
    .filter((label, index, all) => all.indexOf(label) === index);

  const physical = [
    player?.preferred_foot ? getPreferredFootLabel(player.preferred_foot, "") : "",
    typeof player?.height_cm === "number" && player.height_cm > 0
      ? `${player.height_cm} cm`
      : "",
  ].filter(Boolean);

  /* Tutte le stagioni di tutte le esperienze: la deduplicazione per chiave
     è già quella del modello canonico, qui si contano le chiavi distinte. */
  const seasonKeys = new Set(
    view.experiences.flatMap((experience) =>
      experience.seasons.map((season) => season.seasonKey),
    ),
  );
  const categories = view.experiences.flatMap((experience) =>
    experience.seasons.map((season) => season.category),
  );
  const highest = highestSeniorCategory(categories);

  return {
    careerSummary: joinSummary([
      seasonsLabel(seasonKeys.size),
      highest ? `Categoria più alta ${highest}` : null,
    ]),
    experiences: view.experiences.slice(0, MAX_EXPERIENCES).map((experience) => ({
      clubName: experience.clubName,
      id: experience.id,
      line: joinSummary([
        experience.seasons[0]?.category || null,
        experience.seasons[0]?.label || null,
      ]) ?? experience.periodLabel,
      logoUrl: experience.logoUrl,
    })),
    professionalEyebrow: "Profilo sportivo",
    professionalLines: [positions.join(" · "), physical.join(" · ")].filter(Boolean),
    stats: [
      { key: "appearances", label: "Presenze", value: view.totals.appearances },
      { key: "goals", label: "Gol", value: view.totals.goals },
      { key: "assists", label: "Assist", value: view.totals.assists },
    ],
  };
}

// ---------------------------------------------------------------------------
// Allenatore, Staff, Dirigente — stesso modello di carriera
// ---------------------------------------------------------------------------

/**
 * §17: «categorie o ambiti allenati». Il mockup di Luca dice «Prima squadra e
 * giovanili», che non è una categoria ma la **presenza** delle due scale.
 * Derivarla dalle categorie effettive è l'unico modo onesto: non esiste un
 * campo che la dichiari, e inventarne uno significherebbe affermare un ambito
 * che la carriera non testimonia.
 */
function scopeLabel(categories: readonly string[]): string | null {
  const senior = categories.some((category) => SENIOR_RANK.has(category.trim()));
  const youth = categories.some(
    (category) => category.trim().length > 0 && !SENIOR_RANK.has(category.trim()),
  );

  if (senior && youth) {
    return "Prima squadra e giovanili";
  }

  if (senior) {
    return "Prima squadra";
  }

  return youth ? "Settore giovanile" : null;
}

function careerExperiences(view: CoachCareerView): CandidateExperience[] {
  return view.experiences.slice(0, MAX_EXPERIENCES).map((experience) => ({
    clubName: experience.clubName,
    id: experience.id,
    /* §17 per Allenatore e Staff: il ruolo di quella esperienza, non una
       categoria — è ciò che distingue «Allenatore · 2025/26» da «Vice
       allenatore · 2024/25» nello screen 08. */
    line: joinSummary([
      experience.seasons[0]?.role || experience.role || null,
      experience.seasons[0]?.label || null,
    ]) ?? experience.periodLabel,
    logoUrl: experience.logoUrl,
  }));
}

function coachInsight(
  profile: CompleteProfessionalProfile,
  view: CoachCareerView,
): CandidateInsight {
  const coach = profile.coachProfile;
  const categories = view.experiences.flatMap((experience) =>
    experience.seasons.map((season) => season.category),
  );

  return {
    careerSummary: joinSummary([
      seasonsLabel(view.seasonCount),
      scopeLabel(categories),
    ]),
    experiences: careerExperiences(view),
    professionalEyebrow: "Profilo professionale",
    professionalLines: [
      coach?.primary_role?.trim() || "Allenatore",
      /* §17: «abilitazione/qualifica resa disponibile dal profilo». Se il
         profilo non la pubblica, la riga sparisce — §17 vieta di inventare
         un check di verifica su una qualifica dichiarata. */
      summarizeList(coach?.licenses ?? []) ?? "",
    ].filter(Boolean),
    stats: null,
  };
}

function staffInsight(
  profile: CompleteProfessionalProfile,
  view: CoachCareerView,
): CandidateInsight {
  const staff = profile.staffProfile;
  const specialization = staff?.specialization
    ? formatSpecialization(staff.specialization)
    : null;
  const qualification = summarizeList(staff?.certifications ?? []);

  return {
    careerSummary: seasonsLabel(view.seasonCount),
    experiences: careerExperiences(view),
    professionalEyebrow: "Profilo professionale",
    professionalLines: [
      specialization && specialization !== "Da definire"
        ? specialization
        : staff?.primary_staff_role?.trim() || "",
      qualification ? `Qualifica: ${qualification}` : "",
    ].filter(Boolean),
    stats: null,
  };
}

function directorInsight(
  profile: CompleteProfessionalProfile,
  view: CoachCareerView,
): CandidateInsight {
  const director = profile.directorProfile;

  return {
    careerSummary: seasonsLabel(view.seasonCount),
    experiences: careerExperiences(view),
    professionalEyebrow: "Profilo professionale",
    professionalLines: [
      director?.primary_role?.trim() || "Direzione sportiva",
      summarizeList(director?.experience_categories ?? []) ?? "",
    ].filter(Boolean),
    /* §17: «nessun campo tecnico da calciatore». */
    stats: null,
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * §15: «Usa un solo container e un solo modello di dettaglio, con contenuti
 * professionali adattivi.» Il dispatch è qui, in una funzione pura, non in
 * quattro schermate: §15 vieta di «creare quattro schermate indipendenti per
 * ruolo».
 *
 * `role` arriva dal dettaglio della candidatura (cioè dal profilo corrente),
 * non dal `target_role` della Position: §17 — «Se il profilo corrente cambia
 * tipo, preserva la distinzione tra professione attuale e profilo ricercato
 * dalla Position storica.»
 */
export function buildCandidateInsight(input: {
  now?: Date;
  profile: CompleteProfessionalProfile;
  role: ApplicantProfileType | null;
}): CandidateInsight {
  const { now, profile } = input;
  const role = input.role ?? (profile.profile.role as ApplicantProfileType | null);

  if (role === "player") {
    return playerInsight(
      profile,
      buildPlayerCareerView(
        (profile.playerCareerEntries ?? []).map((entry) =>
          toPlayerExperienceForm(entry),
        ),
      ),
    );
  }

  if (role === "coach") {
    return coachInsight(
      profile,
      buildCareerView(
        (profile.coachCareerEntries ?? []) as unknown as CareerEntryLike[],
        { now },
      ),
    );
  }

  if (role === "staff") {
    return staffInsight(
      profile,
      buildCareerView(
        (profile.staffCareerEntries ?? []) as unknown as CareerEntryLike[],
        { now },
      ),
    );
  }

  if (role === "director") {
    return directorInsight(
      profile,
      buildCareerView(
        /* Il prefisso dà un id stabile alle righe jsonb, che non ne
           hanno uno proprio: senza, due periodi nello stesso club
           collasserebbero in una sola esperienza (REV-PROF-10). */
        parseDirectorCareerEntries(
          profile.directorProfile?.career_entries ?? [],
          "director-career",
        ),
        { now },
      ),
    );
  }

  /* Tipologia non prevista da §17: l'identità resta leggibile, i blocchi
     professionali tacciono. §16 — «Se mancano solo informazioni facoltative,
     ometti naturalmente la sottosezione»; non si blocca l'accesso a una
     candidatura altrimenti valida. */
  return {
    careerSummary: null,
    experiences: [],
    professionalEyebrow: "Profilo professionale",
    professionalLines: [],
    stats: null,
  };
}
