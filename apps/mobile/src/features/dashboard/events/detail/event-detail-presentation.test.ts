/**
 * DAS-REV-29 §10, §14, §18–§21, §25: matrice di disponibilità, precedenza
 * fra stato evento e personale, avviso sugli anni, messaggio della non
 * accettazione e classificazione degli errori.
 */
import { describe, expect, it, vi } from "vitest";

import { SelectionEventsError } from "../events-service";
import {
  DETAIL_COPY,
  capacityLine,
  commandErrorCopy,
  decisionMessageError,
  eventYearsLabel,
  normalizeDecisionMessage,
  personMeta,
  personalView,
  registerSheetModel,
  timeRange,
  whenLines,
  withdrawSheetCopy,
} from "./event-detail-presentation";
import { mapDetail, mapPendingPreview, mapRequest } from "./event-detail-service";
import type { SelectionEventDetail } from "./event-detail-types";
import { buildEventUrl, isValidPublicId } from "./event-link";

/* vitest solleva vi.mock sopra gli import: `event-link` non carica il modulo nativo. */
vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));

/** Riga grezza del server: il mapper reale fa parte del test. */
function raw(patch: Record<string, unknown> = {}, availability: Record<string, unknown> = {}, personal: Record<string, unknown> = {}) {
  return {
    state: "available",
    public_id: "pubOpenDay2026AA",
    event_id: "e1",
    version: 3,
    club: { name: "AC Como", logo_url: null, is_verified: true },
    event_type: "open_day",
    title: "Open day Primavera",
    team_name: "Primavera",
    flyer: null,
    timezone: "Europe/Rome",
    start_date: "2026-09-30",
    start_time: "15:00:00",
    end_time: "18:00:00",
    venue_name: "Centro Sportivo Comunale",
    venue_address: "Via Roma 22, Como",
    description: "Una giornata per conoscere la nostra Primavera.",
    requirements_info: "Porta abbigliamento e scarpe da calcio.",
    birth_year_from: 2008,
    birth_year_to: 2009,
    registration_deadline_date: "2026-09-28",
    registration_deadline_time: "23:59:00",
    confirmation_mode: "automatic",
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
      effective_deadline: "2026-09-28T21:59:00Z",
      has_explicit_deadline: true,
      started: false,
      confirmation_mode: "automatic",
      max_participants: 50,
      is_full: false,
      can_submit_request: true,
      public_state: "open",
      next_transition_at: "2026-09-28T21:59:00Z",
      ...availability,
    },
    personal: {
      participation: null,
      capabilities: { register: true, withdraw: false, register_again: false },
      ineligible_reason: null,
      birth_year: 2008,
      birth_year_mismatch: false,
      ...personal,
    },
    ...patch,
  };
}

const detail = (...args: Parameters<typeof raw>): SelectionEventDetail => mapDetail(raw(...args));

const participation = (patch: Record<string, unknown>) => ({
  id: "p1",
  status: "pending",
  source: "registration",
  submitted_at: "2026-09-13T10:00:00Z",
  version: 1,
  ...patch,
});

describe("formattazione (§11)", () => {
  it("date civili con anno e orari, senza conversioni", () => {
    expect(whenLines(detail())).toEqual(["30 settembre 2026", "15:00 – 18:00"]);
    expect(timeRange("15:00", null)).toBe("15:00");
  });

  it("anni: intervallo o anno singolo, niente senza riferimento", () => {
    expect(eventYearsLabel(2008, 2009)).toBe("2008 - 2009");
    expect(eventYearsLabel(2008, 2008)).toBe("2008");
    expect(eventYearsLabel(null, null)).toBeNull();
  });

  it("capienza: persona solo con limite, Società anche senza", () => {
    expect(capacityLine(detail())).toBe("32 / 50 confermati");
    expect(capacityLine(detail({ max_participants: null, confirmed_count: null }))).toBeNull();
    expect(
      capacityLine(
        detail({
          max_participants: null,
          confirmed_count: null,
          management: { confirmed_count: 7, pending_requests_count: 2, can_edit: true, can_decide: true, can_share: true },
        }),
      ),
    ).toBe("7 confermati");
  });

  it("persona: «Calciatore · Classe 2008»", () => {
    expect(personMeta("player", 2008)).toBe("Calciatore · Classe 2008");
    expect(personMeta(null, null)).toBe("");
  });
});

