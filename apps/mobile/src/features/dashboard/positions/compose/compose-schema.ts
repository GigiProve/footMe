/**
 * La configurazione tipizzata dei quattro schemi (DAS-REV-16 §7).
 *
 * §3 chiude la porta all'interpretazione letterale del titolo: «Non
 * introdurre una nuova libreria di form, un motore di espressioni o una
 * nuova infrastruttura perché nel titolo compare "schema-driven". Una
 * configurazione tipizzata condivisa può essere sufficiente.» Questo file è
 * quella configurazione: dati, non codice eseguibile ricevuto dal server.
 *
 * Il server resta autorevole (§7). Qui vive l'ordine dei campi, il widget e
 * la label; la validazione formale è in `compose-presentation.ts` e
 * replica — non sostituisce — `position_publish_blockers`.
 */
import type { PositionProfileType } from "./compose-types";

/** I widget che il client sa rendere. Nessun altro valore è eseguibile. */
export type PositionFieldKind =
  | "ageRange"
  | "availability"
  | "coachQualification"
  | "experienceMulti"
  | "longText"
  | "playerExperience"
  | "playerSituation"
  | "secondaryTeams"
  | "shortText";

export type PositionField = {
  /** Chiave in `details`, o il nome del campo di prima classe. */
  key: string;
  kind: PositionFieldKind;
  label: string;
  /** Limite in caratteri, quando il campo è testuale. */
  limitKey?: "description" | "requirements" | "responsibilities" | "staffQualification";
  /** §7: «Nessun optional diventa obbligatorio perché una schermata è stata
   *  aperta.» Solo la fascia d'età Calciatore è obbligatoria, e solo per
   *  pubblicare. */
  optional: boolean;
  placeholder?: string;
};

export type PositionProfileSchema = {
  /** Etichetta del profilo nel selector dello step 1 (§8). */
  choiceLabel: string;
  fields: PositionField[];
  /** §12: la frase che accompagna una bozza valida senza dettagli. */
  guidance: string | null;
  profileType: PositionProfileType;
  /** Solo il Dirigente può avere un incarico Society-level (§9, §17). */
  supportsSocietyScope: boolean;
};

const DESCRIPTION: PositionField = {
  key: "description",
  kind: "longText",
  label: "Descrizione della posizione",
  limitKey: "description",
  optional: true,
  placeholder: "Descrivi il progetto sportivo…",
};

const REQUIREMENTS: PositionField = {
  key: "requirements",
  kind: "longText",
  label: "Requisiti aggiuntivi",
  limitKey: "requirements",
  optional: true,
  placeholder: "Aggiungi informazioni utili ai candidati…",
};

const AVAILABILITY: PositionField = {
  key: "availability",
  kind: "availability",
  label: "Disponibilità richiesta",
  optional: true,
};

/**
 * §20: «Per incarichi SOCIETY il primo può diventare "Descrivi il progetto e
 * l'incarico…", mantenendo significato e stile.»
 */
export const SOCIETY_DESCRIPTION_PLACEHOLDER = "Descrivi il progetto e l'incarico…";

/**
 * L'ordine dei campi è quello delle sezioni 13, 15, 16 e 17, che lo
 * dettagliano per profilo e che il PNG riproduce negli screen 05, 06, 08 e
 * 10. Non è un dettaglio estetico: il mockup lo mostra identico in tutte le
 * varianti, ed è ciò che rende il composer uno solo.
 */
export const POSITION_SCHEMAS: Record<PositionProfileType, PositionProfileSchema> = {
  /* §13 — l'unico schema con un campo obbligatorio per pubblicare. */
  player: {
    choiceLabel: "Calciatore",
    fields: [
      { key: "ageRange", kind: "ageRange", label: "Fascia d'età", optional: false },
      AVAILABILITY,
      { key: "playerExperience", kind: "playerExperience", label: "Esperienza richiesta", optional: true },
      { key: "playerSituation", kind: "playerSituation", label: "Situazione del calciatore", optional: true },
      DESCRIPTION,
      REQUIREMENTS,
    ],
    guidance: null,
    profileType: "player",
    supportsSocietyScope: false,
  },

  /* §15 — «Nessun dettaglio aggiuntivo obbligatorio». */
  coach: {
    choiceLabel: "Allenatore",
    fields: [
      { key: "secondaryTeams", kind: "secondaryTeams", label: "Altre squadre coinvolte nell'incarico", optional: true },
      { key: "coachQualificationId", kind: "coachQualification", label: "Patentino / qualifica richiesta", optional: true },
      { key: "experience", kind: "experienceMulti", label: "Esperienza richiesta", optional: true },
      AVAILABILITY,
      DESCRIPTION,
      REQUIREMENTS,
    ],
    guidance: null,
    profileType: "coach",
    supportsSocietyScope: false,
  },

  /* §16 — qualifica **testuale**, mai il selector UEFA dell'Allenatore. */
  staff: {
    choiceLabel: "Staff",
    fields: [
      { key: "secondaryTeams", kind: "secondaryTeams", label: "Altre squadre coinvolte nell'incarico", optional: true },
      {
        key: "staffQualification",
        kind: "shortText",
        label: "Qualifica o abilitazione richiesta",
        limitKey: "staffQualification",
        optional: true,
        placeholder: "Es. Corso di data analysis sportiva o equivalente",
      },
      { key: "experience", kind: "experienceMulti", label: "Esperienza richiesta", optional: true },
      AVAILABILITY,
      DESCRIPTION,
      REQUIREMENTS,
    ],
    guidance:
      "Puoi pubblicare le posizioni anche adesso oppure aggiungere altre informazioni utili ai candidati.",
    profileType: "staff",
    supportsSocietyScope: false,
  },

  /* §17 — né fascia d'età, né patentino, né squadre secondarie. */
  director: {
    choiceLabel: "Dirigente",
    fields: [
      {
        key: "responsibilities",
        kind: "longText",
        label: "Aree di responsabilità",
        limitKey: "responsibilities",
        optional: true,
        placeholder: "Descrivi le principali aree di responsabilità previste per l'incarico.",
      },
      { key: "experience", kind: "experienceMulti", label: "Esperienza richiesta", optional: true },
      AVAILABILITY,
      DESCRIPTION,
      REQUIREMENTS,
    ],
    guidance:
      "Puoi pubblicare le posizioni anche adesso oppure aggiungere altre informazioni utili ai candidati.",
    profileType: "director",
    supportsSocietyScope: true,
  },
};

/** L'ordine delle quattro righe dello sheet «Profilo ricercato» (§8). */
export const POSITION_PROFILE_ORDER: PositionProfileType[] = [
  "player",
  "coach",
  "staff",
  "director",
];

/**
 * §8: «Dopo la scelta mostra Specifica il ruolo, input testuale nello stesso
 * flow.» Il placeholder cambia fra Staff e Dirigente, il resto no.
 */
export const CUSTOM_ROLE_PLACEHOLDER: Partial<Record<PositionProfileType, string>> = {
  director: "Es. Responsabile scouting, responsabile organizzativo…",
  staff: "Es. Data analyst, osteopata, preparatore riabilitativo…",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  from_date: "Da una data",
  immediate: "Immediata",
  next_season: "Inizio prossima stagione",
};

export const PLAYER_EXPERIENCE_LABELS: Record<string, string> = {
  from_category: "Esperienza da una categoria specifica",
  higher_categories: "Esperienza in categorie superiori",
  in_category: "Esperienza nella categoria",
};

export const PLAYER_SITUATION_LABELS: Record<string, string> = {
  free_agent: "Svincolato",
  open_to_transfer: "Disponibile al trasferimento",
};
