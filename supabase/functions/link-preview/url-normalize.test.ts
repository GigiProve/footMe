import { describe, expect, it } from "vitest";

import { displayDomain, normalizeUrl, parseHttpsUrl, TRACKING_PARAM } from "./url-normalize.ts";

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

describe("parametri di tracciamento (HOM-06.2 §7H)", () => {
  it("toglie i parametri di tracciamento noti, in qualunque posizione e maiuscole", () => {
    expect(
      normalizeUrl(
        "https://example.com/a?fbclid=AbC&id=7&gclid=1&dclid=2&msclkid=3&mc_cid=4&mc_eid=5&igshid=6&_hsenc=7&_hsmi=8&ref_src=twsrc&UTM_Source=x&FBCLID=Z",
      ),
    ).toBe("https://example.com/a?id=7");
  });

  it("NON toglie i parametri funzionali, nemmeno quelli che somigliano a un tracciamento", () => {
    for (const q of ["ref=home", "v=abc", "page=2", "q=derby", "id=3", "fb=1", "utmx=1", "gclid_custom=1", "source=rss"]) {
      expect(normalizeUrl(`https://example.com/a?${q}`), q).toBe(`https://example.com/a?${q}`);
    }
  });

  it("senza altri parametri non resta il punto interrogativo; l'ordine dei funzionali è invariato", () => {
    expect(normalizeUrl("https://example.com/a?fbclid=1&utm_term=x")).toBe("https://example.com/a");
    expect(normalizeUrl("https://example.com/a?z=1&fbclid=1&a=2")).toBe("https://example.com/a?z=1&a=2");
  });

  it("parametro senza valore e nome esatto", () => {
    expect(TRACKING_PARAM.test("fbclid")).toBe(true);
    expect(TRACKING_PARAM.test("fbclid=")).toBe(true);
    expect(TRACKING_PARAM.test("fbclidx=1")).toBe(false);
    expect(TRACKING_PARAM.test("utm_campaign=a")).toBe(true);
  });
});
