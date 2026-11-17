import { describe, expect, it, vi } from "vitest";

import type { ConversationTargetAnalyticsEvent } from "./conversation-target-analytics";
import { openConversationLink } from "./conversation-target-open";
import {
  CONVERSATION_OPEN_ERROR_MESSAGE,
  type ConversationLink,
  type ConversationOutcome,
} from "./conversation-target-presentation";

const CONVERSATION = "3f8c1b5e-1d2a-4c3b-9a7e-0123456789ab";
const PERIOD = "9f8c1b5e-1d2a-4c3b-9a7e-0123456789ab";

const GROUP_LINK: ConversationLink = { conversationId: CONVERSATION, intent: "message", periodId: PERIOD };
const DIRECT_LINK: ConversationLink = { conversationId: CONVERSATION, intent: "message", periodId: null };

function setup(
  resolve: (link: ConversationLink) => Promise<ConversationOutcome>,
  conversationType: "DIRECT" | "GROUP" | null = null,
) {
  const calls: string[] = [];
  const navigate = vi.fn((href: string) => void calls.push(`navigate:${href}`));
  const showError = vi.fn();
  const events: ConversationTargetAnalyticsEvent[] = [];
  const track = vi.fn((event: ConversationTargetAnalyticsEvent) => void events.push(event));
  const wrapped = vi.fn(async (link: ConversationLink) => {
    calls.push("resolve");
    return { conversationType, outcome: await resolve(link) };
  });

  return { calls, deps: { navigate, resolve: wrapped, showError, track }, events, navigate, showError, wrapped };
}

describe("openConversationLink (§25)", () => {
  it("chiede al server prima di navigare, e non apre nulla finché non risponde", async () => {
    let answer: (outcome: ConversationOutcome) => void = () => undefined;
    const { calls, deps, navigate } = setup(
      () => new Promise<ConversationOutcome>((resolve) => (answer = resolve)),
    );

    const pending = openConversationLink(GROUP_LINK, "push", deps);

    expect(calls).toEqual(["resolve"]);
    expect(navigate).not.toHaveBeenCalled();

    answer("open");
    await pending;

    expect(calls).toEqual(["resolve", `navigate:/messages/${CONVERSATION}`]);
  });

  it("passa al server esattamente id, periodo e intento", async () => {
    const { deps, wrapped } = setup(async () => "open");

    await openConversationLink({ ...GROUP_LINK, intent: "lifecycle" }, "push", deps);

    expect(wrapped).toHaveBeenCalledWith({ conversationId: CONVERSATION, intent: "lifecycle", periodId: PERIOD });
  });

  it.each([
    ["open", `/messages/${CONVERSATION}`],
    ["info", `/group-info/${CONVERSATION}`],
    ["revoked", "/messages/unavailable?reason=revoked"],
    ["deleted", "/messages/unavailable?reason=deleted"],
    ["unavailable", "/messages/unavailable?reason=unavailable"],
  ] as const)("esito %s → %s", async (outcome, href) => {
    const { deps, navigate, showError } = setup(async () => outcome);

    await expect(openConversationLink(GROUP_LINK, "center", deps)).resolves.toBe(outcome);

    expect(navigate).toHaveBeenCalledExactlyOnceWith(href);
    expect(showError).not.toHaveBeenCalled();
  });

  it("errore di rete ≠ revoca: nessuna navigazione, nessun fallback, toast ritentabile", async () => {
    const { deps, events, navigate, showError } = setup(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(openConversationLink(GROUP_LINK, "push", deps)).resolves.toBeNull();

    expect(navigate).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledExactlyOnceWith(CONVERSATION_OPEN_ERROR_MESSAGE);
    expect(events).toEqual([]);
  });

  it("un errore del server (RPC) è trattato come errore temporaneo, non come esito", async () => {
    const { deps, navigate, showError } = setup(async () => {
      throw Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
    });

    await expect(openConversationLink(GROUP_LINK, "center", deps)).resolves.toBeNull();

    expect(navigate).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledOnce();
  });
});

describe("analytics (§27)", () => {
  it("push aperta: conversation_opened_from_push con tipo ed esito enumerati", async () => {
    const group = setup(async () => "open", "GROUP");
    const direct = setup(async () => "open", "DIRECT");
    const info = setup(async () => "info", "GROUP");

    await openConversationLink(GROUP_LINK, "push", group.deps);
    await openConversationLink(DIRECT_LINK, "push", direct.deps);
    await openConversationLink({ ...GROUP_LINK, intent: "role" }, "push", info.deps);

    expect(group.events).toEqual([
      { conversation_type: "GROUP", name: "conversation_opened_from_push", origin: "push", outcome: "open" },
    ]);
    expect(direct.events).toEqual([
      { conversation_type: "DIRECT", name: "conversation_opened_from_push", origin: "push", outcome: "open" },
    ]);
    expect(info.events[0]).toMatchObject({ name: "conversation_opened_from_push", outcome: "info" });
  });

  it("esito negato: conversation_deeplink_denied, da push e dal Centro", async () => {
    const push = setup(async () => "revoked", "GROUP");
    const center = setup(async () => "deleted", "GROUP");

    await openConversationLink(GROUP_LINK, "push", push.deps);
    await openConversationLink(GROUP_LINK, "center", center.deps);

    expect(push.events).toEqual([
      { conversation_type: "GROUP", name: "conversation_deeplink_denied", origin: "push", outcome: "revoked" },
    ]);
    expect(center.events).toEqual([
      { conversation_type: "GROUP", name: "conversation_deeplink_denied", origin: "center", outcome: "deleted" },
    ]);
  });

  it("conversation_type null (estraneo, id inesistente): `unknown`, nessuna deduzione dal link", async () => {
    // Un link con periodo sembrerebbe un GROUP, ma il server non conferma: lo può manomettere un estraneo.
    const { deps, events } = setup(async () => "unavailable", null);

    await openConversationLink(GROUP_LINK, "push", deps);

    expect(events).toEqual([
      { conversation_type: "unknown", name: "conversation_deeplink_denied", origin: "push", outcome: "unavailable" },
    ]);
  });

  it("l'apertura dal Centro riuscita non è una `opened_from_push`", async () => {
    const { deps, events } = setup(async () => "open");

    await openConversationLink(GROUP_LINK, "center", deps);

    expect(events).toEqual([]);
  });

  it("gli eventi non portano id, nomi o testi", async () => {
    const { deps, events } = setup(async () => "unavailable");

    await openConversationLink(GROUP_LINK, "push", deps);

    const serialized = JSON.stringify(events);

    expect(serialized).not.toContain(CONVERSATION);
    expect(serialized).not.toContain(PERIOD);
  });
});
