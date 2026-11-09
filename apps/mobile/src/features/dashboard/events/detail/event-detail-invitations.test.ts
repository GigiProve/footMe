/**
 * DAS-REV-30 §8, §18–§20, §29: lato destinatario e lato Società del
 * dettaglio evento. Le righe grezze passano dal mapper reale, così il test
 * copre anche la mappatura degli stati nuovi.
 */
import { describe, expect, it, vi } from "vitest";

import { SelectionEventsError } from "../events-service";
import {
  DETAIL_COPY,
  commandErrorCopy,
  participantsSummaryRows,
  personalView,
  societyActions,
} from "./event-detail-presentation";
import { mapCommand, mapDetail, participationStatus } from "./event-detail-service";

vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));

function raw(personal: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) {
  return {
    state: "available",
    public_id: "pubOpenDay2026AA",
    event_id: "e1",
    version: 3,
    club: { name: "AC Como", logo_url: null, is_verified: true },
    event_type: "open_day",
    title: "Open day Primavera",
    team_name: "Primavera",
    timezone: "Europe/Rome",
    start_date: "2026-09-30",
    start_time: "15:00:00",
    end_time: "18:00:00",
    venue_name: "Centro Sportivo Comunale",
    venue_address: "Via Roma 22, Como",
    max_participants: 50,
    confirmed_count: 32,
    status: "published",
    participation_mode: "open_registration",
    club_id: "c1",
    team_id: "t1",
    landing_visible: true,
    management: null,
    availability: {
      lifecycle: "published",
      registration_open: true,
      confirmation_mode: "manual",
      max_participants: 50,
      is_full: false,
      can_submit_request: true,
      public_state: "open",
    },
    personal: {
      participation: null,
      capabilities: { register: false, withdraw: false, register_again: false, accept: false, decline: false },
      ineligible_reason: null,
      birth_year: 2008,
      birth_year_mismatch: false,
      ...personal,
    },
    ...patch,
  };
}

const invited = (patch: Record<string, unknown> = {}) => ({
  id: "p1",
  status: "invited",
  source: "invitation",
  invited_at: "2026-09-24T10:00:00Z",
  invitation_message: "Ci farebbe piacere averti con noi per questa giornata.",
  invitation_generation: 1,
  version: 4,
  ...patch,
});

