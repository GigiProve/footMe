/**
 * Contratto client delle RPC di gestione (DAS-REV-33 §25): errori dal server,
 * capability e mapper. Nessuna rete: solo la traduzione di ciò che il server
 * restituisce.
 */
import { describe, expect, it } from "vitest";

import {
  GroupsError,
  mapArchivedRow,
  mapCapabilities,
  mapCommandResult,
  mapGroupManagement,
  mapMembersPage,
  toGroupsError,
} from "./groups-service";
import { NO_GROUP_CAPABILITIES } from "./groups-types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("errori del server → GroupsError (§25)", () => {
  it("TARGETS_UNAVAILABLE: ID non validi nel messaggio, ID validi in details", () => {
    const error = toGroupsError({ details: `${B},${C}`, message: `SOCIETY_GROUP_TARGETS_UNAVAILABLE:${A}` });

    expect(error.code).toBe("SOCIETY_GROUP_TARGETS_UNAVAILABLE");
    expect(error.personIds).toEqual([A]);
    expect(error.validIds).toEqual([B, C]);
  });

  it("TARGETS_UNAVAILABLE senza details: nessun ID valido inventato", () => {
    const error = toGroupsError({ message: `SOCIETY_GROUP_TARGETS_UNAVAILABLE:${A},${B}` });

    expect(error.personIds).toEqual([A, B]);
    expect(error.validIds).toEqual([]);
  });

  it("HANDOVER_NOT_REQUIRED porta il motivo", () => {
    const error = toGroupsError({ details: "OTHER_ADMIN", message: "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED" });

    expect(error.code).toBe("SOCIETY_GROUP_HANDOVER_NOT_REQUIRED");
    expect(error.field).toBe("OTHER_ADMIN");
  });

  it.each([
    "SOCIETY_GROUP_ARCHIVED",
    "SOCIETY_GROUP_DELETED",
    "SOCIETY_GROUP_FORBIDDEN",
    "SOCIETY_GROUP_LAST_ADMIN",
    "SOCIETY_GROUP_LEAVE_ONLY_PERSON",
    "SOCIETY_GROUP_LEAVE_REQUIRES_HANDOVER",
    "SOCIETY_GROUP_NOT_MEMBER",
    "SOCIETY_GROUP_PERIOD_ENDED",
    "SOCIETY_GROUP_REACTIVATE_REQUIRES_ADMIN",
    "SOCIETY_GROUP_TEAM_UNAVAILABLE",
    "SOCIETY_GROUP_VERSION_CONFLICT",
  ])("%s è riconosciuto dal messaggio", (code) => {
    expect(toGroupsError({ message: code }).code).toBe(code);
  });

  it("SOCIETY_GROUP_INVALID porta il campo", () => {
    const error = toGroupsError({ message: "SOCIETY_GROUP_INVALID:name_too_long" });

    expect(error.code).toBe("SOCIETY_GROUP_INVALID");
    expect(error.field).toBe("name_too_long");
  });

  it("un GroupsError già tradotto resta tale", () => {
    const error = new GroupsError("SOCIETY_GROUP_LAST_ADMIN");

    expect(toGroupsError(error)).toBe(error);
  });
});

describe("accesso perso (§17, §23, §26)", () => {
  it("eliminato, non membro e non trovato chiudono la superficie", () => {
    expect(new GroupsError("SOCIETY_GROUP_DELETED").isAccessLost).toBe(true);
    expect(new GroupsError("SOCIETY_GROUP_NOT_MEMBER").isAccessLost).toBe(true);
    expect(new GroupsError("SOCIETY_GROUP_NOT_FOUND").isAccessLost).toBe(true);
  });

  it("una regola di dominio non è una perdita d'accesso", () => {
    expect(new GroupsError("SOCIETY_GROUP_LAST_ADMIN").isAccessLost).toBe(false);
    expect(new GroupsError("SOCIETY_GROUP_VERSION_CONFLICT").isAccessLost).toBe(false);
    expect(new GroupsError("NETWORK").isAccessLost).toBe(false);
  });
});

describe("capability (§5)", () => {
  it("le 13 chiavi del server", () => {
    const caps = mapCapabilities({
      can_access_conversation: true,
      can_archive: true,
      can_delete: true,
      can_edit_avatar: true,
      can_edit_name: true,
      can_edit_team: true,
      can_leave: true,
      can_manage_admins: true,
      can_manage_people: true,
      can_reactivate: true,
      can_recover: true,
      can_view_info: true,
      can_view_people: true,
    });

    expect(Object.keys(caps)).toHaveLength(13);
    expect(Object.values(caps).every((value) => value === true)).toBe(true);
  });

  it("assenti o non booleane = false: nessuna capability dedotta", () => {
    expect(mapCapabilities(undefined)).toEqual(NO_GROUP_CAPABILITIES);
    expect(mapCapabilities({ can_delete: "true", can_leave: 1 }).canDelete).toBe(false);
    expect(mapCapabilities({ can_delete: "true", can_leave: 1 }).canLeave).toBe(false);
  });
});

