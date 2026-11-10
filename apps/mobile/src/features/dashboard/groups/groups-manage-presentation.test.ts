/**
 * Derivazioni di gestione e lifecycle (DAS-REV-33). La fixture è quella del §8:
 * Staff Primavera, AC Como, Squadra Primavera, quattro persone, un solo ADMIN.
 */
import { describe, expect, it } from "vitest";

import { GROUP_MANAGE_COPY as C } from "./groups-copy";
import {
  addExceedsMax,
  archivedMetaOf,
  archivedStatusOf,
  canConfirmAdd,
  canConfirmHandover,
  createdLineOf,
  deleteOffersArchive,
  formatCreatedDate,
  groupFailureOf,
  headerContextOf,
  infoActionsOf,
  infoAffordancesOf,
  infoNoticeOf,
  infoVariantOf,
  intentFor,
  leaveFlowOf,
  leaveOutcomeOf,
  loadFailureOf,
  memberActionsOf,
  memberSectionsOf,
  memberSubtitleOf,
  memberTapOf,
  memberTitleOf,
  nameDraftDirty,
  nameSaveOf,
  peopleLineOf,
  selectionAfterTargetsFailure,
  teamValueOf,
} from "./groups-manage-presentation";
import { DEFAULT_GROUP_LIMITS, NO_GROUP_CAPABILITIES, type GroupCapabilities, type GroupMember } from "./groups-types";

const caps = (patch: Partial<GroupCapabilities>): GroupCapabilities => ({ ...NO_GROUP_CAPABILITIES, ...patch });

const MEMBER_CAPS = caps({ canAccessConversation: true, canLeave: true, canViewInfo: true, canViewPeople: true });
const ADMIN_CAPS = caps({
  ...MEMBER_CAPS,
  canArchive: true,
  canEditAvatar: true,
  canEditName: true,
  canManageAdmins: true,
  canManagePeople: true,
});
const MANAGER_CAPS = caps({
  canArchive: true,
  canDelete: true,
  canEditAvatar: true,
  canEditName: true,
  canEditTeam: true,
  canManageAdmins: true,
  canManagePeople: true,
  canViewInfo: true,
  canViewPeople: true,
});

const info = (patch: Partial<{ capabilities: GroupCapabilities; leavePath: "add_people_first" | "handover" | "ordinary" | null; status: "active" | "archived"; adminCount: number }> = {}) => ({
  adminCount: 1,
  capabilities: MEMBER_CAPS,
  leavePath: "ordinary" as "add_people_first" | "handover" | "ordinary" | null,
  status: "active" as "active" | "archived",
  ...patch,
});

const keys = (m: ReturnType<typeof info>) => infoActionsOf(m).map((action) => action.key);

const member = (patch: Partial<GroupMember> & { profileId: string }): GroupMember => ({
  avatarUrl: null,
  canDemote: false,
  canPromote: false,
  canRemove: false,
  fullName: patch.profileId,
  isMe: false,
  memberRole: "member",
  periodId: `period-${patch.profileId}`,
  periodVersion: 1,
  roleLabel: null,
  ...patch,
});