describe("destinatario dell'invito (§18, screen 07-09)", () => {
  it("invito ricevuto: messaggio, helper, Accetta primaria e Rifiuta, mai Iscriviti", () => {
    const view = personalView(
      mapDetail(raw({ participation: invited(), capabilities: { accept: true, decline: true, register: false } })),
    );

    expect(view.status?.title).toBe("Sei stato invitato");
    expect(view.message).toEqual({
      body: "Ci farebbe piacere averti con noi per questa giornata.",
      title: "Messaggio di AC Como",
    });
    expect(view.helper).toBe(DETAIL_COPY.invitedHelper);
    expect(view.action).toEqual({ disabled: false, kind: "accept_invitation", label: "Accetta invito" });
    expect(view.secondaryAction).toEqual({ kind: "decline_invitation", label: "Rifiuta" });
  });

  it("messaggio assente: nessun blocco «Messaggio di …»", () => {
    const view = personalView(
      mapDetail(raw({ participation: invited({ invitation_message: null }), capabilities: { accept: true, decline: true } })),
    );

    expect(view.message).toBeNull();
  });

  it("capienza piena: INVITED conservato, Accetta disabilitata con motivo, Rifiuta disponibile (QA-065)", () => {
    const view = personalView(
      mapDetail(
        raw({
          participation: invited(),
          capabilities: { accept: false, accept_blocked_reason: "full", decline: true },
        }),
      ),
    );

    expect(view.action).toMatchObject({ disabled: true, kind: "accept_invitation" });
    expect(view.eventNotice?.title).toBe("Posti esauriti");
    expect(view.eventNotice?.lines).toEqual([DETAIL_COPY.fullInviteBody]);
    expect(view.helper).toBeNull();
    expect(view.secondaryAction?.kind).toBe("decline_invitation");
  });

  it("accettato: «Partecipazione confermata» con la Società, e Annulla partecipazione (screen 08)", () => {
    const view = personalView(
      mapDetail(
        raw({
          participation: invited({ status: "confirmed", confirmation_source: "invitation", invitation_message: null }),
          capabilities: { withdraw: true },
        }),
      ),
    );

    expect(view.status).toMatchObject({ lines: ["Hai accettato l’invito di AC Como."], title: "Partecipazione confermata" });
    expect(view.action?.kind).toBe("cancel_participation");
  });

  it("revocato su OPEN aperto: avviso e Iscriviti come nuova richiesta (screen 21)", () => {
    const view = personalView(
      mapDetail(raw({ participation: invited({ status: "revoked" }), capabilities: { register_again: true } })),
    );

    expect(view.status?.title).toBe("Invito non più disponibile");
    expect(view.status?.lines).toEqual(["AC Como ha ritirato il tuo invito.", DETAIL_COPY.canRequestAgain]);
    expect(view.action).toEqual({ kind: "register_again", label: "Iscriviti" });
    /* §9: il vecchio messaggio dell'invito non resta corrente. */
    expect(view.message).toBeNull();
  });

  it("revocato senza finestra aperta: nessuna azione (QA-113)", () => {
    const view = personalView(
      mapDetail(raw({ participation: invited({ status: "revoked" }), capabilities: { register_again: false } })),
    );

    expect(view.action).toBeNull();
  });

  it("rimosso: messaggio di rimozione, nessuna reiscrizione (screen 22)", () => {
    const view = personalView(
      mapDetail(
        raw({
          participation: invited({ status: "removed", removal_message: "Non potrai partecipare a questa giornata." }),
          capabilities: { register_again: false },
        }),
      ),
    );

    expect(view.status?.title).toBe("Partecipazione annullata");
    expect(view.message?.body).toBe("Non potrai partecipare a questa giornata.");
    expect(view.action).toBeNull();
  });

  it("rifiutato: «Invito rifiutato»", () => {
    const view = personalView(mapDetail(raw({ participation: invited({ status: "declined" }) })));

    expect(view.status?.title).toBe("Invito rifiutato");
  });

  it("identità Società: niente Accetta né Rifiuta (§12)", () => {
    const view = personalView(
      mapDetail(raw({ participation: invited(), capabilities: { accept: true, decline: true } })),
      { canActPersonally: false },
    );

    expect(view.action).toBeNull();
    expect(view.secondaryAction).toBeNull();
    expect(view.helper).toBeNull();
  });

  it("evento concluso prevale: storico leggibile, nessuna azione (§19)", () => {
    const view = personalView(
      mapDetail(raw({ participation: invited(), capabilities: { accept: true, decline: true } }, { status: "completed" })),
    );

    expect(view.action).toBeNull();
    expect(view.secondaryAction).toBeNull();
    /* DAS-REV-31 §19, screen 12: lo stato dell'evento è la pillola sopra il
       titolo; nessun «Sei stato invitato» né messaggio d'invito come attuali. */
    expect(view.status).toBeNull();
    expect(view.message).toBeNull();
    expect(view.helper).toBeNull();
  });
});

