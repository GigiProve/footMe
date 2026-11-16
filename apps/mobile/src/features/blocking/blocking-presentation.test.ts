/**
 * Derivazioni e copy di Blocca / Sblocca (HOM-12 §14–§28, §80–§113, §141–§151, §241–§249).
 */
import { describe, expect, it } from "vitest";

import {
  BLOCK_COPY,
  blockConfirmTitle,
  blockMenuLabel,
  blockTargetKey,
  blockedSubtitle,
  canBlockAs,
  chatBlockState,
  chatBlockerLabel,
  confirmBlockA11yLabel,
  confirmCancelA11yLabel,
  groupBlockedIdentities,
  hasBlockCapability,
  isBlockedPhase,
  isBlockedSendError,
  personalIdentityRef,
  targetTypeForRole,
  unblockedMessage,
} from "./blocking-presentation";
import type { BlockedIdentity } from "./blocking-types";

function item(overrides: Partial<BlockedIdentity>): BlockedIdentity {
  return {
    avatarUrl: null,
    blockId: "b1",
    blockedAt: "2026-11-16T10:00:00Z",
    blockerId: "me",
    blockerType: "person",
    identityId: "t1",
    identityType: "person",
    isVerified: false,
    name: "Marco Bianchi",
    subtitle: null,
    ...overrides,
  };
}

describe("copy verbatim — §24, §80, §83, §102, §106, §151, §200, §204", () => {
  it("usa esattamente le stringhe della specifica", () => {
    expect(blockMenuLabel("Marco Bianchi")).toBe("Blocca Marco Bianchi");
    expect(blockConfirmTitle("Marco Bianchi")).toBe("Bloccare Marco Bianchi?");
    expect(BLOCK_COPY.confirmBody).toBe(
      "Non potrete più trovarvi, scrivervi o interagire direttamente su PROLINK finché il blocco sarà attivo.",
    );
    expect(BLOCK_COPY.cancel).toBe("Annulla");
    expect(BLOCK_COPY.confirm).toBe("Blocca");
    expect(BLOCK_COPY.blockedByMeTitle).toBe("Hai bloccato questo profilo");
    expect(BLOCK_COPY.blockedByMeBody).toBe(
      "Sbloccalo per visualizzare nuovamente il profilo e riprendere le interazioni.",
    );
    expect(BLOCK_COPY.unblock).toBe("Sblocca");
    expect(BLOCK_COPY.unavailableTitle).toBe("Profilo non disponibile");
    expect(BLOCK_COPY.unavailableBody).toBe("Questo profilo non è disponibile.");
    expect(chatBlockerLabel("Marco Bianchi")).toBe("Hai bloccato Marco Bianchi");
    expect(BLOCK_COPY.blockedChatNotice).toBe("Non puoi inviare messaggi a questo profilo.");
    expect(unblockedMessage("Marco Bianchi")).toBe("Marco Bianchi è stato sbloccato");
    expect(BLOCK_COPY.blockError).toBe("Non è stato possibile bloccare questo profilo. Riprova.");
    expect(BLOCK_COPY.unblockError).toBe("Non è stato possibile sbloccare questo profilo. Riprova.");
    expect(BLOCK_COPY.emptyTitle).toBe("Nessun profilo bloccato");
    expect(BLOCK_COPY.emptyBody).toBe("I profili che blocchi compariranno qui.");
  });

  it("non rivela mai il Block al bloccato e non promette cancellazioni (§28, §84, §232)", () => {
    const all = Object.values(BLOCK_COPY).join(" ");
    expect(all).not.toMatch(/ti ha bloccato|sei stato bloccato|ufficiale/i);
    expect(BLOCK_COPY.confirmBody).not.toMatch(/elimin|cancell|perder/i);
    expect(BLOCK_COPY.unavailableBody).not.toMatch(/bloccat/i);
  });

  it("un nome mancante non rompe il copy", () => {
    expect(blockMenuLabel(null)).toBe("Blocca questo profilo");
    expect(blockConfirmTitle("  ")).toBe("Bloccare questo profilo?");
    expect(unblockedMessage(null)).toBe("Il profilo è stato sbloccato");
  });

  it("Annulla e Blocca hanno etichette accessibili distinte (§243)", () => {
    expect(confirmCancelA11yLabel("Marco")).not.toBe(confirmBlockA11yLabel("Marco"));
    expect(confirmBlockA11yLabel("Marco")).toBe("Blocca Marco");
  });
});