describe("Info gruppo: azioni per variante (§9, screen 01-03, 14, 16, 19)", () => {
  it("screen 01 — MEMBER: solo Lascia gruppo", () => {
    expect(keys(info())).toEqual(["leave"]);
  });

  it("screen 02 — ADMIN: Lascia e Archivia, nessun Elimina senza can_delete", () => {
    expect(keys(info({ capabilities: ADMIN_CAPS }))).toEqual(["leave", "archive"]);
  });

  it("screen 02 — ADMIN con can_delete: Elimina in coda, rosso", () => {
    const actions = infoActionsOf(info({ capabilities: { ...ADMIN_CAPS, canDelete: true } }));

    expect(actions.map((a) => a.key)).toEqual(["leave", "archive", "delete"]);
    expect(actions[2].tone).toBe("danger");
  });

  it("screen 03 — manager non membro: niente Lascia, mai", () => {
    expect(keys(info({ capabilities: MANAGER_CAPS, leavePath: null }))).toEqual(["archive", "delete"]);
  });

  it("screen 14 — unica persona ACTIVE: Aggiungi persone primaria, nessun Lascia diretto", () => {
    const actions = infoActionsOf(info({ capabilities: { ...ADMIN_CAPS, canDelete: true }, leavePath: "add_people_first" }));

    expect(actions.map((a) => a.key)).toEqual(["add_people", "archive", "delete"]);
    expect(actions[0].tone).toBe("primary");
    expect(actions.filter((a) => a.tone === "primary")).toHaveLength(1);
  });

  it("screen 14 — senza can_manage_people non c'è CTA ma nemmeno Lascia", () => {
    expect(keys(info({ capabilities: MEMBER_CAPS, leavePath: "add_people_first" }))).toEqual([]);
  });

  it("successione (ultimo ADMIN con altre persone): Lascia resta, il flusso lo decide leaveFlowOf", () => {
    const m = info({ capabilities: ADMIN_CAPS, leavePath: "handover" });

    expect(keys(m)).toContain("leave");
    expect(leaveFlowOf(m)).toBe("handover");
    expect(leaveFlowOf(info())).toBe("ordinary");
  });

  it("screen 16 — ARCHIVED con ADMIN: Riattiva primaria, poi Lascia, poi Elimina", () => {
    const m = info({
      capabilities: { ...MEMBER_CAPS, canDelete: true, canReactivate: true },
      status: "archived",
    });

    expect(keys(m)).toEqual(["reactivate", "leave", "delete"]);
    expect(infoActionsOf(m)[0].tone).toBe("primary");
  });

  it("screen 19 — ARCHIVED senza ADMIN: Gestisci persone al manager, nessuna Riattiva", () => {
    const m = info({
      adminCount: 0,
      capabilities: { ...MANAGER_CAPS, canArchive: false, canEditName: false, canRecover: true },
      leavePath: null,
      status: "archived",
    });

    expect(keys(m)).toEqual(["manage_people", "delete"]);
    expect(infoNoticeOf(m)).toBe("Serve un amministratore per riattivare il gruppo.");
  });

  it("ARCHIVED: Archivia non si offre mai", () => {
    expect(keys(info({ capabilities: { ...ADMIN_CAPS, canArchive: true }, status: "archived" }))).not.toContain("archive");
  });

  it("avviso di sola persona solo in ACTIVE, e solo col percorso add_people_first", () => {
    expect(infoNoticeOf(info({ leavePath: "add_people_first" }))).toBe("Aggiungi almeno una persona al gruppo prima di lasciare.");
    expect(infoNoticeOf(info())).toBeNull();
    expect(infoNoticeOf(info({ adminCount: 0, status: "archived" }))).toBeNull();
  });
});

describe("delete: alternativa Archivia (§23, screen 20-21)", () => {
  it("ACTIVE con can_archive offre «Archivia»", () => {
    expect(deleteOffersArchive({ capabilities: caps({ canArchive: true, canDelete: true }), status: "active" })).toBe(true);
  });

  it("ACTIVE senza can_archive non la offre: non sarebbe eseguibile", () => {
    expect(deleteOffersArchive({ capabilities: caps({ canDelete: true }), status: "active" })).toBe(false);
  });

  it("ARCHIVED non la offre mai: già soddisfatta", () => {
    expect(deleteOffersArchive({ capabilities: caps({ canArchive: true, canDelete: true }), status: "archived" })).toBe(false);
  });
});

describe("affordance di modifica (§5, §11)", () => {
  it("MEMBER: nessuna matita, avatar o chevron Squadra", () => {
    expect(infoAffordancesOf(MEMBER_CAPS)).toEqual({
      avatarEditable: false,
      nameEditable: false,
      peopleRow: true,
      teamEditable: false,
    });
  });

  it("ADMIN senza capability Society: Squadra resta un valore semplice", () => {
    expect(infoAffordancesOf(ADMIN_CAPS).teamEditable).toBe(false);
    expect(infoAffordancesOf(MANAGER_CAPS).teamEditable).toBe(true);
  });
});

