/**
 * Comando mute (DAS-REV-34 §9, §25; QA-036..QA-038): un operation id per
 * intento, mutazioni serializzate, risposte vecchie scartate, rilettura su
 * esito incerto, nessun falso successo.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MESSAGING_QK } from "../messaging-keys";
import type { ConversationNotificationState, MuteChoice } from "./mute-types";
import { useConversationMute } from "./use-conversation-mute";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const service = vi.hoisted(() => ({
  fetchConversationNotificationState: vi.fn(),
  setConversationMute: vi.fn(),
}));

vi.mock("./mute-service", () => service);

const baseState = (patch: Partial<ConversationNotificationState> = {}): ConversationNotificationState => ({
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

const stateFor = (choice: MuteChoice, stateVersion: number) =>
  choice === "active"
    ? baseState({ stateVersion })
    : baseState({ isMuted: true, muteOption: choice, mutedUntil: choice === "indefinite" ? null : "2026-11-17T20:00:00Z", stateVersion });

type SetCall = { choice: MuteChoice; operationId: string; periodId: string | null };
const setCalls = () => service.setConversationMute.mock.calls.map(([input]) => input as SetCall);

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function flush() {
  for (let turn = 0; turn < 4; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function setup(onAccessLost = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  let api!: ReturnType<typeof useConversationMute>;

  function Harness() {
    api = useConversationMute({
      conversationId: "c1",
      conversationType: "group",
      onAccessLost,
      periodId: "p1",
      profileId: "me-1",
    });

    return null;
  }

  await act(async () => {
    mounted.push(
      TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );
  });
  await flush();

  return { api: () => api, onAccessLost, queryClient };
}

const cached = (queryClient: QueryClient) =>
  queryClient.getQueryData<ConversationNotificationState>(MESSAGING_QK.notificationState("c1"));

beforeEach(() => {
  service.fetchConversationNotificationState.mockResolvedValue(baseState());
  service.setConversationMute.mockImplementation(({ choice }: SetCall) => Promise.resolve(stateFor(choice, 2)));
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

describe("applicazione della scelta", () => {
  it("il successo aggiorna la cache col valore del server e mostra la scelta confermata", async () => {
    const { api, queryClient } = await setup();
    let result: unknown;

    await act(async () => {
      result = await api().select("8h");
    });

    expect(result).toBe("applied");
    expect(cached(queryClient)).toMatchObject({ isMuted: true, muteOption: "8h", stateVersion: 2 });
    expect(api().selected).toBe("8h");
    expect(api().isPending).toBe(false);
    expect(api().failed).toBe(false);
    // Il periodo osservato accompagna il comando; destinatario e durata non partono dal client.
    expect(setCalls()).toEqual([{ choice: "8h", conversationId: "c1", operationId: expect.any(String), periodId: "p1" }]);
  });

  it("l'operation id è un UUID", async () => {
    const { api } = await setup();

    await act(async () => {
      await api().select("1h");
    });

    expect(setCalls()[0].operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("Attive su Attive non è un comando", async () => {
    const { api } = await setup();
    let result: unknown;

    await act(async () => {
      result = await api().select("active");
    });

    expect(result).toBe("applied");
    expect(service.setConversationMute).not.toHaveBeenCalled();
  });

  it("dopo un successo lo stesso gesto è un intento nuovo, con un id nuovo", async () => {
    const { api } = await setup();

    await act(async () => {
      await api().select("1h");
    });
    await act(async () => {
      await api().select("1h");
    });

    const [first, second] = setCalls();

    expect(second.operationId).not.toBe(first.operationId);
  });
});

describe("esito incerto (QA-037, QA-038)", () => {
  it("errore prima del commit: stato confermato conservato, errore locale, nessun successo", async () => {
    const { api, queryClient } = await setup();

    service.setConversationMute.mockRejectedValue(new TypeError("Network request failed"));
    let result: unknown;

    await act(async () => {
      result = await api().select("8h");
    });

    expect(result).toBe("failed");
    expect(api().failed).toBe(true);
    expect(cached(queryClient)).toMatchObject({ isMuted: false, stateVersion: 1 });
    expect(api().selected).toBe("active");
    // Si è riletto lo stato autorevole prima di dichiarare il fallimento.
    expect(service.fetchConversationNotificationState.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("il retry dello stesso intento riusa lo stesso operation id", async () => {
    const { api } = await setup();

    service.setConversationMute.mockRejectedValueOnce(new TypeError("Network request failed"));
    await act(async () => {
      await api().select("8h");
    });
    await act(async () => {
      await api().select("8h");
    });

    const [first, retry] = setCalls();

    expect(retry.operationId).toBe(first.operationId);
    expect(retry.choice).toBe("8h");
    expect(api().failed).toBe(false);
  });

  it("un intento diverso ha un altro id", async () => {
    const { api } = await setup();

    service.setConversationMute.mockRejectedValueOnce(new TypeError("Network request failed"));
    await act(async () => {
      await api().select("8h");
    });
    await act(async () => {
      await api().select("1w");
    });

    const [first, other] = setCalls();

    expect(other.operationId).not.toBe(first.operationId);
  });

  it("risposta persa dopo un commit: la rilettura recupera l'esito senza un secondo comando", async () => {
    const { api, queryClient } = await setup();

    service.setConversationMute.mockRejectedValue(new Error("timeout"));
    service.fetchConversationNotificationState.mockResolvedValue(stateFor("8h", 2));
    let result: unknown;

    await act(async () => {
      result = await api().select("8h");
    });

    expect(result).toBe("applied");
    expect(api().failed).toBe(false);
    expect(cached(queryClient)).toMatchObject({ isMuted: true, muteOption: "8h", stateVersion: 2 });
    expect(service.setConversationMute).toHaveBeenCalledTimes(1);
  });

  it("offline anche la rilettura: nessun falso successo", async () => {
    const { api } = await setup();

    service.setConversationMute.mockRejectedValue(new TypeError("Network request failed"));
    service.fetchConversationNotificationState.mockRejectedValue(new TypeError("Network request failed"));
    let result: unknown;

    await act(async () => {
      result = await api().select("1h");
    });

    expect(result).toBe("failed");
    expect(api().failed).toBe(true);
  });

  it("un rifiuto definitivo chiude l'intento e segnala l'accesso perso", async () => {
    const onAccessLost = vi.fn();
    const { api } = await setup(onAccessLost);

    service.setConversationMute.mockRejectedValueOnce({ message: "PERIOD_ENDED" });
    let result: unknown;

    await act(async () => {
      result = await api().select("8h");
    });
    await act(async () => {
      await api().select("8h");
    });

    expect(result).toBe("failed");
    expect(onAccessLost).toHaveBeenCalledWith("period_ended");
    // Rifiuto definitivo: nessuna rilettura di recupero e nessun id riusato.
    const [first, second] = setCalls();

    expect(second.operationId).not.toBe(first.operationId);
  });
});

describe("versioni e serializzazione (QA-036)", () => {
  it("una risposta con state_version minore di quella in cache viene scartata", async () => {
    const { api, queryClient } = await setup();

    // Un altro dispositivo ha già portato lo stato alla versione 7 (Silenziose indefinite).
    act(() => {
      queryClient.setQueryData(MESSAGING_QK.notificationState("c1"), stateFor("indefinite", 7));
    });
    service.setConversationMute.mockResolvedValue(stateFor("8h", 3));

    await act(async () => {
      await api().select("8h");
    });

    expect(cached(queryClient)).toMatchObject({ muteOption: "indefinite", stateVersion: 7 });
  });

  it("due tap in volo: il secondo parte solo dopo il primo e il risultato finale è l'ultimo", async () => {
    const { api, queryClient } = await setup();
    let release!: (value: ConversationNotificationState) => void;

    service.setConversationMute.mockImplementationOnce(
      () =>
        new Promise<ConversationNotificationState>((resolve) => {
          release = resolve;
        }),
    );
    service.setConversationMute.mockImplementation(({ choice }: SetCall) => Promise.resolve(stateFor(choice, 3)));

    let first!: Promise<unknown>;
    let queued: unknown[] = [];

    await act(async () => {
      first = api().select("8h");
    });
    expect(api().isPending).toBe(true);

    await act(async () => {
      // Tre tap mentre il primo è in volo: si coalescono, resta l'ultimo.
      queued = [await api().select("1h"), await api().select("1w"), await api().select("indefinite")];
    });

    expect(queued).toEqual(["queued", "queued", "queued"]);
    expect(api().selected).toBe("indefinite");
    expect(service.setConversationMute).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(stateFor("8h", 2));
      await first;
    });

    expect(setCalls().map((call) => call.choice)).toEqual(["8h", "indefinite"]);
    expect(cached(queryClient)).toMatchObject({ muteOption: "indefinite", stateVersion: 3 });
    expect(api().selected).toBe("indefinite");
    expect(api().isPending).toBe(false);
  });

  it("l'Inbox e il badge si rileggono dopo un successo", async () => {
    const { api, queryClient } = await setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await api().select("1h");
    });

    const keys = invalidate.mock.calls.map(([filter]) => (filter as { queryKey: unknown }).queryKey);

    expect(keys).toContainEqual(MESSAGING_QK.inbox("me-1"));
    expect(keys).toContainEqual(MESSAGING_QK.badge("me-1"));
  });
});
