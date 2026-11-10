/**
 * Derivazioni pure della chat di gruppo (DAS-REV-33 §17, §21, §23, §24, §26).
 * Niente rete e niente supabase: testabile senza render.
 *
 *   · §24 copy dei SYSTEM_EVENT: il server manda tipo e payload minimo
 *     (snapshot del solo nome), il testo italiano nasce qui. Un tipo
 *     sconosciuto non produce mai una bolla vuota.
 *   · §21 chat archiviata: stato e `canSend` arrivano dal server, il client
 *     non li deduce.
 *   · §23 e §26 revoca: decisione su un cambio di periodo di appartenenza e
 *     classificazione degli errori di accesso. Un UPDATE di un periodo
 *     diverso da quello osservato (reingresso, evento in ritardo) non
 *     espelle da un periodo nuovo.
 */

export type GroupStatus = "active" | "archived";

export const GROUP_CHAT_COPY = {
  archivedLabel: "Archiviato",
  archivedNotice: "Questo gruppo è archiviato.",
  eventFallback: "Il gruppo è stato aggiornato.",
  groupDeleted: "Il gruppo è stato eliminato.",
  membershipEnded: "Non fai più parte di questo gruppo.",
} as const;

/* -------------------------------------------------------------------------- */
/* SYSTEM_EVENT                                                               */
/* -------------------------------------------------------------------------- */

export type SystemEventPayload = Record<string, unknown> | null | undefined;

function payloadName(payload: SystemEventPayload): string | null {
  const name = payload?.name;

  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function payloadCount(payload: SystemEventPayload): number | null {
  const count = payload?.count;

  return typeof count === "number" && Number.isInteger(count) && count > 0 ? count : null;
}

/**
 * Testo di un evento di sistema (§24). Nome o conteggio mancanti degradano a
 * una formulazione neutra invece di lasciare un buco nella frase.
 */
export function formatSystemEvent(
  type: string | null | undefined,
  payload: SystemEventPayload,
): string {
  switch (type) {
    case "GROUP_MEMBER_ADDED": {
      const name = payloadName(payload);

      return name ? `${name} è stato aggiunto al gruppo.` : "Una persona è stata aggiunta al gruppo.";
    }
    case "GROUP_MEMBERS_ADDED": {
      const count = payloadCount(payload);

      if (count === null) {
        return "Alcune persone sono state aggiunte al gruppo.";
      }

      return count === 1
        ? "Una persona è stata aggiunta al gruppo."
        : `${count} persone sono state aggiunte al gruppo.`;
    }
    case "GROUP_MEMBER_LEFT":
      return `${payloadName(payload) ?? "Una persona"} ha lasciato il gruppo.`;
    case "GROUP_MEMBER_REMOVED": {
      const name = payloadName(payload);

      return name ? `${name} è stato rimosso dal gruppo.` : "Una persona è stata rimossa dal gruppo.";
    }
    case "GROUP_RENAMED": {
      const name = payloadName(payload);

      return name ? `Il gruppo ora si chiama ${name}.` : "Il gruppo è stato rinominato.";
    }
    case "GROUP_ARCHIVED":
      return "Il gruppo è stato archiviato.";
    case "GROUP_REACTIVATED":
      return "Il gruppo è stato riattivato.";
    default:
      return GROUP_CHAT_COPY.eventFallback;
  }
}

/**
 * Qualunque evento di sistema può cambiare ciò che la testata mostra: stato
 * (archivia/riattiva), nome (rinomina), conteggio persone (add/leave/remove).
 * Anche un tipo sconosciuto invalida: costa una query e non lascia la
 * testata stantia.
 */
export function systemEventAffectsGroupMeta(type: string | null | undefined): boolean {
  return typeof type === "string" && type.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Revoca dell'accesso                                                        */
/* -------------------------------------------------------------------------- */

export type RevocationReason = "ended" | "deleted";

export type MembershipPeriodChange = {
  conversationId: string;
  endedAt: string | null;
  /** Id del periodo. */
  id: string;
  profileId: string;
  /** Tipo grezzo di revoca: nessun motivo tecnico arriva al client. null = periodo attivo. */
  revokedKind: RevocationReason | null;
};

/**
 * Riga `society_group_member_access` (payload.new del realtime) → forma
 * interna. Colonne: id (= periodo), conversation_id, profile_id, ended_at,
 * revoked_kind ('ended' | 'deleted' | null se attivo).
 */
export function toMembershipPeriodChange(record: unknown): MembershipPeriodChange | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const row = record as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  const id = text(row.id);
  const conversationId = text(row.conversation_id);
  const profileId = text(row.profile_id);

  if (!id || !conversationId || !profileId) {
    return null;
  }

  return {
    conversationId,
    endedAt: text(row.ended_at),
    id,
    profileId,
    revokedKind: row.revoked_kind === "deleted" ? "deleted" : row.revoked_kind === "ended" ? "ended" : null,
  };
}

export type RevocationDecision =
  | { action: "ignore" }
  /** Periodo osservato non ancora noto: si ricontrolla col server, che è l'autorità. */
  | { action: "verify" }
  | { action: "revoke"; reason: RevocationReason };

export function decideMembershipRevocation(input: {
  change: MembershipPeriodChange | null;
  conversationId: string;
  /** Periodo di accesso osservato dalla chat (meta), null se non ancora caricato. */
  currentPeriodId: string | null;
  myProfileId: string;
}): RevocationDecision {
  const { change } = input;

  if (
    !change ||
    !change.endedAt ||
    change.conversationId !== input.conversationId ||
    change.profileId !== input.myProfileId
  ) {
    return { action: "ignore" };
  }

  if (!input.currentPeriodId) {
    return { action: "verify" };
  }

  // Un periodo precedente che si chiude non tocca quello in corso.
  if (change.id !== input.currentPeriodId) {
    return { action: "ignore" };
  }

  /* Eliminato solo se il server lo dice; qualunque altra fine è «ended». */
  return { action: "revoke", reason: change.revokedKind === "deleted" ? "deleted" : "ended" };
}

export function revocationMessage(reason: RevocationReason): string {
  return reason === "deleted" ? GROUP_CHAT_COPY.groupDeleted : GROUP_CHAT_COPY.membershipEnded;
}

/**
 * Chi naviga alla revoca (DAS-REV-33 §26). Con Info gruppo aperta sopra la
 * chat, la chat non è in primo piano: un suo `router.back()` toglierebbe Info
 * invece della chat, e Info ha già la propria uscita verso l'Inbox. Quindi la
 * chat naviga e avvisa solo se è la schermata in primo piano; altrimenti
 * svuota le cache e si segna revocata, senza toccare la navigazione. Se lo
 * stato di focus non è noto si naviga: meglio un'uscita doppia che nessuna.
 */
export function shouldNavigateOnRevoke(focused: boolean | undefined): boolean {
  return focused !== false;
}

/* -------------------------------------------------------------------------- */
/* Errori di accesso                                                          */
/* -------------------------------------------------------------------------- */

export type GroupAccessError = "archived" | RevocationReason;

function errorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  // PostgrestError non è un'istanza di Error: si legge `message` per forma.
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;

    return typeof message === "string" ? message : "";
  }

  return "";
}