describe("intestazione e metadata (§9)", () => {
  it("variante osservata", () => {
    expect(infoVariantOf({ myRole: "admin" })).toBe("admin");
    expect(infoVariantOf({ myRole: "member" })).toBe("member");
    expect(infoVariantOf({ myRole: null })).toBe("manager");
  });

  it("«N persone · M amministratori» con singolari", () => {
    expect(peopleLineOf({ adminCount: 1, peopleCount: 4 })).toBe("4 persone · 1 amministratore");
    expect(peopleLineOf({ adminCount: 2, peopleCount: 1 })).toBe("1 persona · 2 amministratori");
    expect(peopleLineOf({ adminCount: 0, peopleCount: 3 })).toBe("3 persone · 0 amministratori");
  });

  it("Squadra: nome o «Nessuna squadra»", () => {
    expect(teamValueOf({ teamId: "t1", teamName: "Primavera" })).toBe("Primavera");
    expect(teamValueOf({ teamId: null, teamName: null })).toBe("Nessuna squadra");
  });

  it("contesto: Società e Squadra, senza Squadra solo la Società", () => {
    expect(headerContextOf({ clubIsVerified: false, clubName: "AC Como", teamId: "t1", teamName: "Primavera" })).toEqual({
      clubName: "AC Como",
      clubVerified: false,
      teamName: "Primavera",
    });
    expect(headerContextOf({ clubIsVerified: false, clubName: "AC Como", teamId: null, teamName: null }).teamName).toBeNull();
  });

  it("check verificato: solo se il server lo conferma, e sulla Società", () => {
    expect(headerContextOf({ clubIsVerified: true, clubName: "AC Como", teamId: null, teamName: null }).clubVerified).toBe(true);
    expect(headerContextOf({ clubIsVerified: false, clubName: "AC Como", teamId: null, teamName: null }).clubVerified).toBe(false);
  });

  it("«Creato il 13 set 2026 · Attivo» e «· Archiviato»", () => {
    const iso = new Date(2026, 8, 13, 12).toISOString();

    expect(formatCreatedDate(iso)).toBe("13 set 2026");
    expect(createdLineOf({ createdAt: iso, status: "active" })).toBe("Creato il 13 set 2026 · Attivo");
    expect(createdLineOf({ createdAt: iso, status: "archived" })).toBe("Creato il 13 set 2026 · Archiviato");
  });

  it("senza data leggibile nessuna riga inventata", () => {
    expect(formatCreatedDate(null)).toBeNull();
    expect(formatCreatedDate("non-una-data")).toBeNull();
    expect(createdLineOf({ createdAt: null, status: "active" })).toBeNull();
  });
});

describe("nome inline (§10, screen 04)", () => {
  const limits = DEFAULT_GROUP_LIMITS;

  it("vuoto o solo spazi: errore inline, nessuna mutation", () => {
    expect(nameSaveOf("   ", "Staff Primavera", limits)).toEqual({ kind: "invalid", message: "Inserisci un nome per il gruppo." });
  });

  it("oltre il limite centrale: rifiutato, mai troncato", () => {
    const result = nameSaveOf("x".repeat(81), "Staff Primavera", limits);

    expect(result.kind).toBe("invalid");
  });

  it("al limite esatto è valido", () => {
    expect(nameSaveOf("x".repeat(80), "Staff Primavera", limits)).toEqual({ kind: "save", name: "x".repeat(80) });
  });

  it("spazi ripetuti normalizzati prima dell'invio", () => {
    expect(nameSaveOf("  Staff   tecnico  Primavera ", "Staff Primavera", limits)).toEqual({
      kind: "save",
      name: "Staff tecnico Primavera",
    });
  });

  it("nome invariato dopo la normalizzazione: nessun comando", () => {
    expect(nameSaveOf("Staff  Primavera", "Staff Primavera", limits)).toEqual({ kind: "noop" });
  });

  it("il guard di uscita scatta solo in editing con un valore diverso", () => {
    expect(nameDraftDirty("Staff tecnico Primavera", "Staff Primavera", true)).toBe(true);
    expect(nameDraftDirty("Staff  Primavera", "Staff Primavera", true)).toBe(false);
    expect(nameDraftDirty("Staff tecnico", "Staff Primavera", false)).toBe(false);
  });
});

