/**
 * Selector Notifiche (DAS-REV-34 §8, §9, §25): opzioni esatte, valore della
 * riga, scarto delle risposte vecchie e classificazione degli errori.
 */
import { describe, expect, it } from "vitest";

import {
  canChangeMute,
  classifyMuteError,
  isMuteAccessLost,
  isNoopChoice,
  isSettledMuteError,
  MUTE_OPTIONS,
  muteChoiceOf,
  muteRowA11yLabel,
  muteValueLabel,
  NOTIFICATIONS_COPY,
  parseNotificationState,
  shouldApplyState,
  stateMatchesChoice,
} from "./mute-presentation";
import type { ConversationNotificationState } from "./mute-types";

const state = (patch: Partial<ConversationNotificationState> = {}): ConversationNotificationState => ({
  canChange: true,
  conversationId: "c1",
  conversationType: "group",
  isMuted: false,
  muteOption: null,
  mutedUntil: null,
  periodId: "p1",
  stateVersion: 1,
  ...patch,
});

describe("opzioni V1 (§9, QA-021, QA-022)", () => {
  it("sono esattamente cinque, con i testi e l'ordine della tavola", () => {
    expect(MUTE_OPTIONS.map((option) => option.label)).toEqual([
      "Attive",
      "Silenzia per 1 ora",
      "Silenzia per 8 ore",
      "Silenzia per 1 settimana",
      "Silenzia finché non le riattivi",
    ]);
    expect(MUTE_OPTIONS.map((option) => option.value)).toEqual(["active", "1h", "8h", "1w", "indefinite"]);
  });

  it("nessuna opzione avanzata (menzioni, amministratori, priorità, keyword, orario)", () => {
    const labels = MUTE_OPTIONS.map((option) => option.label.toLowerCase()).join(" ");

    for (const forbidden of ["menzion", "amministrator", "important", "keyword", "orario", "personalizz"]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("titolo, helper ed errore hanno il copy della specifica", () => {
    expect(NOTIFICATIONS_COPY.title).toBe("Notifiche");
    expect(NOTIFICATIONS_COPY.helper).toBe("I messaggi continueranno ad arrivare.");
    expect(NOTIFICATIONS_COPY.error).toBe("Non è stato possibile aggiornare le notifiche. Riprova.");
  });
});

describe("valore della riga e label accessibile (§8, §29)", () => {
  it("«Attive» senza mute, «Silenziose» con mute effettivo", () => {
    expect(muteValueLabel(state())).toBe("Attive");
    expect(muteValueLabel(null)).toBe("Attive");
    expect(muteValueLabel(state({ isMuted: true, muteOption: "8h" }))).toBe("Silenziose");
  });

  it("un mute scaduto (is_muted false, opzione residua) vale Attive", () => {
    const expired = state({ isMuted: false, muteOption: "1h", mutedUntil: "2026-11-17T08:00:00Z" });

    expect(muteChoiceOf(expired)).toBe("active");
    expect(muteValueLabel(expired)).toBe("Attive");
  });

  it("la label porta lo stato a parole", () => {
    expect(muteRowA11yLabel(state())).toBe("Notifiche, Attive");
    expect(muteRowA11yLabel(state({ isMuted: true, muteOption: "indefinite" }))).toBe("Notifiche, Silenziose");
  });

  it("la scelta selezionata riflette l'opzione del server", () => {
    expect(muteChoiceOf(state({ isMuted: true, muteOption: "8h" }))).toBe("8h");
    expect(muteChoiceOf(state({ isMuted: true, muteOption: "1w" }))).toBe("1w");
    expect(muteChoiceOf(state({ isMuted: true, muteOption: "indefinite" }))).toBe("indefinite");
    expect(muteChoiceOf(null)).toBe("active");
  });

  it("la modifica dipende da `can_change` del server, non dall'archiviazione", () => {
    expect(canChangeMute(state({ canChange: true }))).toBe(true);
    expect(canChangeMute(state({ canChange: false }))).toBe(false);
    expect(canChangeMute(null)).toBe(false);
  });
});

describe("tap che non cambia nulla (§9)", () => {
  it("Attive su Attive e indefinito su indefinito non sono comandi", () => {
    expect(isNoopChoice(state(), "active")).toBe(true);
    expect(isNoopChoice(state({ isMuted: true, muteOption: "indefinite" }), "indefinite")).toBe(true);
  });

  it("una durata temporanea è sempre un comando: una nuova scelta può impostare una nuova durata", () => {
    const muted = state({ isMuted: true, muteOption: "1h" });

    expect(isNoopChoice(muted, "1h")).toBe(false);
    expect(isNoopChoice(muted, "8h")).toBe(false);
    expect(isNoopChoice(state(), "1w")).toBe(false);
  });
});

describe("lettura della risposta del server", () => {
  it("normalizza il jsonb nella forma interna", () => {
    expect(
      parseNotificationState(
        {
          can_change: true,
          conversation_id: "c1",
          conversation_type: "GROUP",
          is_muted: true,
          mute_option: "8h",
          muted_until: "2026-11-17T20:00:00Z",
          period_id: "p1",
          state_version: "4",
        },
        "fallback",
      ),
    ).toEqual({
      canChange: true,
      conversationId: "c1",
      conversationType: "group",
      isMuted: true,
      muteOption: "8h",
      mutedUntil: "2026-11-17T20:00:00Z",
      periodId: "p1",
      stateVersion: 4,
    });
  });

  it("DIRECT: nessun periodo; un'opzione sconosciuta non diventa un mute", () => {
    const parsed = parseNotificationState(
      { can_change: true, conversation_type: "direct", is_muted: false, mute_option: "forever", state_version: 0 },
      "c9",
    );

    expect(parsed).toMatchObject({ conversationId: "c9", conversationType: "direct", muteOption: null, periodId: null });
  });

  it("un payload non interpretabile non inventa uno stato", () => {
    expect(parseNotificationState(null, "c1")).toBeNull();
    expect(parseNotificationState("x", "c1")).toBeNull();
    expect(parseNotificationState([], "c1")).toBeNull();
  });
});

describe("versioni (§9, QA-036)", () => {
  it("applica senza cache, a parità o con versione maggiore", () => {
    expect(shouldApplyState(undefined, state())).toBe(true);
    expect(shouldApplyState(state({ stateVersion: 2 }), state({ stateVersion: 2 }))).toBe(true);
    expect(shouldApplyState(state({ stateVersion: 2 }), state({ stateVersion: 3 }))).toBe(true);
  });

  it("scarta una risposta con state_version minore: non ripristina la scelta precedente", () => {
    expect(shouldApplyState(state({ stateVersion: 5 }), state({ stateVersion: 4 }))).toBe(false);
  });

  it("un periodo diverso riparte da zero: la sua versione non si confronta con quella del precedente", () => {
    expect(shouldApplyState(state({ periodId: "p1", stateVersion: 9 }), state({ periodId: "p2", stateVersion: 0 }))).toBe(
      true,
    );
  });

  it("lo stato riletto realizza la scelta voluta", () => {
    expect(stateMatchesChoice(state({ isMuted: true, muteOption: "8h" }), "8h")).toBe(true);
    expect(stateMatchesChoice(state({ isMuted: true, muteOption: "8h" }), "1h")).toBe(false);
    expect(stateMatchesChoice(state(), "active")).toBe(true);
  });
});

describe("errori (§9, §25)", () => {
  it("i rifiuti del server sono definitivi e chiudono l'intento", () => {
    expect(classifyMuteError({ message: "NOT_MEMBER" })).toBe("not_member");
    expect(classifyMuteError({ message: "PERIOD_ENDED" })).toBe("period_ended");
    expect(classifyMuteError({ message: "GROUP_DELETED" })).toBe("deleted");
    expect(classifyMuteError({ message: "INVALID_OPTION" })).toBe("invalid_option");
    expect(classifyMuteError({ message: "INVALID_OPERATION_ID" })).toBe("invalid_operation");
    expect(isSettledMuteError("invalid_operation")).toBe(true);
    expect(classifyMuteError({ code: "42501", message: "denied" })).toBe("forbidden");
    expect(isSettledMuteError("not_member")).toBe(true);
  });

  it("rete, timeout e il resto sono incerti: l'intento si conserva", () => {
    expect(classifyMuteError(new TypeError("Network request failed"))).toBe("uncertain");
    expect(classifyMuteError(new Error("timeout"))).toBe("uncertain");
    expect(classifyMuteError(undefined)).toBe("uncertain");
    expect(isSettledMuteError("uncertain")).toBe(false);
  });

  it("l'accesso perso è solo non membro, periodo finito, gruppo eliminato", () => {
    expect(isMuteAccessLost("not_member")).toBe(true);
    expect(isMuteAccessLost("period_ended")).toBe(true);
    expect(isMuteAccessLost("deleted")).toBe(true);
    expect(isMuteAccessLost("uncertain")).toBe(false);
    expect(isMuteAccessLost("invalid_option")).toBe(false);
  });
});
