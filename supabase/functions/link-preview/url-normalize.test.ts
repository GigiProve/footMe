import { describe, expect, it } from "vitest";

import { displayDomain, normalizeUrl, parseHttpsUrl } from "./url-normalize.ts";

describe("parseHttpsUrl", () => {
  it("accetta https con host pubblico, porta 443 o assente", () => {
    expect(parseHttpsUrl("https://www.gazzetta.it/calcio/a?b=1#x").ok).toBe(true);
    expect(parseHttpsUrl("https://example.com:443/x").ok).toBe(true);
  });

  it("rifiuta schemi diversi da https (§78)", () => {
    for (const u of ["http://example.com/a", "javascript:alert(1)", "data:text/html,x", "ftp://example.com/", "file:///etc/passwd"]) {
      expect(parseHttpsUrl(u).ok, u).toBe(false);
    }
  });

  it("rifiuta userinfo, porte non 443, IP letterali, host senza punto e riservati", () => {
    const cases: Array<[string, string]> = [
      ["https://user:pw@example.com/", "credentials"],
      ["https://user@example.com/", "credentials"],
      ["https://example.com:8443/", "port"],
      ["https://127.0.0.1/", "host"],
      ["https://10.0.0.5/x", "host"],
      ["https://[::1]/", "host"],
      ["https://[fd00:ec2::254]/", "host"],
      ["https://2130706433/", "host"], // 127.0.0.1 in decimale: URL lo normalizza ad a.b.c.d
      ["https://localhost/", "host"],
      ["https://intranet/", "host"],
      ["https://printer.local/", "host"],
      ["https://db.internal/", "host"],
    ];
    for (const [url, reason] of cases) {
      const r = parseHttpsUrl(url);
      expect(r.ok, url).toBe(false);
      if (!r.ok) {
        expect(r.reason, url).toBe(reason);
      }
    }
  });

  it("rifiuta spazi, caratteri di controllo, stringhe vuote o troppo lunghe", () => {
    expect(parseHttpsUrl("").ok).toBe(false);
    expect(parseHttpsUrl("https://example.com/a b").ok).toBe(false);
    expect(parseHttpsUrl("https://example.com/\u0000").ok).toBe(false);
    expect(parseHttpsUrl(`https://example.com/${"a".repeat(2100)}`).ok).toBe(false);
    expect(parseHttpsUrl("non è un url").ok).toBe(false);
  });
});

describe("normalizeUrl (§88)", () => {
  it("host minuscolo, niente fragment, niente utm_*, niente porta di default", () => {
    expect(normalizeUrl("HTTPS://Example.COM:443/Articolo?utm_source=a&id=3&UTM_medium=b#frag")).toBe(
      "https://example.com/Articolo?id=3",
    );
  });

  it("path vuoto → '/', ordine degli altri parametri invariato", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com/");
    expect(normalizeUrl("https://example.com?z=1&a=2")).toBe("https://example.com/?z=1&a=2");
  });

  it("due URL equivalenti danno la stessa chiave", () => {
    expect(normalizeUrl("https://example.com/a?utm_campaign=x")).toBe(normalizeUrl("https://EXAMPLE.com/a#y"));
  });

  it("URL non valido o non https → null", () => {
    expect(normalizeUrl("http://example.com")).toBeNull();
    expect(normalizeUrl("https://127.0.0.1/")).toBeNull();
  });
});

describe("displayDomain (§81)", () => {
  it("toglie www e porta a minuscolo", () => {
    expect(displayDomain("https://WWW.Gazzetta.it/a")).toBe("gazzetta.it");
    expect(displayDomain("niente")).toBe("");
  });
});