describe("Persone: sezioni e conteggi (§12, screen 07, QA-038)", () => {
  const members = [
    member({ fullName: "Giuseppe Conti", isMe: true, memberRole: "admin", profileId: "gc" }),
    member({ fullName: "Mister Bianchi", profileId: "mb", roleLabel: "Allenatore" }),
    member({ fullName: "Andrea Neri", profileId: "an" }),
    member({ fullName: "Riccardo Riva", profileId: "rr" }),
  ];

  it("Amministratori · 1 e Altre persone · 3, ognuno una volta sola", () => {
    const sections = memberSectionsOf(members, { adminCount: 1, otherCount: 3 }, "");

    expect(sections.map((s) => s.title)).toEqual(["Amministratori · 1", "Altre persone · 3"]);
    expect(sections[0].data.map((m) => m.profileId)).toEqual(["gc"]);
    expect(sections[1].data.map((m) => m.profileId)).toEqual(["mb", "an", "rr"]);
  });

  it("i conteggi sono del server, non delle righe caricate", () => {
    const sections = memberSectionsOf(members.slice(0, 2), { adminCount: 1, otherCount: 40 }, "");

    expect(sections[1].title).toBe("Altre persone · 40");
  });

  it("durante la ricerca i titoli non portano il totale del gruppo", () => {
    const sections = memberSectionsOf(members, { adminCount: 1, otherCount: 3 }, "ri");

    expect(sections.map((s) => s.title)).toEqual(["Amministratori", "Altre persone"]);
  });

  it("deduplica per ID tra le pagine e omette le sezioni vuote", () => {
    const sections = memberSectionsOf([members[1], members[1]], { adminCount: 0, otherCount: 1 }, "");

    expect(sections).toHaveLength(1);
    expect(sections[0].data).toHaveLength(1);
  });

  it("riga: «Tu» sul proprio nome; ruolo professionale e stato amministratore sobri", () => {
    expect(memberTitleOf(members[0])).toBe("Giuseppe Conti · Tu");
    expect(memberTitleOf(members[1])).toBe("Mister Bianchi");
    expect(memberSubtitleOf({ memberRole: "admin", roleLabel: "Allenatore" })).toBe("Allenatore · Amministratore");
    expect(memberSubtitleOf({ memberRole: "admin", roleLabel: null })).toBe("Amministratore");
    expect(memberSubtitleOf({ memberRole: "member", roleLabel: null })).toBeNull();
  });
});