/**
 * Classifica un errore del server sui gruppi: `SOCIETY_GROUP_ARCHIVED`
 * (invio stantio dopo l'archiviazione), `…_DELETED` (tombstone), `…_NOT_MEMBER`
 * e «Conversazione non trovata» (membership terminata o mai esistita: stessa
 * esperienza, il server non rivela quale).
 */
export function classifyGroupAccessError(error: unknown): GroupAccessError | null {
  const text = errorText(error);

  if (text.includes("SOCIETY_GROUP_ARCHIVED")) {
    return "archived";
  }

  if (text.includes("SOCIETY_GROUP_DELETED")) {
    return "deleted";
  }

  if (
    text.includes("SOCIETY_GROUP_NOT_MEMBER") ||
    text.toLowerCase().includes("conversazione non trovata")
  ) {
    return "ended";
  }

  return null;
}

/** Un accesso perso non si ritenta: ritentare tre volte ritarda solo la revoca. */
export function isAccessLostError(error: unknown): boolean {
  const kind = classifyGroupAccessError(error);

  return kind === "ended" || kind === "deleted";
}

/* -------------------------------------------------------------------------- */
/* Chat archiviata                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Il composer esiste solo se il server dice che si può scrivere. Senza meta
 * (caricamento, errore) non lo si nasconde: una chat attiva non deve perdere
 * il composer per un caricamento lento; l'invio resta protetto dal server.
 */
export function isGroupComposerAvailable(meta: { canSend: boolean } | null): boolean {
  return meta ? meta.canSend : true;
}
