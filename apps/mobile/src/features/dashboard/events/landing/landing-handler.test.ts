/**
 * Handler HTTP della landing (DAS-REV-29 §24): routing, stati 200/404/503,
 * cache fino al prossimo confine, firma del flyer con degrado (QA-126).
 * `fetch` è iniettato: nessuna rete, nessun Supabase.
 */
import { describe, expect, it, vi } from "vitest";

import { createEventLandingHandler, type EventLandingConfig, type FetchLike } from "./landing-handler";
import { FIXTURE_PUBLIC_ID, fixturePayload } from "./landing-preview";

const CONFIG: EventLandingConfig = {
  androidStoreUrl: "https://play.example/store/apps/prolink",
  anonKey: "anon-key",
  appScheme: "footme",
  iosStoreUrl: "https://apps.example/app/prolink",
  supabaseUrl: "https://db.example/",
  webOrigin: "https://prolink.example",
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8)";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status });
}

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

function setup(rpc: Route, sign: Route = () => json({}, 400)) {
  const fetch = vi.fn<FetchLike>(async (url, init) =>
    url.includes("/rest/v1/rpc/") ? rpc(url, init) : sign(url, init),
  );
  const handler = createEventLandingHandler(CONFIG, { fetch, now: () => 0 });
  const request = (path: string, init: RequestInit & { ua?: string } = {}) =>
    handler(
      new Request(`https://prolink.example${path}`, {
        headers: { "user-agent": init.ua ?? IPHONE },
        method: init.method ?? "GET",
      }),
    );

  return { fetch, request };
}

describe("routing", () => {
  it.each(["/", "/event", `/events/${FIXTURE_PUBLIC_ID}`, "/event/short", "/event/has%20space123", `/event/${FIXTURE_PUBLIC_ID}/x`])(
    "%s → 404 non disponibile, senza chiamare il DB",
    async (path) => {
      const { fetch, request } = setup(() => json(fixturePayload("open")));
      const res = await request(path);

      expect(res.status).toBe(404);
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
      expect(await res.text()).toContain("Contenuto non disponibile");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("metodi diversi da GET/HEAD → 405", async () => {
    const { request } = setup(() => json(fixturePayload("open")));
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`, { method: "POST" });

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });
});

describe("evento disponibile", () => {
  it("chiama la RPC con la chiave anon e risponde 200 con la pagina", async () => {
    const { fetch, request } = setup(() =>
      json(
        fixturePayload("open", { server_now: "2026-09-20T10:00:00+00:00" }, {
          next_transition_at: "2026-09-20T10:00:42+00:00",
        }),
      ),
    );
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);
    const [url, init] = fetch.mock.calls[0];

    expect(url).toBe("https://db.example/rest/v1/rpc/fetch_public_selection_event");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer anon-key", apikey: "anon-key" });
    expect(JSON.parse(String(init.body))).toEqual({ p_public_id: FIXTURE_PUBLIC_ID });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=42, s-maxage=42");
    expect(res.headers.get("vary")).toBe("User-Agent");
    expect(res.headers.get("x-robots-tag")).toBeNull();
    expect(res.headers.get("content-security-policy")).toMatch(/script-src 'sha256-[A-Za-z0-9+/=]+'/);

    const body = await res.text();
    expect(body).toContain("Open day Primavera");
    expect(body).toContain('href="https://apps.example/app/prolink"');
  });

  it("cache a 60 s quando il prossimo confine è lontano o assente", async () => {
    const { request } = setup(() => json(fixturePayload("completed")));
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);

    expect(res.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
  });

  it.each(["cancelled", "completed"] as const)("%s → 200, mai 404", async (state) => {
    const { request } = setup(() => json(fixturePayload(state)));
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain(state === "cancelled" ? "Evento annullato" : "Evento concluso");
  });

  it("HEAD: stessi header, nessun corpo", async () => {
    const { request } = setup(() => json(fixturePayload("open")));
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`, { method: "HEAD" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toBe("");
  });

  it("Android → link a Google Play", async () => {
    const { request } = setup(() => json(fixturePayload("open")));
    const body = await (await request(`/event/${FIXTURE_PUBLIC_ID}`, { ua: ANDROID })).text();

    expect(body).toContain('<a class="btn btn-primary" href="https://play.example/store/apps/prolink"');
  });

  it("flyer firmato: immagine e og:image dal link firmato", async () => {
    const flyer = { height: 1350, path: "club-1/asset 1.jpg", width: 1080 };
    const sign = vi.fn<Route>(() => json({ signedURL: "/object/sign/selection-event-flyers/club-1/asset%201.jpg?token=t" }));
    const { request } = setup(() => json(fixturePayload("open", { flyer })), sign);
    const body = await (await request(`/event/${FIXTURE_PUBLIC_ID}`)).text();
    const signed = "https://db.example/storage/v1/object/sign/selection-event-flyers/club-1/asset%201.jpg?token=t";

    expect(sign.mock.calls[0][0]).toBe(
      "https://db.example/storage/v1/object/sign/selection-event-flyers/club-1/asset%201.jpg",
    );
    expect(JSON.parse(String(sign.mock.calls[0][1].body))).toEqual({ expiresIn: 3600 });
    expect(body).toContain(`<img src="${signed}"`);
    expect(body).toContain(`<meta property="og:image" content="${signed}">`);
  });

  it("QA-126: firma fallita → pagina senza immagine, sempre 200", async () => {
    const flyer = { height: 1350, path: "club-1/asset.jpg", width: 1080 };
    const { request } = setup(
      () => json(fixturePayload("open", { flyer })),
      () => {
        throw new Error("offline");
      },
    );
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain("<figure");
    expect(body).toContain("Open day Primavera");
  });
});

describe("non disponibile ed errori", () => {
  it("state unavailable → 404 noindex senza dati", async () => {
    const { request } = setup(() => json({ state: "unavailable" }));
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(body).toContain('<meta name="robots" content="noindex">');
    expect(body).toContain("Contenuto non disponibile");
    expect(body).not.toContain("AC Como");
  });

  it("payload di un altro evento → non disponibile", async () => {
    const { request } = setup(() => json(fixturePayload("open", { public_id: "Altro_evento_42" })));
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);

    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Open day Primavera");
  });

  it.each([
    ["rete", () => Promise.reject(new TypeError("fetch failed"))],
    ["5xx", () => json({ message: "boom" }, 500)],
    ["corpo non JSON", () => new Response("<html>", { status: 200 })],
  ] as const)("%s → 503 errore di caricamento, mai in cache", async (_label, rpc) => {
    const { request } = setup(rpc as Route);
    const res = await request(`/event/${FIXTURE_PUBLIC_ID}`);
    const body = await res.text();

    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body).toContain("Impossibile caricare l’evento. Riprova.");
    expect(body).toContain(`href="/event/${FIXTURE_PUBLIC_ID}"`);
    expect(body).not.toContain("Contenuto non disponibile");
  });
});