describe("mapper della gestione", () => {
  it("fixture base: Staff Primavera, quattro persone, un ADMIN, ADMIN viewer", () => {
    const m = mapGroupManagement({
      admin_count: 1,
      archived_at: null,
      avatar_path: null,
      capabilities: { can_edit_name: true, can_leave: true, can_view_info: true },
      club_id: A,
      club_is_verified: true,
      club_name: "AC Como",
      conversation_id: B,
      created_at: "2026-09-13T10:00:00Z",
      leave_path: "handover",
      limits: { nameMax: 80 },
      my_period_id: C,
      my_period_version: 2,
      my_role: "admin",
      name: "Staff Primavera",
      people_count: 4,
      status: "active",
      team_id: A,
      team_name: "Primavera",
      version: 7,
    });

    expect(m).toMatchObject({
      adminCount: 1,
      clubIsVerified: true,
      clubName: "AC Como",
      leavePath: "handover",
      myPeriodId: C,
      myPeriodVersion: 2,
      myRole: "admin",
      name: "Staff Primavera",
      peopleCount: 4,
      status: "active",
      teamName: "Primavera",
      version: 7,
    });
    expect(m.capabilities.canEditName).toBe(true);
    expect(m.capabilities.canDelete).toBe(false);
    expect(m.limits.nameMax).toBe(80);
  });

  it("manager non membro: nessun ruolo, nessun periodo, nessun percorso di uscita", () => {
    const m = mapGroupManagement({
      club_id: A,
      conversation_id: B,
      my_period_id: null,
      my_role: null,
      status: "archived",
      version: 3,
    });

    expect(m.myRole).toBeNull();
    expect(m.myPeriodId).toBeNull();
    expect(m.myPeriodVersion).toBeNull();
    expect(m.leavePath).toBeNull();
    expect(m.status).toBe("archived");
  });

  it("percorso di uscita sconosciuto = nessuno", () => {
    expect(mapGroupManagement({ club_id: A, conversation_id: B, leave_path: "boh" }).leavePath).toBeNull();
  });

  it("pagina Persone: righe con periodo e flag, conteggi del server", () => {
    const page = mapMembersPage({
      admin_count: 1,
      capabilities: { can_manage_people: true },
      items: [
        {
          can_demote: false,
          can_promote: false,
          can_remove: false,
          full_name: "Giuseppe Conti",
          is_me: true,
          member_role: "admin",
          period_id: A,
          period_version: 1,
          profile_id: B,
          role_label: null,
        },
        { can_promote: true, can_remove: true, full_name: "Mister Bianchi", member_role: "member", period_id: C, period_version: 4, profile_id: A },
      ],
      next_cursor: "opaco",
      other_count: 3,
      people_count: 4,
      status: "active",
    });

    expect(page).toMatchObject({ adminCount: 1, nextCursor: "opaco", otherCount: 3, peopleCount: 4, status: "active" });
    expect(page.items[0]).toMatchObject({ isMe: true, memberRole: "admin", periodId: A, periodVersion: 1 });
    expect(page.items[1]).toMatchObject({ canPromote: true, canRemove: true, memberRole: "member", periodVersion: 4 });
    expect(page.capabilities.canManagePeople).toBe(true);
  });

  it("riga archiviata: needs_recovery e flag, nessun campo chat", () => {
    const row = mapArchivedRow({
      admin_count: 0,
      avatar_path: "club/asset.jpg",
      can_delete: true,
      can_manage: true,
      conversation_id: A,
      name: "Staff Primavera",
      needs_recovery: true,
      people_count: 3,
      team_id: B,
      team_name: "Primavera",
    });

    expect(row).toMatchObject({ adminCount: 0, canDelete: true, needsRecovery: true, peopleCount: 3 });
    expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["lastMessage", "unread", "preview"]));
  });
});

describe("esito dei comandi (§25)", () => {
  it("aggiunta: ID aggiunti e già attivi; replay dichiarato", () => {
    const result = mapCommandResult({
      added: 2,
      added_ids: [A, B],
      already_active_ids: [C],
      changed: true,
      replayed: true,
      version: 9,
    });

    expect(result).toMatchObject({ added: 2, addedIds: [A, B], alreadyActiveIds: [C], changed: true, replayed: true, version: 9 });
  });

  it("uscita di riconciliazione: changed falso con periodo chiuso", () => {
    const result = mapCommandResult({ changed: false, period_ended: true });

    expect(result).toMatchObject({ changed: false, periodChanged: false, periodEnded: true, replayed: false });
  });

  it("successione: ID promossi", () => {
    expect(mapCommandResult({ changed: true, period_ended: true, promoted_ids: [A, B] }).promotedIds).toEqual([A, B]);
  });

  it("archivia/riattiva: stato; elimina: deleted", () => {
    expect(mapCommandResult({ status: "archived", version: 2 }).status).toBe("archived");
    expect(mapCommandResult({ status: "active", version: 3 }).status).toBe("active");
    expect(mapCommandResult({ deleted: true }).deleted).toBe(true);
  });

  it("risposta vuota: valori neutri, nessun successo inventato", () => {
    expect(mapCommandResult(null)).toMatchObject({ added: 0, changed: false, deleted: false, replayed: false, status: null, version: null });
  });
});