describe("chi blocca — §8–§13, D8", () => {
  const target = { id: "t1", type: "person" as const };
  const me = { id: "me", type: "person" as const };

  it("una persona può bloccare un'altra identità, mai sé stessa", () => {
    expect(canBlockAs({ blocker: me, societyCapable: false, target })).toBe(true);
    expect(canBlockAs({ blocker: me, societyCapable: false, target: me })).toBe(false);
  });

  it("una Società senza can_block_identity non vede la voce (§12)", () => {
    const society = { id: "club-1", type: "society" as const };
    expect(canBlockAs({ blocker: society, societyCapable: false, target })).toBe(false);
    expect(canBlockAs({ blocker: society, societyCapable: true, target })).toBe(true);
    expect(canBlockAs({ blocker: society, societyCapable: true, target: society })).toBe(false);
  });

  it("senza blocker o target nessuna voce", () => {
    expect(canBlockAs({ blocker: null, societyCapable: true, target })).toBe(false);
    expect(canBlockAs({ blocker: me, societyCapable: true, target: null })).toBe(false);
  });

  it("la capability: titolare implicito, admin solo con la chiave (D3)", () => {
    expect(hasBlockCapability({ capabilities: [], isOwner: true })).toBe(true);
    expect(hasBlockCapability({ capabilities: ["can_block_identity"], isOwner: false })).toBe(true);
    expect(hasBlockCapability({ capabilities: ["content_create"], isOwner: false })).toBe(false);
    expect(hasBlockCapability(null)).toBe(false);
  });

  it("l'identità personale è media solo per la Pagina Media", () => {
    expect(personalIdentityRef({ id: "u", role: "media" })).toEqual({ id: "u", type: "media" });
    expect(personalIdentityRef({ id: "u", role: "player" })).toEqual({ id: "u", type: "person" });
    expect(personalIdentityRef(null)).toBeNull();
    expect(targetTypeForRole("media")).toBe("media");
    expect(targetTypeForRole("coach")).toBe("person");
  });
});

describe("chiavi e fasi dello store", () => {
  it("person e media condividono la famiglia profilo, la Società no", () => {
    expect(blockTargetKey({ id: "x", type: "person" })).toBe(blockTargetKey({ id: "x", type: "media" }));
    expect(blockTargetKey({ id: "x", type: "society" })).not.toBe(blockTargetKey({ id: "x", type: "person" }));
  });

  it("bloccato = blocked, pending_block e pending_unblock (§198, §205)", () => {
    expect(isBlockedPhase({ phase: "blocked" })).toBe(true);
    expect(isBlockedPhase({ phase: "pending_block" })).toBe(true);
    expect(isBlockedPhase({ phase: "pending_unblock" })).toBe(true);
    expect(isBlockedPhase({ phase: "unblocked" })).toBe(false);
    expect(isBlockedPhase(undefined)).toBe(false);
  });
});

describe("stato della chat — §90–§109, §205", () => {
  it("blocker: blocked_by_me dal meta", () => {
    expect(chatBlockState({ blockedByMe: true, canSend: false, override: null })).toBe("blocker");
  });

  it("bloccato: can_send false senza dire chi (§107)", () => {
    expect(chatBlockState({ blockedByMe: false, canSend: false, override: null })).toBe("blocked");
  });

  it("nessun Block: can_send true o assente", () => {
    expect(chatBlockState({ blockedByMe: false, canSend: true, override: null })).toBe("none");
    expect(chatBlockState({ blockedByMe: false, canSend: undefined, override: null })).toBe("none");
  });

  it("lo store vince sul meta: Block ottimistico e Sblocca riuscito", () => {
    expect(chatBlockState({ blockedByMe: false, canSend: true, override: true })).toBe("blocker");
    // Appena sbloccato il can_send false in cache è il MIO Block, non quello dell'altro lato.
    expect(chatBlockState({ blockedByMe: true, canSend: false, override: false })).toBe("none");
  });

  it("dopo Sblocca, se l'altro lato ha bloccato a sua volta, resta neutro-bloccato dopo il refetch", () => {
    expect(chatBlockState({ blockedByMe: false, canSend: false, override: false })).toBe("blocked");
  });
});

describe("invio rifiutato per Block — §110–§112", () => {
  it("riconosce il rifiuto RLS e non gli errori generici", () => {
    expect(isBlockedSendError({ code: "42501", message: "x" })).toBe(true);
    expect(isBlockedSendError({ message: "new row violates row-level security policy" })).toBe(true);
    expect(isBlockedSendError(new Error("Rete assente"))).toBe(false);
    expect(isBlockedSendError(null)).toBe(false);
  });
});

describe("Profili bloccati — §144–§150, D7", () => {
  it("il sottotitolo del server vince, il ripiego è il tipo (§145–§147)", () => {
    expect(blockedSubtitle({ identityType: "person", subtitle: "Allenatore · AC Como" })).toBe("Allenatore · AC Como");
    expect(blockedSubtitle({ identityType: "society", subtitle: null })).toBe("Società");
    expect(blockedSubtitle({ identityType: "media", subtitle: null })).toBe("Media");
  });

  it("un solo blocker: nessuna intestazione, ordine del server", () => {
    const sections = groupBlockedIdentities(
      [item({ blockId: "b1" }), item({ blockId: "b2", identityId: "t2" })],
      new Map(),
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBeNull();
    expect(sections[0].items.map((entry) => entry.blockId)).toEqual(["b1", "b2"]);
  });

  it("più blocker: un'intestazione per identità con il suo nome", () => {
    const sections = groupBlockedIdentities(
      [
        item({ blockId: "b1" }),
        item({ blockId: "b2", blockerId: "club-1", blockerType: "society", identityId: "t2" }),
        item({ blockId: "b3", identityId: "t3" }),
      ],
      new Map([["society:club-1", "AC Como"]]),
    );
    expect(sections.map((section) => section.title)).toEqual(["Profilo personale", "AC Como"]);
    expect(sections[0].items.map((entry) => entry.blockId)).toEqual(["b1", "b3"]);
  });

  it("lista vuota: nessuna sezione", () => {
    expect(groupBlockedIdentities([], new Map())).toEqual([]);
  });
});
