/**
 * Modello del collegamento Persona–Società (DAS-REV-21).
 *
 * I nomi seguono i domini canonici di §7 — ConnectionRequest,
 * SocietyMembership sportiva, MembershipAssignment, linea dell'incarico — e
 * non le colonne SQL. La traduzione avviene una volta sola, in
 * `role-link-service.ts`.
 *
 * Nessun tipo qui porta source d'ingresso, date amministrative, audit o
 * stati tecnici: §27 e §40 li vietano nelle superfici, e il modo di
 * garantirlo è che il client non ne conosca nemmeno la forma.
 */

/** Le quattro categorie strutturali di §9. Non ce ne sono altre. */
export type RoleProfileType = "player" | "coach" | "staff" | "director";

/** §9: una squadra interna, oppure l'intera società con Team nullo. */
export type RoleScopeType = "team" | "society";

/** Lifecycle della richiesta (§17). I terminali non tornano pending. */
export type RoleRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  /**
   * §16: l'incarico equivalente è nato da un altro percorso — un link di
   * squadra, un invito accettato, un'aggiunta diretta autorizzata. Non è
   * un'approvazione e non ha un actor: «Non falsificare APPROVED da un admin
   * inesistente».
   */
  | "superseded";

/**
 * Stato del blocco «Fai parte di questa società?» (§11, screen 01).
 *
 * `ineligible` non è un errore: è un profilo Tifoso, Media/Creator o
 * un'identità organizzativa, per cui §11 vieta «un form con PERSON
 * inventata». Il blocco semplicemente non compare.
 */
export type RoleLinkBlockState =
  | "ineligible"
  | "none"
  | "pending"
  | "pending_many"
  | "active";

export type RoleLinkBlock = {
  activeCount: number;
  clubCity: string | null;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  clubRegion: string | null;
  /** "Calciatore · Prima squadra" quando esiste un rapporto attivo. */
  activeSummary: string | null;
  canRequest: boolean;
  pendingCount: number;
  requestContext: string | null;
  requestId: string | null;
  requestRoleLabel: string | null;
  state: RoleLinkBlockState;
};

/** Identità professionale reale della PERSON (§10, §12). */
export type RoleIdentity = {
  label: string;
  profileType: RoleProfileType;
};

/** Squadra interna assegnabile (§13). */
export type RoleTeamOption = {
  category: string | null;
  label: string;
  teamId: string;
};

/** Voce del catalogo condiviso dei ruoli (§9). */
export type RoleCatalogEntry = {
  isCustom: boolean;
  label: string;
  profileType: RoleProfileType;
  roleId: string;
};

export type RoleCatalog = {
  customRoleMax: number;
  roles: RoleCatalogEntry[];
};

/**
 * Richiesta in compilazione (§12, §14).
 *
 * Vive nel provider del flusso, non in un contesto globale: §46 chiede che
 * «chiudere il form non cancelli una request già inviata», e il contrario —
 * che un draft sopravviva alla schermata che lo ha creato — sarebbe il bug
 * speculare.
 */
export type RoleRequestDraft = {
  customRole: string;
  profileType: RoleProfileType | null;
  roleId: string | null;
  scopeType: RoleScopeType;
  teamId: string | null;
  teamLabel: string | null;
};

/** La propria richiesta, come la vede chi l'ha inviata (§18). */
export type MyRoleRequest = {
  canCancel: boolean;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  clubRegion: string | null;
  contextLabel: string | null;
  createdAt: string | null;
  profileType: RoleProfileType | null;
  requestId: string;
  resolvedAt: string | null;
  revision: number;
  roleLabel: string;
  scopeType: RoleScopeType;
  status: RoleRequestStatus;
  teamId: string | null;
  /**
   * §17: disponibilità e lifecycle sono fatti distinti. Una richiesta
   * PENDING su una squadra archiviata è **non più approvabile**, non
   * rifiutata.
   */
  teamUnavailable: boolean;
};

/** Riga del riepilogo quando esistono più richieste lecite (§11). */
export type MyRoleRequestSummary = {
  contextLabel: string | null;
  createdAt: string | null;
  requestId: string;
  roleLabel: string;
  status: RoleRequestStatus;
};