describe("azioni sulla riga (§14, §15, screen 09-10)", () => {
  it("screen 09 — MEMBER: Apri profilo, Rendi amministratore, Rimuovi dal gruppo (rosso)", () => {
    const actions = memberActionsOf({ canDemote: false, canPromote: true, canRemove: true, isMe: false, memberRole: "member" });

    expect(actions.map((a) => a.label)).toEqual(["Apri profilo", "Rendi amministratore", "Rimuovi dal gruppo"]);
    expect(actions.map((a) => a.destructive)).toEqual([false, false, true]);
  });

  it("screen 10 — ADMIN: Rimuovi ruolo di amministratore al posto di Rendi amministratore", () => {
    const actions = memberActionsOf({ canDemote: true, canPromote: true, canRemove: true, isMe: false, memberRole: "admin" });

    expect(actions.map((a) => a.key)).toEqual(["open_profile", "demote", "remove"]);
  });

  it("la promozione non si mostra a chi è già ADMIN, anche se la flag fosse vera", () => {
    const actions = memberActionsOf({ canDemote: false, canPromote: true, canRemove: false, isMe: false, memberRole: "admin" });

    expect(actions.map((a) => a.key)).toEqual(["open_profile"]);
  });

  it("propria riga: mai Rimuovi dal gruppo", () => {
    const actions = memberActionsOf({ canDemote: true, canPromote: false, canRemove: true, isMe: true, memberRole: "admin" });

    expect(actions.map((a) => a.key)).not.toContain("remove");
  });

  it("recovery: flag di rimozione e demozione già false, resta la promozione", () => {
    const actions = memberActionsOf({ canDemote: false, canPromote: true, canRemove: false, isMe: false, memberRole: "member" });

    expect(actions.map((a) => a.key)).toEqual(["open_profile", "promote"]);
  });

  it("viewer MEMBER: il tap apre direttamente il profilo, nessun menu con una voce", () => {
    expect(memberTapOf({ canDemote: false, canPromote: false, canRemove: false, isMe: false, memberRole: "member" })).toBe("profile");
    expect(memberTapOf({ canDemote: false, canPromote: true, canRemove: false, isMe: false, memberRole: "member" })).toBe("menu");
  });
});

describe("selezione: aggiunta e successione (§13, §19)", () => {
  it("il massimo centrale conta i già attivi", () => {
    expect(addExceedsMax(250, 6, { maxPeople: 256 })).toBe(false);
    expect(addExceedsMax(250, 7, { maxPeople: 256 })).toBe(true);
  });

  it("target non validi: restano solo le selezioni ancora valide (ID del server)", () => {
    expect(selectionAfterTargetsFailure(["a", "b", "c"], { personIds: ["b"], validIds: ["a", "c"] })).toEqual(["a", "c"]);
  });

  it("senza ID validi si tolgono gli invalidi noti", () => {
    expect(selectionAfterTargetsFailure(["a", "b", "c"], { personIds: ["b"], validIds: [] })).toEqual(["a", "c"]);
  });

  it("tutti invalidi: selezione vuota, nessun invio automatico", () => {
    expect(selectionAfterTargetsFailure(["a", "b"], { personIds: ["a", "b"], validIds: [] })).toEqual([]);
  });

  it("successione: «2 selezionati», non il numero dei candidati; zero non conferma", () => {
    expect(canConfirmHandover({ count: 2, pending: false })).toBe(true);
    expect(canConfirmHandover({ count: 0, pending: false })).toBe(false);
    expect(canConfirmHandover({ count: 2, pending: true })).toBe(false);
  });

  it("Aggiungi · N disabilitato a zero, con selezione completa in corso o richiesta pendente", () => {
    expect(canConfirmAdd({ bulkPending: false, count: 3, pending: false })).toBe(true);
    expect(canConfirmAdd({ bulkPending: false, count: 0, pending: false })).toBe(false);
    expect(canConfirmAdd({ bulkPending: true, count: 3, pending: false })).toBe(false);
    expect(canConfirmAdd({ bulkPending: false, count: 3, pending: true })).toBe(false);
  });

  it("copy del footer: «Aggiungi · 3» e «Aggiungi» a zero", () => {
    expect(C.addCta(3)).toBe("Aggiungi · 3");
    expect(C.addCta(0)).toBe("Aggiungi");
  });
});

describe("uscita (§18)", () => {
  it("changed → left", () => {
    expect(leaveOutcomeOf({ changed: true, periodChanged: false, periodEnded: false })).toBe("left");
  });

  it("già lasciato: riconcilia ed esce", () => {
    expect(leaveOutcomeOf({ changed: false, periodChanged: false, periodEnded: true })).toBe("already_left");
  });

  it("nuovo ingresso successivo: nessuna uscita, si ricarica", () => {
    expect(leaveOutcomeOf({ changed: false, periodChanged: true, periodEnded: false })).toBe("stale");
  });
});

