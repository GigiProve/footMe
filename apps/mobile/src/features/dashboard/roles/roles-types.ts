/**
 * Modello di Ruoli, permessi, ambito e ownership (DAS-REV-14).
 *
 * I nomi seguono il dominio della specifica — ruolo, area, controllo,
 * livello, ambito, ownership — e non le colonne SQL. La traduzione avviene
 * una volta sola, in `roles-service.ts`.
 *
 * Nessun tipo qui porta una capability tecnica scritta a mano: le chiavi
 * arrivano dal catalogo server, e §13 vieta che il client possieda la forma
 * di un payload di permessi arbitrario. Ciò che il client invia è un elenco
 * di **id di controllo**, che il backend traduce in chiavi.
 */

/** I tre livelli rapidi più quello derivato (§7). */
export type AreaLevel = "none" | "view" | "manage" | "custom";

/** Un'area è societaria o di squadra: lo decide il catalogo, non la UI (§17). */
export type AreaScopeKind = "society" | "team";

export type PermissionControl = {
  bundle: "view" | "manage";
  /** Helper della dipendenza bloccata: «Necessario per aggiornare lo stato». */
  helper: string | null;
  id: string;
  /** `false` quando l'actor non possiede tutte le chiavi del controllo (§6). */
  isGrantable: boolean;
  label: string;
  /** Chiavi reali: servono solo a leggere una configurazione già salvata. */
  permissionKeys: string[];
  /** Id di altri controlli della stessa area, obbligatori per questo (§12). */
  requires: string[];
  sortOrder: number;
};

export type PermissionArea = {
  controls: PermissionControl[];
  description: string | null;
  id: string;
  label: string;
  scopeKind: AreaScopeKind;
  sortOrder: number;
};

export type PermissionCatalog = {
  areas: PermissionArea[];
  revision: number;
};

/** Composizione del Centro Ruoli e permessi (screen 01). */
export type RolesCenter = {
  accessVerifiedAt: number;
  canCreateRole: boolean;
  canEditRoles: boolean;
  catalogRevision: number;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  dataRevision: number;
  rolesCount: number;
};

/** Riga dell'elenco dei ruoli (screen 01). */
export type RoleRow = {
  /** Numero di aree con almeno un controllo attivo (§8). */
  areasEnabled: number;
  /** Amministratori **attivi** che lo utilizzano: i pending non contano. */
  adminsCount: number;
  configVersion: number;
  isSystem: boolean;
  name: string;
  roleId: string;
  version: number;
};

/** Configurazione completa di un ruolo (screen 03). */
export type RoleDetail = {
  adminsCount: number;
  areasEnabled: number;
  canArchive: boolean;
  canEdit: boolean;
  catalogRevision: number;
  configVersion: number;
  isActive: boolean;
  isSystem: boolean;
  name: string;
  /** Inviti ancora accettabili che propongono questo ruolo (§24). */
  pendingInvites: number;
  permissionKeys: string[];
  roleId: string;
  version: number;
};

/**
 * Draft del role editor.
 *
 * Vive nello schermo, non in un contesto globale, e contiene **id di
 * controllo**. §13: «Solo Crea ruolo invia il comando di creazione»; fino ad
 * allora questo oggetto è l'unica cosa che cambia.
 */
export type RoleDraft = {
  /** Id di controllo attivi, già espansi con le dipendenze obbligatorie. */
  controlIds: string[];
  name: string;
};

export type SavedRole = {
  adminsCount: number;
  /** `false` quando il draft coincideva con il server: nessuna versione nuova. */
  changed: boolean;
  configVersion: number;
  name: string;
  roleId: string;
  version: number;
};

/** Riepilogo di una differenza, in parole umane (§10). */
export type AreaLevelChange = {
  areaId: string;
  areaLabel: string;
  /** Etichette dei controlli che cambiano, quando il livello è custom. */
  details: string[];
  next: AreaLevel;
  previous: AreaLevel;
};