describe("stati e comandi (§9, QA-150)", () => {
  it("gli otto stati canonici si mappano; uno sconosciuto cade", () => {
    for (const status of ["pending", "confirmed", "rejected", "withdrawn", "invited", "declined", "revoked", "removed"]) {
      expect(participationStatus(status)).toBe(status);
    }

    expect(participationStatus("expired")).toBeNull();
    expect(mapDetail(raw({ participation: invited({ status: "expired" }) })).personal.participation).toBeNull();
  });

  it("esiti dei comandi nuovi", () => {
    expect(mapCommand({ outcome: "invitation_accepted", status: "confirmed", version: 5 }).outcome).toBe(
      "invitation_accepted",
    );
    expect(mapCommand({ outcome: "already_invited", status: "invited" }).status).toBe("invited");
  });

  it("accettazione a pieno: messaggio di dominio, non errore di rete", () => {
    const copy = commandErrorCopy(new SelectionEventsError("SELECTION_EVENT_FULL"), "accept");

    expect(copy.message).toBe(`Posti esauriti. ${DETAIL_COPY.fullInviteBody}`);
    expect(copy.refresh).toBe(true);
  });

  it("invito già revocato: stato corrente riletto (§29)", () => {
    const copy = commandErrorCopy(new SelectionEventsError("SELECTION_EVENT_PARTICIPATION_CHANGED"), "accept");

    expect(copy).toEqual({ message: DETAIL_COPY.invitationGone, refresh: true, uncertain: false });
  });

  it("errore generico: copy della task", () => {
    expect(commandErrorCopy(new Error("boom"), "accept").message).toBe("Impossibile accettare l’invito. Riprova.");
    expect(commandErrorCopy(new Error("boom"), "invitation").message).toBe("Impossibile aggiornare l’invito. Riprova.");
  });
});

describe("Società (§8, screen 01)", () => {
  const management = (patch: Record<string, unknown> = {}) => ({
    can_decide: true,
    can_edit: true,
    can_share: true,
    can_invite: true,
    can_manage_participants: true,
    can_read_participants: true,
    confirmed_count: 32,
    pending_requests_count: 8,
    participants: { confirmed_count: 32, pending_count: 8, invited_count: 12 },
    invite_blocked_reason: null,
    ...patch,
  });

  it("con l'invito: Invita profili primaria, copia/condividi secondarie dirette", () => {
    const actions = societyActions(mapDetail(raw({}, { management: management() })), "https://x/event/abc");

    expect(actions.canInvite).toBe(true);
    expect(actions.shareIsPrimary).toBe(false);
    expect(actions.canShare && actions.canCopy).toBe(true);
  });

  it("senza invito: torna la gerarchia della 29", () => {
    const actions = societyActions(
      mapDetail(raw({}, { management: management({ can_invite: false }) })),
      "https://x/event/abc",
    );

    expect(actions.shareIsPrimary).toBe(true);
    expect(actions.inviteFullNotice).toBeNull();
  });

  it("DAS-REV-31 §15: evento iniziato, Condividi non è più la CTA primaria", () => {
    const actions = societyActions(
      mapDetail(
        raw({}, {
          lifecycle: { status: "published", is_started: true, completion_due_at: null, completed_at: null, cancelled_at: null },
          management: management({ can_invite: false }),
        }),
      ),
      "https://x/event/abc",
    );

    expect(actions.shareIsPrimary).toBe(false);
    expect(actions.canShare).toBe(true);
  });

  it("pieno: nessun nuovo invito, spiegazione sobria", () => {
    const actions = societyActions(
      mapDetail(raw({}, { management: management({ can_invite: false, invite_blocked_reason: "full" }) })),
      null,
    );

    expect(actions.canInvite).toBe(false);
    expect(actions.inviteFullNotice).toBe(DETAIL_COPY.inviteFullNotice);
  });

  it("tre count distinti solo con la lettura partecipanti (§8, QA-003)", () => {
    const withRead = mapDetail(raw({}, { management: management() }));
    const inviteOnly = mapDetail(
      raw({}, { management: management({ participants: null, can_read_participants: false, pending_requests_count: null }) }),
    );

    expect(withRead.management?.participants).toEqual({ confirmedCount: 32, invitedCount: 12, pendingCount: 8 });
    expect(inviteOnly.management?.participants).toBeNull();
  });

  it("righe del riepilogo, singolare e plurale", () => {
    expect(participantsSummaryRows({ confirmedCount: 32, invitedCount: 12, pendingCount: 8 }).map((r) => r.label)).toEqual([
      "32 confermati",
      "8 richieste in attesa",
      "12 inviti inviati",
    ]);
    expect(participantsSummaryRows({ confirmedCount: 1, invitedCount: 1, pendingCount: 1 }).map((r) => r.label)).toEqual([
      "1 confermato",
      "1 richiesta in attesa",
      "1 invito inviato",
    ]);
  });
});
