import { describe, expect, it, vi } from "vitest";

import { guardedFetchHtml, MAX_REDIRECTS, type GuardedFetchDeps } from "./guarded-fetch.ts";

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });

function deps(routes: Record<string, () => Response>, dns: Record<string, string[]>): GuardedFetchDeps & { fetch: ReturnType<typeof vi.fn> } {
  return {
    resolve: async (host) => {
      if (!(host in dns)) {
        throw new Error("NXDOMAIN");
      }
      return dns[host];
    },
    fetch: vi.fn(async (url: string) => {
      const route = routes[url];
      if (!route) {
        throw new Error(`rete: ${url}`);
      }
      return route();
    }),
  } as GuardedFetchDeps & { fetch: ReturnType<typeof vi.fn> };
}

describe("guardedFetchHtml", () => {
  it("scarica una pagina pubblica", async () => {
    const d = deps({ "https://example.com/a": () => html("<head><title>x</title></head>") }, { "example.com": ["93.184.216.34"] });
    const r = await guardedFetchHtml("https://example.com/a", d);
    expect(r).toEqual({ status: "ok", finalUrl: "https://example.com/a", html: "<head><title>x</title></head>" });
  });

  it("URL non https / con credenziali / IP letterale: nessuna richiesta di rete", async () => {
    const d = deps({}, {});
    expect((await guardedFetchHtml("http://example.com/", d)).status).toBe("blocked");
    expect((await guardedFetchHtml("https://u:p@example.com/", d)).status).toBe("blocked");
    expect((await guardedFetchHtml("https://169.254.169.254/latest/meta-data", d)).status).toBe("blocked");
    expect((await guardedFetchHtml("non url", d)).status).toBe("invalid");
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("hostname che risolve a un IP privato, o anche solo a uno fra più (rebinding): bloccato", async () => {
    const d = deps(
      { "https://evil.example.com/": () => html("x"), "https://mixed.example.com/": () => html("x") },
      { "evil.example.com": ["10.0.0.7"], "mixed.example.com": ["93.184.216.34", "127.0.0.1"] },
    );
    expect((await guardedFetchHtml("https://evil.example.com/", d)).status).toBe("blocked");
    expect((await guardedFetchHtml("https://mixed.example.com/", d)).status).toBe("blocked");
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("hostname che non risolve → bloccato; IPv6 ULA/loopback → bloccato", async () => {
    const d = deps({}, { "v6.example.com": ["fd00:ec2::254"], "lo.example.com": ["::1"] });
    expect((await guardedFetchHtml("https://nxdomain.example.com/", d)).status).toBe("blocked");
    expect((await guardedFetchHtml("https://v6.example.com/", d)).status).toBe("blocked");
    expect((await guardedFetchHtml("https://lo.example.com/", d)).status).toBe("blocked");
  });

  it("segue i redirect e rivalida il target finale (§79)", async () => {
    const d = deps(
      {
        "https://short.example.com/x": () => redirect("https://www.example.com/articolo"),
        "https://www.example.com/articolo": () => html("<title>ok</title>"),
      },
      { "short.example.com": ["93.184.216.34"], "www.example.com": ["93.184.216.35"] },
    );
    const r = await guardedFetchHtml("https://short.example.com/x", d);
    expect(r).toMatchObject({ status: "ok", finalUrl: "https://www.example.com/articolo" });
  });

  it("redirect relativo risolto rispetto all'URL corrente", async () => {
    const d = deps(
      { "https://example.com/a": () => redirect("/b?x=1", 302), "https://example.com/b?x=1": () => html("ok") },
      { "example.com": ["93.184.216.34"] },
    );
    expect(await guardedFetchHtml("https://example.com/a", d)).toMatchObject({ status: "ok", finalUrl: "https://example.com/b?x=1" });
  });

  it("redirect verso rete interna, http, userinfo o metadata: bloccato, senza richiederlo", async () => {
    for (const target of ["https://internal.example.com/", "http://example.com/x", "https://u:p@example.com/", "https://169.254.169.254/", "https://localhost/"]) {
      const d = deps(
        { "https://example.com/a": () => redirect(target), "https://internal.example.com/": () => html("segreto") },
        { "example.com": ["93.184.216.34"], "internal.example.com": ["192.168.1.10"] },
      );
      const r = await guardedFetchHtml("https://example.com/a", d);
      expect(r.status, target).toBe("blocked");
      expect(d.fetch).toHaveBeenCalledTimes(1);
    }
  });

  it(`oltre ${MAX_REDIRECTS} redirect → unavailable`, async () => {
    const routes: Record<string, () => Response> = {};
    for (let i = 0; i < 6; i += 1) {
      routes[`https://example.com/${i}`] = () => redirect(`https://example.com/${i + 1}`);
    }
    const d = deps(routes, { "example.com": ["93.184.216.34"] });
    expect((await guardedFetchHtml("https://example.com/0", d)).status).toBe("unavailable");
    expect(d.fetch).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("solo text/html: json, immagini, pdf → unavailable", async () => {
    for (const type of ["application/json", "image/png", "application/pdf", ""]) {
      const d = deps({ "https://example.com/a": () => new Response("x", { status: 200, headers: { "content-type": type } }) }, { "example.com": ["93.184.216.34"] });
      expect((await guardedFetchHtml("https://example.com/a", d)).status, type).toBe("unavailable");
    }
  });

  it("status HTTP non 2xx e errori di rete → unavailable", async () => {
    const d = deps({ "https://example.com/404": () => new Response("no", { status: 404 }), "https://example.com/500": () => new Response("no", { status: 500 }) }, { "example.com": ["93.184.216.34"] });
    expect((await guardedFetchHtml("https://example.com/404", d)).status).toBe("unavailable");
    expect((await guardedFetchHtml("https://example.com/500", d)).status).toBe("unavailable");
    expect((await guardedFetchHtml("https://example.com/giù", d)).status).toBe("unavailable");
  });

  it("tetto di byte: legge solo i primi maxBytes", async () => {
    const big = "A".repeat(5000);
    const d = { ...deps({ "https://example.com/big": () => html(big) }, { "example.com": ["93.184.216.34"] }), maxBytes: 1000 };
    const r = await guardedFetchHtml("https://example.com/big", d);
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.html.length).toBe(1000);
  });

  it("content-length dichiarato enorme → unavailable senza leggere", async () => {
    const d = { ...deps({ "https://example.com/huge": () => html("x", { "content-length": "999999999" }) }, { "example.com": ["93.184.216.34"] }), maxBytes: 1000 };
    expect((await guardedFetchHtml("https://example.com/huge", d)).status).toBe("unavailable");
  });

  it("timeout: una richiesta che non risponde viene abortita e dà unavailable", async () => {
    const d: GuardedFetchDeps = {
      resolve: async () => ["93.184.216.34"],
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      timeoutMs: 30,
    };
    expect((await guardedFetchHtml("https://example.com/slow", d)).status).toBe("unavailable");
  });
});