describe("Gruppi archiviati (§21, screen 18)", () => {
  it("«Primavera · 4 persone» e stato Archiviato, senza dati chat", () => {
    const row = { needsRecovery: false, peopleCount: 4, teamId: "t1", teamName: "Primavera" };

    expect(archivedMetaOf(row)).toBe("Primavera · 4 persone");
    expect(archivedStatusOf(row)).toBe("Archiviato");
  });

  it("zero ADMIN: lo dice, senza inventare uno stato", () => {
    expect(archivedStatusOf({ needsRecovery: true })).toBe("Archiviato · Serve un amministratore");
  });

  it("gruppo senza Squadra: contesto Società", () => {
    expect(archivedMetaOf({ peopleCount: 1, teamId: null, teamName: null })).toBe("Società · 1 persona");
  });
});

describe("idempotenza: una chiave per intenzione (§25)", () => {
  let counter = 0;
  const mint = () => `key-${++counter}`;

  it("stesso payload dopo un esito incerto: stessa chiave", () => {
    const first = intentFor(null, "add:a,b", mint);

    expect(intentFor(first, "add:a,b", mint)).toBe(first);
  });

  it("payload diverso: nuova intenzione, nuova chiave", () => {
    const first = intentFor(null, "add:a,b", mint);
    const second = intentFor(first, "add:a", mint);

    expect(second.key).not.toBe(first.key);
  });

  it("dopo la chiusura (previous null) lo stesso gesto è un'azione nuova", () => {
    const first = intentFor(null, "promote:p1:v3", mint);
    const again = intentFor(null, "promote:p1:v3", mint);

    expect(again.key).not.toBe(first.key);
  });
});

