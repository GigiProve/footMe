import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginSetSaved, commitSetSaved, resetSavedCommands } from "./saved-commands";
import { getSavedEntry, resetSavedStore, savedKey } from "./saved-store";
import type { SavedTarget } from "./saved-types";
import { canUndo } from "./use-set-saved";

const mocks = vi.hoisted(() => ({ setSavedRemote: vi.fn() }));

vi.mock("./saved-service", () => ({ setSavedRemote: mocks.setSavedRemote }));
vi.mock("./saved-analytics", () => ({ targetProps: () => ({}), trackSaved: vi.fn() }));
vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const profile: SavedTarget = { id: "u1", type: "profile" };

beforeEach(() => {
  resetSavedStore();
  resetSavedCommands();
  mocks.setSavedRemote.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saved-commands — logout durante una scrittura (§70, §103)", () => {
  it("l'esito di una scrittura dell'utente di prima non tocca lo store svuotato", async () => {
    let resolve: (value: boolean) => void = () => undefined;
    mocks.setSavedRemote.mockReturnValue(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );

    const ticket = beginSetSaved(profile, true);
    const pending = commitSetSaved(profile, ticket);
    resetSavedStore();
    resolve(true);
    await pending;

    expect(getSavedEntry(savedKey(profile))).toBeUndefined();
  });

  it("anche un errore arrivato dopo il logout non fa rollback nello store nuovo", async () => {
    let reject: (error: Error) => void = () => undefined;
    mocks.setSavedRemote.mockReturnValue(
      new Promise<boolean>((_done, fail) => {
        reject = fail;
      }),
    );

    const ticket = beginSetSaved(profile, true);
    const pending = commitSetSaved(profile, ticket);
    resetSavedStore();
    reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");

    expect(getSavedEntry(savedKey(profile))).toBeUndefined();
  });
});

describe("canUndo — «Annulla» del Saved Center (§118–§119)", () => {
  it("vale dopo una rimozione riuscita e non ancora superata", async () => {
    mocks.setSavedRemote.mockResolvedValue(false);
    const ticket = beginSetSaved(profile, false);
    await commitSetSaved(profile, ticket);

    expect(canUndo(ticket)).toBe(true);
  });

  it("non vale se il target è stato toccato di nuovo dopo la rimozione", async () => {
    mocks.setSavedRemote.mockResolvedValue(true);
    const removal = beginSetSaved(profile, false);
    await commitSetSaved(profile, removal);

    const again = beginSetSaved(profile, true);
    await commitSetSaved(profile, again);

    expect(canUndo(removal)).toBe(false);
  });

  it("non vale se nel frattempo è stato rimosso e salvato altrove, né con una scrittura in volo", async () => {
    mocks.setSavedRemote.mockResolvedValue(false);
    const removal = beginSetSaved(profile, false);
    await commitSetSaved(profile, removal);

    mocks.setSavedRemote.mockReturnValue(new Promise(() => undefined));
    beginSetSaved(profile, false);

    expect(canUndo(removal)).toBe(false);
  });

  it("non vale dopo il logout", async () => {
    mocks.setSavedRemote.mockResolvedValue(false);
    const ticket = beginSetSaved(profile, false);
    await commitSetSaved(profile, ticket);
    resetSavedStore();

    expect(canUndo(ticket)).toBe(false);
  });
});