/** La richiesta come la vede la Società (§21). */
export type SocietyRoleRequest = {
  canResolve: boolean;
  canViewPerson: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  contextLabel: string | null;
  createdAt: string | null;
  isUnread: boolean;
  personAvatarUrl: string | null;
  personName: string;
  personProfileId: string;
  profileType: RoleProfileType | null;
  requestId: string;
  resolvedAt: string | null;
  revision: number;
  roleLabel: string;
  scopeType: RoleScopeType;
  status: RoleRequestStatus;
  teamId: string | null;
  teamUnavailable: boolean;
};

/** Riga di «Società e ruoli» (§26, screen 13). */
export type MySocietyRow = {
  activeCount: number;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  /** Un riepilogo per incarico corrente, in ordine stabile. */
  roleLines: string[];
};

/** Un incarico corrente in una riga di elenco (§27, screen 14 e 18). */
export type RoleAssignmentRow = {
  assignmentId: string;
  contextLabel: string | null;
  lineageId: string;
  profileType: RoleProfileType | null;
  revision: number;
  roleLabel: string;
  scopeType: RoleScopeType;
  teamId: string | null;
  teamIsInactive: boolean;
};

/** Il rapporto con una società, lato persona (§27). */
export type MySocietyLink = {
  activeCount: number;
  aggregateRevision: number;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  membershipId: string | null;
  roles: RoleAssignmentRow[];
};

/** Dettaglio del singolo incarico (§28 lato persona, §33 lato società). */
export type RoleAssignmentDetail = {
  assignmentId: string;
  canManage: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  contextLabel: string | null;
  customRoleName: string | null;
  lineageId: string;
  otherActiveCount: number;
  profileType: RoleProfileType | null;
  profileTypeLabel: string;
  /** L'ID chiesto dal deep link, che può essere un segmento superato. */
  requestedId: string;
  revision: number;
  roleId: string | null;
  roleLabel: string;
  scopeType: RoleScopeType;
  status: "active" | "ended";
  teamId: string | null;
  teamIsInactive: boolean;
};

/** Dettaglio lato Società, con il precedente ripristinabile (§33, §34). */
export type SocietyAssignmentDetail = RoleAssignmentDetail & {
  /**
   * §8: «Distingui almeno … modificare un incarico, aggiungerne uno,
   * rimuoverne uno.» La rimozione ha la propria chiave — quella di
   * DAS-REV-20 — e quindi il proprio flag: chi può correggere un ruolo non
   * può necessariamente toglierlo.
   */
  canRemove: boolean;
  canRestore: boolean;
  changedByPerson: boolean;
  personAvatarUrl: string | null;
  personName: string;
  personProfileId: string;
  previousContext: string | null;
  previousRoleLabel: string | null;
};

/** Il rapporto con una persona, lato Società (§32, screen 21). */
export type SocietyPersonLink = {
  aggregateRevision: number;
  canAdd: boolean;
  canRemoveAll: boolean;
  canViewPerson: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  isActive: boolean;
  membershipId: string | null;
  personAvatarUrl: string | null;
  personName: string;
  personProfileId: string;
  /** Solo gli incarichi che l'actor può consultare (§32). */
  roles: (RoleAssignmentRow & { canManage: boolean; canRemove: boolean })[];
  visibleCount: number;
};

/** Esito di una mutazione sull'incarico. */
export type AssignmentMutationResult = {
  assignmentId: string;
  /** `false` quando il salvataggio non aveva differenze semantiche (§30). */
  changed: boolean;
  contextLabel: string | null;
  lineageId: string;
  revision: number;
  roleLabel: string;
};

export type AssignmentEndResult = {
  alreadyApplied: boolean;
  assignmentId: string;
  contextLabel: string | null;
  remainingActive: number;
  roleLabel: string;
};

export type RelationshipEndResult = {
  alreadyApplied: boolean;
  endedCount: number;
};

export type RoleRequestMutationResult = {
  alreadyApplied: boolean;
  assignmentId: string | null;
  requestId: string;
  revision: number;
  status: RoleRequestStatus;
};

/** Persona con almeno un incarico societario attivo (§32). */
export type SocietyWideMember = {
  activeCount: number;
  avatarUrl: string | null;
  personName: string;
  profileId: string;
  roleLines: string[];
};
