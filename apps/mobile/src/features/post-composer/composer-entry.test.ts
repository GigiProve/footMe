import { describe, expect, it } from "vitest";

import { resolveLauncherMode } from "../publishing/publishing-presentation";
import type { ContentLauncherState } from "../publishing/publishing-types";
import {
  composerOriginForScope,
  launcherExtraActionsForRole,
  OPEN_POSITION_HREF,
} from "./composer-entry";

const onlyPost: ContentLauncherState = {
  canPublishArticle: false,
  canPublishPost: true,
  canViewDrafts: true,
  draftsCount: 0,
  failedCount: 0,
  scheduledCount: 0,
};

describe("launcherExtraActionsForRole (§4: azioni reali, non voci di mockup)", () => {
  it.each(["player", "coach", "staff", "director", "agent", "fan", "media", "unknown", null, undefined])(
    "%s → nessuna azione extra: formati legacy assorbiti da Post e Articolo",
    (role) => {
      expect(launcherExtraActionsForRole(role)).toEqual([]);
    },
  );

  it("solo il club_admin ha «Posizione aperta», nella stessa destinazione di prima", () => {
    expect(launcherExtraActionsForRole("club_admin")).toEqual(["open_position"]);
    expect(OPEN_POSITION_HREF).toBe("/(tabs)/announcements");
  });
});

describe("«+» (HOM-06.1 §2–3, HOM-06.2 §4–§6)", () => {
  it("chi può solo Post e non ha nulla in sospeso → composer diretto, anche un Tifoso o un Media", () => {
    for (const role of ["player", "fan", "media"]) {
      expect(resolveLauncherMode(onlyPost, launcherExtraActionsForRole(role))).toBe("direct_post");
    }
  });

  it("senza lo stato (rete) il Post resta un tap; il club_admin ha comunque il foglio", () => {
    expect(resolveLauncherMode(null, launcherExtraActionsForRole("player"))).toBe("direct_post");
    expect(resolveLauncherMode(null, launcherExtraActionsForRole("club_admin"))).toBe("sheet");
  });

  it("Articolo, bozze o un'azione extra → foglio «Crea contenuto»", () => {
    expect(resolveLauncherMode({ ...onlyPost, canPublishArticle: true })).toBe("sheet");
    expect(resolveLauncherMode({ ...onlyPost, draftsCount: 1 })).toBe("sheet");
    expect(resolveLauncherMode(onlyPost, launcherExtraActionsForRole("club_admin"))).toBe("sheet");
  });
});

describe("composerOriginForScope (§5, §123)", () => {
  it("la tab Home di partenza diventa l'origin", () => {
    expect(composerOriginForScope("per_te")).toBe("HOME_PER_TE");
    expect(composerOriginForScope("seguiti")).toBe("HOME_SEGUITI");
  });
});
