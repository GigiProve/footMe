/**
 * Matrice della landing pubblica (DAS-REV-29 §11–§12, §24): mapper ad
 * allowlist, blocchi e CTA per ogni `public_state`, risoluzione dei link.
 */
import { describe, expect, it } from "vitest";

import {
  birthYearsLabel,
  cacheMaxAgeSeconds,
  detectPlatform,
  discoverTarget,
  downloadTarget,
  landingView,
  parsePublicEvent,
  timeRangeLabel,
  type PublicEvent,
  type PublicState,
} from "./landing-model";
import { FIXTURE_PUBLIC_ID, fixtureContext, fixturePayload } from "./landing-preview";

function available(payload: Record<string, unknown>): PublicEvent {
  const event = parsePublicEvent(payload);

  if (event.state !== "available") {
    throw new Error("fixture non disponibile");
  }

  return event;
}

function view(state: PublicState, patch: Record<string, unknown> = {}, ctxPatch = {}) {
  return landingView(available(fixturePayload(state, patch)), fixtureContext(ctxPatch));
}

describe("parsePublicEvent", () => {
  it.each([
    ["null", null],
    ["array", []],
    ["unavailable", { state: "unavailable" }],
    ["senza public_id", fixturePayload("open", { public_id: null })],
    ["public_id malformato", fixturePayload("open", { public_id: "a/b" })],
    ["stato pubblico sconosciuto", fixturePayload("open", {}, { public_state: "waitlist" })],
    ["senza availability", fixturePayload("open", { availability: null })],
  ])("%s → non disponibile", (_label, input) => {
    expect(parsePublicEvent(input)).toEqual({ state: "unavailable" });
  });

  it("legge il payload disponibile in camelCase", () => {
    const event = available(fixturePayload("open"));

    expect(event.publicId).toBe(FIXTURE_PUBLIC_ID);
    expect(event.club).toEqual({ isVerified: true, logoUrl: null, name: "AC Como" });
    expect(event.startDate).toBe("2026-09-30");
    expect(event.confirmedCount).toBe(32);
    expect(event.availability.publicState).toBe("open");
  });

  it("scarta le chiavi fuori allowlist", () => {
    const event = available(
      fixturePayload("open", {
        decision_message: "messaggio riservato",
        participants: [{ name: "Mario Rossi" }],
        pending_requests_count: 8,
      }),
    );
    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain("Mario Rossi");
    expect(serialized).not.toContain("messaggio riservato");
    expect(serialized).not.toContain("pending");
    expect(Object.keys(event)).not.toContain("eventId");
  });

  it("scarta un logo che non è http(s)", () => {
    const event = available(
      fixturePayload("open", { club: { is_verified: false, logo_url: "javascript:alert(1)", name: "X" } }),
    );

    expect(event.club.logoUrl).toBeNull();
  });

  it("senza limite il conteggio non esiste", () => {
    const event = available(fixturePayload("open", { confirmed_count: 12, max_participants: null }));

    expect(event.confirmedCount).toBeNull();
  });

  it("rifiuta un percorso di flyer con segmenti relativi", () => {
    const event = available(fixturePayload("open", { flyer: { height: 10, path: "../x.jpg", width: 10 } }));

    expect(event.flyer).toBeNull();
  });
});

