/**
 * Idempotenza e doppio invio dei comandi di gestione (DAS-REV-33 §25, §27):
 * una chiave per intenzione, conservata se l'esito è incerto, chiusa quando è
 * definitivo; mentre un comando è in volo un secondo non parte.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardTimeoutError } from "../../state/error-classification";
import type { GroupCommandResult } from "../groups-types";
import { useGroupCommand } from "./use-group-command";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const result = (patch: Partial<GroupCommandResult> = {}): GroupCommandResult => ({
  added: 0,
  addedIds: [],
  alreadyActiveIds: [],
  changed: true,
  deleted: false,
  memberRole: null,
  periodChanged: false,
  periodEnded: false,
  periodId: null,
  periodVersion: null,
  promotedIds: [],
  replayed: false,
  status: null,
  version: 1,
  ...patch,
});

const mounted: TestRenderer.ReactTestRenderer[] = [];

function setup() {
  let api!: ReturnType<typeof useGroupCommand>;

  function Harness() {
    api = useGroupCommand({ limits: { maxPeople: 256, nameMax: 80 }, origin: "messages" });

    return null;
  }

  act(() => {
    mounted.push(TestRenderer.create(<Harness />));
  });

  return () => api;
}

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
});

/** Esegue un comando e restituisce la chiave con cui è stato chiamato il server. */
async function runOnce(
  api: () => ReturnType<typeof useGroupCommand>,
  signature: string,
  exec: (key: string) => Promise<GroupCommandResult>,
) {
  const keys: string[] = [];
  let outcome: Awaited<ReturnType<ReturnType<typeof useGroupCommand>["run"]>> = null;

  await act(async () => {
    outcome = await api().run({
      command: "add_people",
      exec: (key) => {
        keys.push(key);

        return exec(key);
      },
      signature,
    });
  });

  return { key: keys[0], keys, outcome };
}

describe("una chiave per intenzione (§25)", () => {
  it("esito incerto (timeout): il retry con lo stesso payload riusa la stessa chiave", async () => {
    const api = setup();
    const first = await runOnce(api, "a,b", () => Promise.reject(new DashboardTimeoutError("rpc")));

    expect(first.outcome).toMatchObject({ failure: { kind: "uncertain", settled: false }, ok: false });

    const retry = await runOnce(api, "a,b", () => Promise.resolve(result({ replayed: true })));

    expect(retry.key).toBe(first.key);
    expect(retry.outcome).toMatchObject({ ok: true });
  });

  it("esito incerto: un payload diverso è un'altra intenzione e ha un'altra chiave", async () => {
    const api = setup();
    const first = await runOnce(api, "a,b", () => Promise.reject(new DashboardTimeoutError("rpc")));
    const other = await runOnce(api, "a", () => Promise.resolve(result()));

    expect(other.key).not.toBe(first.key);
  });

  it("successo: l'intenzione si chiude, lo stesso gesto dopo è un'azione nuova", async () => {
    const api = setup();
    const first = await runOnce(api, "a,b", () => Promise.resolve(result()));
    const again = await runOnce(api, "a,b", () => Promise.resolve(result()));

    expect(again.key).not.toBe(first.key);
  });

  it("rifiuto definitivo del server: l'intenzione si chiude, il prossimo tentativo ha una chiave nuova", async () => {
    const api = setup();
    const first = await runOnce(api, "a,b", () => Promise.reject({ message: "SOCIETY_GROUP_LAST_ADMIN" }));

    expect(first.outcome).toMatchObject({ failure: { kind: "last_admin", settled: true }, ok: false });

    const again = await runOnce(api, "a,b", () => Promise.resolve(result()));

    expect(again.key).not.toBe(first.key);
  });

  it("la chiave è abbastanza lunga per il server (>= 8 caratteri)", async () => {
    const api = setup();
    const { key } = await runOnce(api, "a", () => Promise.resolve(result()));

    expect(key.length).toBeGreaterThanOrEqual(8);
  });
});

describe("nessun doppio invio (§27)", () => {
  it("mentre un comando è in volo il secondo non parte e restituisce null", async () => {
    const api = setup();
    let release!: (value: GroupCommandResult) => void;
    const exec = vi.fn(
      () =>
        new Promise<GroupCommandResult>((resolve) => {
          release = resolve;
        }),
    );
    let first!: Promise<unknown>;
    let second: unknown = "non eseguito";

    await act(async () => {
      first = api().run({ command: "archive", exec, signature: "v3" });
      second = await api().run({ command: "archive", exec, signature: "v3" });
    });

    expect(second).toBeNull();
    expect(exec).toHaveBeenCalledTimes(1);
    expect(api().pending).toBe("archive");

    await act(async () => {
      release(result({ status: "archived" }));
      await first;
    });

    expect(api().pending).toBeNull();
  });

  it("dopo la conclusione un nuovo comando può partire", async () => {
    const api = setup();
    const exec = vi.fn(() => Promise.resolve(result()));

    await runOnce(api, "x", exec);
    const next = await runOnce(api, "y", exec);

    expect(next.outcome).toMatchObject({ ok: true });
    expect(exec).toHaveBeenCalledTimes(2);
  });
});
