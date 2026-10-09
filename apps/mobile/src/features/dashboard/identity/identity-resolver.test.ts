import { describe, expect, it } from "vitest";

import type {
  DashboardCapability,
  DashboardIdentity,
  DashboardIdentityKind,
} from "../dashboard-types";
import {
  fallbackIdentity,
  identityPresentation,
  resolveInitialIdentity,
} from "./identity-resolver";

function identity(
  id: string,
  kind: DashboardIdentityKind,
  capabilities: DashboardCapability[] = [],
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities,
    id,
    isOwner: kind !== "person",
    isVerified: false,
    kind,
    name: id,
    scopeLabel: null,
  };
}

const personal = identity("marco", "person");
const society = identity("como", "society", ["dashboard_view"]);
const media = identity("cfn", "media");

describe("resolveInitialIdentity", () => {
  it("returns null when the actor has no eligible identity", () => {
    expect(resolveInitialIdentity({ identities: [] })).toBeNull();
  });

  it("prefers the identity requested by a contextual route", () => {
    const result = resolveInitialIdentity({
      identities: [personal, society],
      requestedId: "como",
      storedId: "marco",
    });

    expect(result?.id).toBe("como");
  });

  it("ignores a requested id that is not in the authorized list", () => {
    // Un deep link porta un id, non un permesso: se il backend non ha
    // restituito quell'identità, non si apre.
    const result = resolveInitialIdentity({
      identities: [personal],
      requestedId: "societa-altrui",
    });

    expect(result?.id).toBe("marco");
  });

  it("restores the last used identity when still authorized", () => {
    const result = resolveInitialIdentity({
      identities: [personal, society],
      storedId: "como",
    });

    expect(result?.id).toBe("como");
  });

  it("ignores a stored identity that is no longer authorized", () => {
    // Una preferenza salvata non prova l'accesso attuale: la revoca è
    // avvenuta mentre l'app era chiusa.
    const result = resolveInitialIdentity({
      identities: [personal],
      storedId: "como",
    });

    expect(result?.id).toBe("marco");
  });

  it("falls back to the personal identity at first access", () => {
    const result = resolveInitialIdentity({ identities: [society, personal] });

    expect(result?.id).toBe("marco");
  });

  it("falls back to the first identity when no personal one exists", () => {
    const result = resolveInitialIdentity({ identities: [society, media] });

    expect(result?.id).toBe("como");
  });
});

describe("fallbackIdentity", () => {
  it("prefers a valid personal identity after a revocation", () => {
    expect(fallbackIdentity([society, personal, media])?.id).toBe("marco");
  });

  it("uses the first remaining identity when no personal one is left", () => {
    expect(fallbackIdentity([society, media])?.id).toBe("como");
  });

  it("returns null when nothing is left", () => {
    expect(fallbackIdentity([])).toBeNull();
  });
});

describe("identityPresentation", () => {
  it("hides the context row for a single personal identity", () => {
    expect(identityPresentation([personal], personal)).toBe("hidden");
  });

  it("shows a static row for a single organizational identity", () => {
    expect(identityPresentation([society], society)).toBe("static");
  });

  it("shows a static row for a single media identity", () => {
    expect(identityPresentation([media], media)).toBe("static");
  });

  it("shows the selector for one society plus a personal identity", () => {
    // Il conteggio include il personale: una sola Società amministrabile
    // richiede comunque il selector (§8).
    expect(identityPresentation([personal, society], society)).toBe(
      "selectable",
    );
  });

  it("shows the selector for multiple organizational identities", () => {
    expect(identityPresentation([society, media], society)).toBe("selectable");
  });
});