describe("landingView — matrice §12", () => {
  it("open: scarica e iscriviti, apri nell’app, nota sull’app, scadenza", () => {
    const v = view("open");

    expect(v.primary.label).toBe("Scarica PROLINK e iscriviti");
    expect(v.openInApp?.href).toBe(`footme://event/${FIXTURE_PUBLIC_ID}`);
    expect(v.footnote).toBe("L’iscrizione si completa nell’app PROLINK.");
    expect(v.notice).toBeNull();
    expect(v.deadline).toBe("Iscrizioni entro 28 settembre · 23:59");
    expect(v.manualNote).toBeNull();
    expect(v.installHint).toBe("Dopo l’installazione, riapri questo link per tornare all’evento.");
  });

  it("open manuale: la Società conferma ogni partecipazione", () => {
    expect(view("open", { confirmation_mode: "manual" }).manualNote).toBe(
      "La Società conferma ogni partecipazione.",
    );
  });

  it("open_full_manual: card avviso e richiesta", () => {
    const v = view("open_full_manual", { confirmation_mode: "manual", confirmed_count: 50 });

    expect(v.notice).toEqual({
      icon: "warning",
      text: "Puoi inviare una richiesta. La partecipazione richiede un posto libero e la conferma della Società.",
      title: "Posti esauriti",
    });
    expect(v.primary.label).toBe("Scarica PROLINK e richiedi");
    expect(v.openInApp).not.toBeNull();
    expect(v.footnote).toBeNull();
  });

  it.each([
    ["full", "people", "Posti esauriti"],
    ["closed", "lock", "Iscrizioni chiuse"],
    ["cancelled", "alert", "Evento annullato"],
    ["completed", "flag", "Evento concluso"],
  ] as const)("%s: card %s «%s», solo Scopri PROLINK", (state, icon, title) => {
    const v = view(state);

    expect(v.notice?.icon).toBe(icon);
    expect(v.notice?.title).toBe(title);
    expect(v.primary.label).toBe("Scopri PROLINK");
    expect(v.openInApp).toBeNull();
    expect(v.deadline).toBeNull();
    expect(v.installHint).toBeNull();
  });

  it("formatta date e orari civili così come arrivano", () => {
    const v = view("open");

    expect(v.when).toEqual({ date: "30 settembre 2026", time: "15:00 – 18:00" });
    expect(v.subtitle).toBe("Open day · Primavera");
    expect(v.venue).toEqual({ address: "Via Roma 22, Como", name: "Centro Sportivo Comunale" });
  });

  it("partecipanti solo con un limite", () => {
    expect(view("open").participants).toBe("32 / 50 partecipanti confermati");
    expect(view("open", { max_participants: null }).participants).toBeNull();
  });

  it("titolo del documento e metadati Open Graph pubblici", () => {
    const v = view("open");

    expect(v.documentTitle).toBe("Open day Primavera · AC Como – PROLINK");
    expect(v.canonicalUrl).toBe(`https://prolink.example/event/${FIXTURE_PUBLIC_ID}`);
    expect(v.og.description).toBe("30 settembre 2026 · Primavera · Centro Sportivo Comunale");
    expect(v.og.image).toBeNull();
  });

  it("og:image: flyer firmato, altrimenti logo", () => {
    const flyer = { height: 1350, path: "c/a.jpg", width: 1080 };
    const logo = { is_verified: true, logo_url: "https://cdn.example/logo.png", name: "AC Como" };

    expect(view("open", { club: logo, flyer }, { flyerUrl: "https://s.example/f.jpg" }).og.image).toBe(
      "https://s.example/f.jpg",
    );
    expect(view("open", { club: logo, flyer }, { flyerUrl: null }).og.image).toBe(
      "https://cdn.example/logo.png",
    );
    expect(view("open", { flyer }, { flyerUrl: null }).flyer).toBeNull();
  });
});

describe("link di download e Scopri", () => {
  const both = { androidStoreUrl: "https://play.example/a", iosStoreUrl: "https://apps.example/i" };

  it("piattaforma riconosciuta → il suo store", () => {
    expect(downloadTarget({ ...both, platform: "ios", webOrigin: "" })).toEqual({
      href: "https://apps.example/i",
      kind: "link",
    });
    expect(downloadTarget({ ...both, platform: "android", webOrigin: "" })).toEqual({
      href: "https://play.example/a",
      kind: "link",
    });
  });

  it("desktop → entrambi i link ufficiali, senza scegliere", () => {
    const target = downloadTarget({ ...both, platform: "other", webOrigin: "" });

    expect(target.kind).toBe("stores");
    expect(target.kind === "stores" && target.links.map((l) => l.label)).toEqual(["App Store", "Google Play"]);
  });

  it("store della piattaforma mancante → i link configurati", () => {
    const target = downloadTarget({ androidStoreUrl: "https://play.example/a", platform: "ios", webOrigin: "" });

    expect(target).toEqual({
      kind: "stores",
      links: [{ href: "https://play.example/a", label: "Google Play", store: "android" }],
    });
  });

  it("nessun link → disabilitato con il motivo", () => {
    expect(downloadTarget({ platform: "ios", webOrigin: "" })).toEqual({
      kind: "disabled",
      reason: "Il download di PROLINK non è ancora disponibile.",
    });
  });

  it("Scopri PROLINK preferisce discoverUrl", () => {
    expect(discoverTarget({ ...both, discoverUrl: "https://prolink.example/", platform: "ios", webOrigin: "" })).toEqual({
      href: "https://prolink.example/",
      kind: "link",
    });
    expect(discoverTarget({ ...both, platform: "ios", webOrigin: "" })).toEqual({
      href: "https://apps.example/i",
      kind: "link",
    });
  });
});

describe("helper", () => {
  it("anni di nascita", () => {
    expect(birthYearsLabel(2008, 2009)).toBe("2008 – 2009");
    expect(birthYearsLabel(2008, 2008)).toBe("2008");
    expect(birthYearsLabel(null, 2009)).toBe("2009");
    expect(birthYearsLabel(null, null)).toBeNull();
  });

  it("orario con fine facoltativa", () => {
    expect(timeRangeLabel("15:00:00", null)).toBe("15:00");
    expect(timeRangeLabel(null, "18:00:00")).toBeNull();
  });

  it("cache: al massimo 60 s e mai oltre il prossimo confine", () => {
    const base = available(fixturePayload("open"));
    const at = (next: string | null) =>
      cacheMaxAgeSeconds({ ...base, availability: { ...base.availability, nextTransitionAt: next } }, 0);

    expect(at(null)).toBe(60);
    expect(at("2026-09-20T10:00:30+00:00")).toBe(30);
    expect(at("2026-09-20T10:05:00+00:00")).toBe(60);
    expect(at("2026-09-20T09:59:00+00:00")).toBe(0);
  });

  it("piattaforma dallo User-Agent", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("other");
    expect(detectPlatform(null)).toBe("other");
  });
});