describe("matrice senza partecipazione (§10)", () => {
  it("aperto automatico: Iscriviti e Conferma automatica (screen 08)", () => {
    const view = personalView(detail());

    expect(view.action?.kind).toBe("register");
    expect(view.eventNotice).toBeNull();
    expect(view.modeLine?.label).toBe(DETAIL_COPY.modeAutomatic);
  });

  it("aperto manuale: Iscriviti con la spiegazione della Società", () => {
    const view = personalView(detail({ confirmation_mode: "manual" }, { confirmation_mode: "manual" }));

    expect(view.modeLine).toEqual({ helper: DETAIL_COPY.modeManualHelper, label: DETAIL_COPY.modeManual });
  });

  it("pieno automatico: Posti esauriti, nessuna CTA (QA-052)", () => {
    const view = personalView(
      detail({}, { is_full: true, public_state: "full", can_submit_request: false }, { capabilities: { register: false } }),
    );

    expect(view.action).toBeNull();
    expect(view.eventNotice?.title).toBe(DETAIL_COPY.fullTitle);
    expect(view.eventNotice?.lines).toEqual([DETAIL_COPY.fullAutomaticBody]);
  });

  it("pieno manuale aperto: avviso e richiesta ancora possibile (QA-054)", () => {
    const view = personalView(
      detail({ confirmation_mode: "manual" }, { confirmation_mode: "manual", is_full: true, public_state: "open_full_manual" }),
    );

    expect(view.action?.kind).toBe("register");
    expect(view.eventNotice?.lines).toEqual([DETAIL_COPY.fullManualBody]);
  });

  it("termine passato: Iscrizioni chiuse, nessuna CTA (QA-056)", () => {
    const view = personalView(
      detail({}, { registration_open: false, public_state: "closed", can_submit_request: false }, { capabilities: { register: false } }),
    );

    expect(view.action).toBeNull();
    expect(view.eventNotice?.title).toBe(DETAIL_COPY.closedTitle);
    expect(view.modeLine).toBeNull();
  });

  it("profilo non autorizzato: spiegazione, nessuna CTA (QA-063)", () => {
    const view = personalView(
      detail({}, {}, { ineligible_reason: "not_sports_profile", capabilities: { register: false } }),
    );

    expect(view.action).toBeNull();
    expect(view.eventNotice?.lines).toEqual([DETAIL_COPY.notEligible]);
  });

  it("identità Società/Media: nessuna azione personale, spiegazione (QA-062)", () => {
    const view = personalView(detail(), { canActPersonally: false });

    expect(view.action).toBeNull();
    expect(view.eventNotice?.lines).toEqual([DETAIL_COPY.notEligible]);
  });

  it("identità Società: lo stato personale resta leggibile senza ritiro", () => {
    const view = personalView(
      detail({}, {}, { participation: participation({ status: "confirmed" }), capabilities: { withdraw: true } }),
      { canActPersonally: false },
    );

    expect(view.status?.title).toBe(DETAIL_COPY.confirmedTitle);
    expect(view.action).toBeNull();
  });

  it("copy vietata assente", () => {
    const text = JSON.stringify(DETAIL_COPY);

    for (const banned of ["Prenota", "Il tuo posto", "Lista d", "Ti avviseremo"]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("precedenza dello stato personale (§20)", () => {
  it("CONFIRMED con evento pieno: confermata, non Posti esauriti (QA-101)", () => {
    const view = personalView(
      detail(
        {},
        { is_full: true, public_state: "full" },
        { participation: participation({ status: "confirmed", confirmed_at: "x" }), capabilities: { withdraw: true } },
      ),
    );

    expect(view.status?.title).toBe(DETAIL_COPY.confirmedTitle);
    expect(view.action).toEqual({ kind: "cancel_participation", label: DETAIL_COPY.cancelParticipation });
    expect(view.eventNotice).toBeNull();
  });

  it("PENDING a capienza piena: nessun posto riservato (screen 12)", () => {
    const view = personalView(
      detail({}, { is_full: true }, { participation: participation({}), capabilities: { withdraw: true } }),
    );

    expect(view.status?.lines).toEqual([DETAIL_COPY.pendingBody, DETAIL_COPY.pendingNoSeat]);
    expect(view.action?.kind).toBe("withdraw_request");
  });

  it("ritirata con reiscrizione possibile (screen 14)", () => {
    const view = personalView(
      detail({}, {}, {
        participation: participation({ status: "withdrawn", withdrawn_from: "pending", withdrawn_at: "x" }),
        capabilities: { register_again: true },
      }),
    );

    expect(view.status?.title).toBe(DETAIL_COPY.withdrawnRequestTitle);
    expect(view.action?.kind).toBe("register_again");
  });

  it("partecipazione annullata dopo la conferma: titolo dalla transizione", () => {
    const view = personalView(
      detail({}, {}, { participation: participation({ status: "withdrawn", withdrawn_from: "confirmed" }) }),
    );

    expect(view.status?.title).toBe(DETAIL_COPY.cancelledParticipationTitle);
  });

  it("REJECTED con messaggio: blocco Messaggio di AC Como, nessuna CTA (screen 15)", () => {
    const view = personalView(
      detail({}, {}, {
        participation: participation({ status: "rejected", decision_message: "Gruppo completo." }),
        capabilities: { register: false },
      }),
    );

    expect(view.status?.title).toBe(DETAIL_COPY.rejectedTitle);
    expect(view.message).toEqual({ body: "Gruppo completo.", title: "Messaggio di AC Como" });
    expect(view.action).toBeNull();
  });

  it("REJECTED senza messaggio: nessun blocco vuoto (QA-103)", () => {
    const view = personalView(detail({}, {}, { participation: participation({ status: "rejected" }) }));

    expect(view.message).toBeNull();
  });

  it("evento annullato dominante, storico senza azioni (QA-105)", () => {
    const view = personalView(
      detail(
        { status: "cancelled" },
        { lifecycle: "cancelled", public_state: "cancelled" },
        { participation: participation({ status: "confirmed" }), capabilities: { withdraw: false } },
      ),
    );

    expect(view.eventNotice?.title).toBe(DETAIL_COPY.cancelledTitle);
    expect(view.status?.title).toBe(DETAIL_COPY.confirmedTitle);
    expect(view.action).toBeNull();
  });

  it("evento concluso dominante (QA-106)", () => {
    const view = personalView(detail({ status: "completed" }, { public_state: "completed" }));

    expect(view.eventNotice?.title).toBe(DETAIL_COPY.completedTitle);
    expect(view.action).toBeNull();
  });
});

describe("sheet (§14, §19)", () => {
  it("anno nel riferimento: nessun avviso, nessun «Idoneo» (QA-067)", () => {
    const model = registerSheetModel(detail());

    expect(model.yearsWarning).toBeNull();
    expect(JSON.stringify(model)).not.toContain("Idoneo");
    expect(model.notes).toEqual([DETAIL_COPY.sheetProfileNote]);
  });

  it("anno fuori riferimento: avviso non bloccante (QA-068)", () => {
    const model = registerSheetModel(detail({}, {}, { birth_year: 2007, birth_year_mismatch: true }));

    expect(model.yearsWarning?.lines).toEqual([DETAIL_COPY.sheetYearsWarning, DETAIL_COPY.sheetYearsProceed]);
    expect(model.confirmLabel).toBe(DETAIL_COPY.sheetConfirm);
  });

  it("manuale pieno: la stessa spiegazione di §10 prima dell'invio", () => {
    const model = registerSheetModel(
      detail({ confirmation_mode: "manual" }, { confirmation_mode: "manual", is_full: true }),
    );

    expect(model.notes).toEqual([DETAIL_COPY.sheetProfileNote, DETAIL_COPY.sheetManualNote, DETAIL_COPY.fullManualBody]);
  });

  it("ritiro: copy diversa per richiesta e partecipazione", () => {
    expect(withdrawSheetCopy("pending").title).toBe("Ritirare la richiesta?");
    expect(withdrawSheetCopy("confirmed").title).toBe("Annullare la partecipazione?");
  });
});

describe("messaggio della non accettazione (§18, QA-088)", () => {
  it("solo spazi → null", () => {
    expect(normalizeDecisionMessage("   ")).toBeNull();
    expect(normalizeDecisionMessage("  ciao ")).toBe("ciao");
  });

  it("oltre il limite: errore, testo conservato dal chiamante", () => {
    expect(decisionMessageError("x".repeat(501), 500)).toContain("500");
    expect(decisionMessageError("x".repeat(500), 500)).toBeNull();
  });
});

describe("errori dei comandi (§21, §25)", () => {
  it("rete: esito incerto, la chiave resta", () => {
    expect(commandErrorCopy(new SelectionEventsError("NETWORK"), "register").uncertain).toBe(true);
    expect(commandErrorCopy(new SelectionEventsError("TIMEOUT"), "register").uncertain).toBe(true);
  });

  it("posto occupato: Posti esauriti e rilettura (QA-076)", () => {
    const copy = commandErrorCopy(new SelectionEventsError("SELECTION_EVENT_FULL"), "register");

    expect(copy.message).toContain(DETAIL_COPY.fullTitle);
    expect(copy.refresh).toBe(true);
  });

  it("decisione a capienza piena: Non ci sono posti disponibili", () => {
    expect(commandErrorCopy(new SelectionEventsError("SELECTION_EVENT_FULL"), "decision").message).toBe(DETAIL_COPY.noSeats);
  });

  it("conflitto: richiesta aggiornata, rilettura", () => {
    const copy = commandErrorCopy(new SelectionEventsError("SELECTION_EVENT_PARTICIPATION_CHANGED"), "decision");

    expect(copy.message).toBe(DETAIL_COPY.changed);
    expect(copy.refresh).toBe(true);
  });

  it("errore sconosciuto: copy del comando, nessun codice grezzo", () => {
    expect(commandErrorCopy(new Error("boom"), "withdraw").message).toBe(DETAIL_COPY.participationError);
  });
});

describe("mapper e link", () => {
  it("dettaglio non disponibile: errore di autorizzazione, non un oggetto vuoto", () => {
    expect(() => mapDetail({ state: "unavailable" })).toThrow(SelectionEventsError);
  });

  it("stato pubblico sconosciuto → prudente «closed»", () => {
    expect(detail({}, { public_state: "boh" }).availability.publicState).toBe("closed");
  });

  it("preview: righe valide in ordine, totale privato", () => {
    const preview = mapPendingPreview({
      total: 4,
      items: [{ participation_id: "p1", full_name: "Mario Rossi", role: "player", birth_year: 2008, version: 2 }, { full_name: "senza id" }],
    });

    expect(preview.total).toBe(4);
    expect(preview.items.map((item) => item.participationId)).toEqual(["p1"]);
  });

  it("richiesta: capability e motivo di blocco", () => {
    const request = mapRequest({
      participation_id: "p1",
      status: "pending",
      version: 2,
      person: { id: "u1", full_name: "Mario Rossi", role: "player", birth_year: 2008 },
      event: { id: "e1", title: "Open day Primavera", max_participants: 50, confirmed_count: 50, is_full: true },
      capabilities: { confirm: false, reject: true, confirm_blocked_reason: "full" },
    });

    expect(request.capabilities).toEqual({ confirm: false, confirmBlockedReason: "full", reject: true });
  });

  it("URL canonico: origine configurata o schema dell'app, mai un dominio inventato", () => {
    expect(buildEventUrl("pubOpenDay2026AA", "https://example.test/")).toBe("https://example.test/event/pubOpenDay2026AA");
    expect(buildEventUrl("pubOpenDay2026AA", "")).toBe("footme://event/pubOpenDay2026AA");
  });

  it("identificatore pubblico: allowlist (QA-040)", () => {
    expect(isValidPublicId("pubOpenDay2026AA")).toBe(true);
    expect(isValidPublicId("../../admin")).toBe(false);
    expect(isValidPublicId("https://evil.test")).toBe(false);
    expect(isValidPublicId(null)).toBe(false);
  });
});