describe("errori dei comandi → copy e recupero (§27)", () => {
  const limits = { maxPeople: 256, nameMax: 80 };
  const err = (code: Parameters<typeof groupFailureOf>[0]["code"], patch: Partial<{ field: string | null; personIds: string[]; validIds: string[] }> = {}) =>
    groupFailureOf({ code, field: null, personIds: [], validIds: [], ...patch }, "rename", limits);

  it("conflitto di versione: rilettura, bozza conservata, nessun overwrite silenzioso", () => {
    const failure = err("SOCIETY_GROUP_VERSION_CONFLICT");

    expect(failure.kind).toBe("conflict");
    expect(failure.refetch).toBe(true);
    expect(failure.settled).toBe(true);
  });

  it("ultimo ADMIN: copy del §14, contestuale", () => {
    expect(groupFailureOf({ code: "SOCIETY_GROUP_LAST_ADMIN", field: null, personIds: [], validIds: [] }, "demote", limits).message).toBe(
      "Aggiungi prima un altro amministratore al gruppo.",
    );
  });

  it("target non più disponibili: copy condivisa, ID da togliere e ID validi", () => {
    const failure = groupFailureOf(
      { code: "SOCIETY_GROUP_TARGETS_UNAVAILABLE", field: null, personIds: ["x"], validIds: ["a"] },
      "add_people",
      limits,
    );

    expect(failure.message).toBe("Alcune persone selezionate non sono più disponibili. Controlla e riprova.");
    expect(failure.removeIds).toEqual(["x"]);
    expect(failure.validIds).toEqual(["a"]);
    expect(failure.refetch).toBe(true);
  });

  it("recovery necessario", () => {
    expect(err("SOCIETY_GROUP_REACTIVATE_REQUIRES_ADMIN").message).toBe("Serve un amministratore per riattivare il gruppo.");
  });

  it("send stale su archiviato, membership terminata, tombstone", () => {
    expect(err("SOCIETY_GROUP_ARCHIVED").message).toBe("Questo gruppo è archiviato.");

    const ended = err("SOCIETY_GROUP_NOT_MEMBER");
    expect(ended.message).toBe("Non fai più parte di questo gruppo.");
    expect(ended.accessLost).toBe("ended");

    const deleted = err("SOCIETY_GROUP_DELETED");
    expect(deleted.message).toBe("Il gruppo è stato eliminato.");
    expect(deleted.accessLost).toBe("deleted");
  });

  it("Squadra non utilizzabile: mai null al suo posto, selector da rileggere", () => {
    const failure = err("SOCIETY_GROUP_TEAM_UNAVAILABLE");

    expect(failure.message).toBe("La squadra selezionata non è più disponibile. Scegline un'altra.");
    expect(failure.refetch).toBe(true);
  });

  it("nome non valido dal server: copy del campo", () => {
    expect(err("SOCIETY_GROUP_INVALID", { field: "name_required" }).message).toBe("Inserisci un nome per il gruppo.");
    expect(err("SOCIETY_GROUP_INVALID", { field: "name_too_long" }).message).toBe("Il nome può contenere fino a 80 caratteri.");
  });

  it("uscita: il server dice che serve la successione o che c'è una sola persona", () => {
    expect(err("SOCIETY_GROUP_LEAVE_REQUIRES_HANDOVER").kind).toBe("requires_handover");
    expect(err("SOCIETY_GROUP_LEAVE_ONLY_PERSON").message).toBe("Aggiungi almeno una persona al gruppo prima di lasciare.");
    expect(err("SOCIETY_GROUP_HANDOVER_NOT_REQUIRED").kind).toBe("handover_not_required");
  });

  it("rete e timeout: esito sconosciuto, la chiave dell'intenzione non si chiude", () => {
    const offline = err("NETWORK");
    const uncertain = err("TIMEOUT");

    expect(offline.message).toBe("Connessione assente. Riprova quando sei online.");
    expect(offline.settled).toBe(false);
    expect(uncertain.settled).toBe(false);
  });

  it("errore sconosciuto: copy del comando, nessun codice o ID", () => {
    expect(groupFailureOf({ code: "UNKNOWN", field: null, personIds: [], validIds: [] }, "rename", limits).message).toBe(
      "Non è stato possibile salvare il nome. Riprova.",
    );
    expect(groupFailureOf({ code: "UNKNOWN", field: null, personIds: [], validIds: [] }, "avatar", limits).message).toBe(
      "Non è stato possibile aggiornare l'immagine. Riprova.",
    );
    expect(groupFailureOf({ code: "UNKNOWN", field: null, personIds: [], validIds: [] }, "delete", limits).message).toBe(
      "Non è stato possibile eliminare il gruppo. Riprova.",
    );
  });

  it("errori di lettura: offline distinto dal generico", () => {
    expect(loadFailureOf({ code: "NETWORK" }, "people")).toBe("Connessione assente. Riprova quando sei online.");
    expect(loadFailureOf({ code: "UNKNOWN" }, "info")).toBe("Non è stato possibile caricare il gruppo. Riprova.");
    expect(loadFailureOf(null, "people")).toBe("Non è stato possibile caricare le persone. Riprova.");
  });
});

describe("copy esatta del §18, §19, §21, §23", () => {
  it("testi alla lettera", () => {
    expect(C.leaveTitle).toBe("Lasciare il gruppo?");
    expect(C.leaveBody).toBe("Non potrai più accedere alla conversazione.");
    expect(C.leaveReentry).toBe("Se verrai aggiunto di nuovo, vedrai i contenuti dal nuovo ingresso.");
    expect(C.handoverTitle).toBe("Prima di lasciare il gruppo");
    expect(C.handoverCta).toBe("Nomina amministratori e lascia");
    expect(C.archiveTitle).toBe("Archiviare il gruppo?");
    expect(C.deleteTitle).toBe("Eliminare definitivamente il gruppo?");
    expect(C.deleteConfirm).toBe("Elimina definitivamente");
    expect(C.deleteArchiveInstead).toBe("Archivia");
    expect(C.removeTitle("Riccardo Riva")).toBe("Rimuovere Riccardo Riva dal gruppo?");
    expect(C.removeBody).toBe("Non potrà più partecipare alla conversazione.");
  });
});
