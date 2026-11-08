/**
 * Tipi del flusso «Aggiungi a shortlist» dal profilo (DAS-REV-26).
 *
 * Sono proiezioni del core unico della 24/25, non un secondo dominio (§1):
 * una membership è una `club_shortlist_entries`, una destinazione è una
 * Position o una CUSTOM esistente, e la valutazione resta quella
 * dell'editor condiviso (`ShortlistEntryDetail`).
 */
import type {
  ShortlistEvaluationStatus,
  ShortlistKind,
  ShortlistPriority,
} from "../shortlist-types";

/**
 * Stato della stella (§9, §24).
 *
 * «Non usare un singolo boolean con false come fallback per ogni
 * condizione.» `available: false` significa **nessuna stella**; la presenza
 * conta soltanto quando lo strumento esiste. Caricamento ed errore non sono
 * qui: sono lo stato della query, e non diventano mai un'assenza confermata.
 */
export type ProfileShortlistState =
  | { available: false; verifiedAt: string | null }
  | {
      available: true;
      canAdd: boolean;
      canCreate: boolean;
      inAnyList: boolean;
      verifiedAt: string | null;
    };

/** Una riga del riepilogo «{Nome} è in shortlist» (§14). */
export type ProfileMembership = {
  canEditNote: boolean;
  canEditStatus: boolean;
  canRemove: boolean;
  entryId: string;
  evaluationStatus: ShortlistEvaluationStatus;
  generation: number;
  isClosed: boolean;
  isDraft: boolean;
  kind: ShortlistKind;
  positionId: string | null;
  priority: ShortlistPriority | null;
  revision: number;
  scopeLabel: string | null;
  shortlistId: string;
  title: string;
};

export type ProfileMemberships = {
  canAddMore: boolean;
  canCreate: boolean;
  items: ProfileMembership[];
  truncated: boolean;
};

/** Una riga del selector (§11): una destinazione, mai una checkbox. */
export type ProfileDestination = {
  isClosed: boolean;
  isDraft: boolean;
  kind: ShortlistKind;
  /** POSITION: sempre presente, anche senza contenitore (§10). */
  positionId: string | null;
  scopeLabel: string | null;
  /** CUSTOM: sempre presente. POSITION: solo se già materializzata. */
  shortlistId: string | null;
  title: string;
};

export type ProfileDestinationGroup = "position" | "custom";

export type ProfileDestinationPage = {
  canCreate: boolean;
  items: ProfileDestination[];
  nextCursor: string | null;
};

/** Esito dell'aggiunta (§13): proiezione autorizzata, non un booleano. */
export type ProfileAddOutcome = {
  already: boolean;
  entryId: string | null;
  inAnyList: boolean;
  /** §25: la ricevuta di un vecchio add la cui generazione è stata chiusa. */
  removedSince: boolean;
  replayed: boolean;
  shortlistId: string;
};

/** Esito della creazione CUSTOM (§19). */
export type CustomCreateOutcome = {
  entryActive: boolean;
  entryId: string | null;
  name: string;
  replayed: boolean;
  scopeLabel: string;
  shortlistId: string;
  status: "completed" | "created";
};

/** Ambito di una nuova CUSTOM (§17): `teamId` nullo = Intera società. */
export type CustomScopeOption = {
  label: string;
  teamId: string | null;
};

/** La persona del profilo visitato: dati pubblici canonici, nient'altro. */
export type ProfileShortlistPerson = {
  avatarUrl: string | null;
  fullName: string;
  id: string;
};

/** La Società operativa: il contesto Dashboard già scelto (§8). */
export type ProfileShortlistSociety = {
  id: string;
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
};
