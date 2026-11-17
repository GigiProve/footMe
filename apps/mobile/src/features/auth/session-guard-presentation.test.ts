import { describe, expect, it } from "vitest";

import {
  decideSessionGuard,
  isSafeInternalTarget,
  ONBOARDING_HREF,
  pendingTargetForRoute,
  routeAccess,
  SIGN_IN_HREF,
} from "./session-guard-presentation";

const BASE = { hadSession: false, hasSession: false, isLoading: false, needsOnboarding: false };

describe("routeAccess (HOM-15 §293–§296)", () => {
  it("avvio, accesso, landing evento e inviti con token restano pubblici", () => {
    expect(routeAccess([])).toBe("public");
    expect(routeAccess(["(auth)", "sign-in"])).toBe("public");
    expect(routeAccess(["(auth)", "welcome"])).toBe("public");
    expect(routeAccess(["event", "[publicId]"])).toBe("public");
    expect(routeAccess(["team-invite", "[token]"])).toBe("public");
    expect(routeAccess(["society-invite", "[token]"])).toBe("public");
    expect(routeAccess(["assistito-invite", "[token]"])).toBe("public");
    expect(routeAccess(["admin-invite", "[token]"])).toBe("public");
    expect(routeAccess(["+not-found"])).toBe("public");
  });

  it("il composer dell'invito amministrativo non è pubblico, solo la sua landing", () => {
    expect(routeAccess(["admin-invite", "search"])).toBe("protected");
    expect(routeAccess(["admin-invite", "review"])).toBe("protected");
  });

  it("onboarding e admin hanno la guardia di ruolo nel loro layout", () => {
    expect(routeAccess(["(onboarding)", "profile"])).toBe("self_guarded");
    expect(routeAccess(["(admin)", "dashboard"])).toBe("self_guarded");
  });

  it("dettaglio, Società, Mi piace, composer, Segnala, statistiche, notifiche, chat e tab sono protetti", () => {
    for (const segments of [
      ["content", "[type]", "[id]"],
      ["club", "[id]"],
      ["likes", "[type]", "[id]"],
      ["drafts"],
      ["post-compose"],
      ["article-compose", "editor"],
      ["report", "[targetType]", "[id]"],
      ["content", "insights", "[type]", "[id]"],
      ["notifications"],
      ["messages", "[conversationId]"],
      ["profile", "[id]"],
      ["team-join", "[token]"],
      ["invite", "[token]"],
      ["(tabs)"],
      ["(tabs)", "messages"],
    ]) {
      expect(routeAccess(segments)).toBe("protected");
    }
  });
});

describe("decideSessionGuard", () => {
  const content = ["content", "[type]", "[id]"];

  it("le route pubbliche passano anche senza sessione", () => {
    expect(decideSessionGuard({ ...BASE, segments: ["event", "[publicId]"] })).toEqual({ kind: "allow" });
  });

  it("aspetta la sessione prima di decidere", () => {
    expect(decideSessionGuard({ ...BASE, isLoading: true, segments: content })).toEqual({ kind: "wait" });
  });

  it("senza sessione rimanda al login e ricorda il target (§297)", () => {
    expect(decideSessionGuard({ ...BASE, segments: content })).toEqual({
      href: SIGN_IN_HREF,
      kind: "redirect",
      rememberTarget: true,
    });
  });

  it("dopo un logout o una scadenza non ricorda il target dell'account uscito", () => {
    expect(decideSessionGuard({ ...BASE, hadSession: true, segments: content })).toEqual({
      href: SIGN_IN_HREF,
      kind: "redirect",
      rememberTarget: false,
    });
  });

  it("con onboarding da completare rimanda all'onboarding, come le tab", () => {
    expect(
      decideSessionGuard({ ...BASE, hasSession: true, needsOnboarding: true, segments: content }),
    ).toEqual({ href: ONBOARDING_HREF, kind: "redirect", rememberTarget: true });
  });

  it("con sessione e profilo passa", () => {
    expect(decideSessionGuard({ ...BASE, hasSession: true, segments: content })).toEqual({ kind: "allow" });
  });
});

describe("isSafeInternalTarget (§297)", () => {
  it("accetta solo path interni", () => {
    expect(isSafeInternalTarget("/content/profile_post/c1?origin=NOTIFICATION")).toBe(true);
    expect(isSafeInternalTarget("/club/k1")).toBe(true);
  });

  it("rifiuta schema, host, backslash, spazi, radice e valori non stringa", () => {
    for (const value of [
      "https://evil.example/x",
      "footme://content/x",
      "//evil.example/x",
      "/\\evil.example",
      "content/x",
      "/x?next=https://evil.example",
      "/a b",
      "/",
      "",
      null,
      undefined,
      42,
      `/${"a".repeat(600)}`,
    ]) {
      expect(isSafeInternalTarget(value)).toBe(false);
    }
  });

  it("rifiuta le route di accesso, onboarding e admin", () => {
    for (const value of ["/sign-in", "/sign-up?x=1", "/welcome", "/forgot-password", "/(auth)/sign-in", "/(onboarding)/profile", "/(admin)/dashboard"]) {
      expect(isSafeInternalTarget(value)).toBe(false);
    }
  });
});

describe("pendingTargetForRoute", () => {
  it("conserva la query ed esclude i parametri già nel path", () => {
    expect(
      pendingTargetForRoute("/content/profile_post/c1", ["content", "[type]", "[id]"], {
        comment: "cm1",
        focus: "comments",
        id: "c1",
        origin: "NOTIFICATION",
        type: "profile_post",
      }),
    ).toBe("/content/profile_post/c1?comment=cm1&focus=comments&origin=NOTIFICATION");
  });

  it("senza query restituisce il path; codifica i valori", () => {
    expect(pendingTargetForRoute("/club/k1", ["club", "[id]"], { id: "k1" })).toBe("/club/k1");
    expect(pendingTargetForRoute("/search/results", ["search", "results"], { q: "a&b" })).toBe(
      "/search/results?q=a%26b",
    );
  });

  it("un path non sicuro non si ricorda", () => {
    expect(pendingTargetForRoute("/", [], {})).toBeNull();
    expect(pendingTargetForRoute("/sign-in", ["(auth)", "sign-in"], {})).toBeNull();
  });
});
