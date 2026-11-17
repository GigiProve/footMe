import { describe, expect, it, vi } from "vitest";

import { mapLauncher } from "../publishing/publishing-service";
import { launcherRows, resolveLauncherMode } from "../publishing/publishing-presentation";
import type { ContentLauncherState } from "../publishing/publishing-types";
import { composerOriginForScope, OPEN_POSITION_HREF } from "./composer-entry";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const onlyPost: ContentLauncherState = {
  canOpenPosition: false,
  canPublishArticle: false,
  canPublishPost: true,
  canViewDrafts: true,
  draftsCount: 0,
  failedCount: 0,
  scheduledCount: 0,
};

describe("«Posizione aperta» (HOM-15 §168, §171: capability server, non il ruolo)", () => {
  it("la riga compare solo con can_open_position, nella stessa destinazione di prima", () => {
    expect(launcherRows({ ...onlyPost, canOpenPosition: true }).secondary).toContain("open_position");
    expect(launcherRows(onlyPost).secondary).not.toContain("open_position");
    expect(OPEN_POSITION_HREF).toBe("/(tabs)/announcements");
  });

  it("il payload del launcher porta la capability; assente o non booleana = false", () => {
    const wire = {
      can_publish_article: false,
      can_publish_post: true,
      can_view_drafts: true,
      drafts_count: 0,
      failed_count: 0,
      scheduled_count: 0,
    };
    expect(mapLauncher({ ...wire, can_open_position: true }).canOpenPosition).toBe(true);
    expect(mapLauncher({ ...wire, can_open_position: false }).canOpenPosition).toBe(false);
    expect(mapLauncher(wire).canOpenPosition).toBe(false);
  });
});

describe("«+» (HOM-06.1 §2–3, HOM-06.2 §4–§6)", () => {
  it("chi può solo Post e non ha nulla in sospeso → composer diretto, qualunque ruolo", () => {
    expect(resolveLauncherMode(onlyPost)).toBe("direct_post");
  });

  it("senza lo stato (rete) il Post resta un tap: nessuna capability è dedotta", () => {
    expect(resolveLauncherMode(null)).toBe("direct_post");
    expect(launcherRows(null).secondary).toEqual([]);
  });

  it("Articolo, bozze o «Posizione aperta» → foglio «Crea contenuto»", () => {
    expect(resolveLauncherMode({ ...onlyPost, canPublishArticle: true })).toBe("sheet");
    expect(resolveLauncherMode({ ...onlyPost, draftsCount: 1 })).toBe("sheet");
    expect(resolveLauncherMode({ ...onlyPost, canOpenPosition: true })).toBe("sheet");
  });
});

describe("composerOriginForScope (§5, §123)", () => {
  it("la tab Home di partenza diventa l'origin", () => {
    expect(composerOriginForScope("per_te")).toBe("HOME_PER_TE");
    expect(composerOriginForScope("seguiti")).toBe("HOME_SEGUITI");
  });
});
