/**
 * HTML della landing (DAS-REV-29 §11–§12, §24, §25): escape, allowlist,
 * copy della matrice, parole vietate, pagina «non disponibile» senza dati.
 */
import { describe, expect, it } from "vitest";

import { landingView, parsePublicEvent, type PublicState } from "./landing-model";
import { FIXTURE_PUBLIC_ID, fixtureContext, fixturePayload, renderFixturePages } from "./landing-preview";
import { LANDING_SCRIPT, escapeHtml, renderLanding, renderLoadError, renderUnavailable } from "./landing-render";

function html(
  state: PublicState = "open",
  patch: Record<string, unknown> = {},
  ctxPatch: Parameters<typeof fixtureContext>[0] = {},
): string {
  const event = parsePublicEvent(fixturePayload(state, patch));

  if (event.state !== "available") {
    throw new Error("fixture non disponibile");
  }

  return renderLanding(landingView(event, fixtureContext(ctxPatch)));
}

function visibleText(doc: string): string {
  return doc
    .replace(/<script>[\s\S]*?<\/script>/g, " ")
    .replace(/<style>[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("sicurezza", () => {
  it("escapa testi e attributi", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });

  it("nessuno <script> iniettato da titolo, descrizione o nome Società", () => {
    const doc = html("open", {
      club: { is_verified: true, logo_url: null, name: "<script>alert('club')</script>" },
      description: "<script>alert('desc')</script>",
      title: '<script>alert("title")</script>',
      venue_name: '"><img src=x onerror=alert(1)>',
    });

    expect(doc.match(/<script>/g)).toHaveLength(1);
    expect(doc).toContain(`<script>${LANDING_SCRIPT}</script>`);
    expect(doc).not.toContain("alert('club')");
    expect(doc).not.toContain("<img src=x");
    expect(doc).toContain("&lt;script&gt;alert(&#39;desc&#39;)&lt;/script&gt;");
  });

  it("solo campi in allowlist: chiavi iniettate e JSON grezzo non compaiono", () => {
    const doc = html("open", {
      decision_message: "MESSAGGIO_RISERVATO",
      participants: [{ name: "Mario Rossi" }],
      pending_requests_count: 8,
    });

    expect(doc).not.toContain("Mario Rossi");
    expect(doc).not.toContain("MESSAGGIO_RISERVATO");
    expect(doc).not.toMatch(/pending|in attesa/i);
    expect(doc).not.toContain('"public_state"');
    expect(doc).not.toContain("6f1c2a8e");
  });

  it("logo non http(s) → cerchio con l'iniziale, nessun attributo pericoloso", () => {
    const doc = html("open", { club: { is_verified: false, logo_url: "javascript:alert(1)", name: "AC Como" } });

    expect(doc).not.toContain("javascript:");
    expect(doc).toContain('<span class="club-initial" aria-hidden="true">A</span>');
    expect(doc).not.toContain("Società verificata");
  });
});

describe("struttura e copy", () => {
  it("head: lingua, titolo, canonical, Open Graph", () => {
    const doc = html("open");
    const canonical = `https://prolink.example/event/${FIXTURE_PUBLIC_ID}`;

    expect(doc).toContain('<html lang="it">');
    expect(doc).toContain("<title>Open day Primavera · AC Como – PROLINK</title>");
    expect(doc).toContain(`<link rel="canonical" href="${canonical}">`);
    expect(doc).toContain(`<meta property="og:url" content="${canonical}">`);
    expect(doc).toContain(
      '<meta property="og:description" content="30 settembre 2026 · Primavera · Centro Sportivo Comunale">',
    );
    expect(doc).not.toContain("og:image");
    expect(doc).not.toContain("noindex");
  });

  it("schermata 04: dati, sezioni, scadenza e CTA dell'evento aperto", () => {
    const text = visibleText(html("open"));

    for (const piece of [
      "PROLINK",
      "AC Como",
      "Open day Primavera",
      "Open day · Primavera",
      "30 settembre 2026",
      "15:00 – 18:00",
      "Centro Sportivo Comunale",
      "Via Roma 22, Como",
      "32 / 50 partecipanti confermati",
      "Anni di nascita di riferimento",
      "2008 – 2009",
      "Descrizione",
      "Una giornata per conoscere la nostra Primavera.",
      "Requisiti e informazioni",
      "Porta abbigliamento e scarpe da calcio.",
      "Iscrizioni entro 28 settembre · 23:59",
      "Scarica PROLINK e iscriviti",
      "Apri nell’app",
      "L’iscrizione si completa nell’app PROLINK.",
      "Dopo l’installazione, riapri questo link per tornare all’evento.",
    ]) {
      expect(text).toContain(piece);
    }
  });

  it("«Apri nell’app» punta allo schema dell'app; il fallback parte nascosto", () => {
    const doc = html("open");

    expect(doc).toContain(`id="prolink-open-app" href="footme://event/${FIXTURE_PUBLIC_ID}"`);
    expect(doc).toContain('id="prolink-open-fallback" hidden');
    expect(doc).toContain('href="https://apps.example/app/prolink"');
  });

  it("senza limite niente riga partecipanti, mai «illimitati»", () => {
    const doc = html("open", { max_participants: null });

    expect(doc).not.toContain("partecipanti confermati");
    expect(doc).not.toMatch(/illimitat/i);
  });

  it("sezioni facoltative omesse quando mancano", () => {
    const text = visibleText(
      html("open", { birth_year_from: null, birth_year_to: null, description: null, requirements_info: null }),
    );

    expect(text).not.toContain("Anni di nascita");
    expect(text).not.toContain("Descrizione");
    expect(text).not.toContain("Requisiti e informazioni");
  });

  it("flyer: box con il rapporto riservato, lazy, alt col titolo; nessun segnaposto senza flyer", () => {
    const doc = html(
      "open",
      { flyer: { height: 1350, path: "c/a.jpg", width: 1080 } },
      { flyerUrl: "https://s.example/f.jpg" },
    );

    expect(doc).toContain('style="aspect-ratio:1080 / 1350"');
    expect(doc).toContain('loading="lazy"');
    expect(doc).toContain('alt="Locandina dell’evento Open day Primavera"');
    expect(html("open")).not.toContain("<figure");
  });

  it("logo reale con alt e badge verificato", () => {
    const doc = html("open", {
      club: { is_verified: true, logo_url: "https://cdn.example/logo.png", name: "AC Como" },
    });

    expect(doc).toContain('src="https://cdn.example/logo.png" alt="Logo di AC Como"');
    expect(doc).toContain('aria-label="Società verificata"');
  });

  it("manuale con posti: nota sulla conferma della Società", () => {
    expect(html("open", { confirmation_mode: "manual" })).toContain("La Società conferma ogni partecipazione.");
  });

  it.each([
    ["open_full_manual", ["Posti esauriti", "Puoi inviare una richiesta.", "Scarica PROLINK e richiedi", "Apri nell’app"]],
    ["full", ["Posti esauriti", "L’evento ha raggiunto il numero massimo di partecipanti.", "Scopri PROLINK"]],
    ["closed", ["Iscrizioni chiuse", "Il termine per inviare nuove richieste è trascorso.", "Scopri PROLINK"]],
    ["cancelled", ["Evento annullato", "Questo evento non è più disponibile per la partecipazione.", "Scopri PROLINK"]],
    ["completed", ["Evento concluso", "Le iscrizioni a questo evento sono terminate.", "Scopri PROLINK"]],
  ] as const)("%s: copy della matrice", (state, pieces) => {
    const text = visibleText(html(state));

    for (const piece of pieces) {
      expect(text).toContain(piece);
    }
  });

  it.each(["full", "closed", "cancelled", "completed"] as const)(
    "%s: niente iscrizione, niente app, niente scadenza, niente script",
    (state) => {
      const doc = html(state);

      expect(doc).not.toContain("Scarica PROLINK e");
      expect(doc).not.toContain("Apri nell’app");
      expect(doc).not.toContain("Iscrizioni entro");
      expect(doc).not.toContain("<script>");
    },
  );

  it("desktop: entrambi i link ufficiali, il primario rimanda ai link", () => {
    const doc = html("open", {}, { platform: "other" });

    expect(doc).toContain('<a class="btn btn-primary" href="#prolink-stores">Scarica PROLINK e iscriviti</a>');
    expect(doc).toContain(">App Store</a>");
    expect(doc).toContain(">Google Play</a>");
  });

  it("nessuno store configurato: CTA disabilitata con il motivo", () => {
    const doc = html("open", {}, { androidStoreUrl: undefined, iosStoreUrl: undefined });

    expect(doc).toContain('aria-disabled="true">Scarica PROLINK e iscriviti</span>');
    expect(doc).toContain("Il download di PROLINK non è ancora disponibile.");
  });
});

describe("pagine generiche", () => {
  it("non disponibile: nessun dato dell'evento, noindex", () => {
    const doc = renderUnavailable(fixtureContext());

    expect(doc).toContain("Contenuto non disponibile");
    expect(doc).toContain("Questo contenuto non è disponibile.");
    expect(doc).toContain("Scopri PROLINK");
    expect(doc).toContain('<meta name="robots" content="noindex">');
    expect(doc).not.toMatch(/AC Como|Open day|Primavera|og:title|canonical/);
  });

  it("errore di caricamento: copy e link per ricaricare", () => {
    const doc = renderLoadError({ retryHref: `/event/${FIXTURE_PUBLIC_ID}` });

    expect(doc).toContain("Impossibile caricare l’evento. Riprova.");
    expect(doc).toContain(`href="/event/${FIXTURE_PUBLIC_ID}"`);
    expect(doc).not.toContain("Contenuto non disponibile");
  });

  it("anteprima: tutte le schermate web, nessuna parola vietata, nessun conteggio in attesa", () => {
    const pages = renderFixturePages();

    expect(Object.keys(pages)).toEqual([
      "03-con-locandina",
      "04-senza-locandina",
      "05-completo-automatico",
      "06-completo-manuale",
      "07-annullato",
      "18-iscrizioni-chiuse",
      "19-concluso",
      "20-non-disponibile",
    ]);

    for (const doc of Object.values(pages)) {
      expect(doc.startsWith("<!doctype html>")).toBe(true);
      expect(doc).not.toMatch(/Prenota|Il tuo posto|Lista d’attesa|Lista d'attesa|Ti avviseremo|in attesa/i);
    }

    expect(pages["03-con-locandina"]).toContain("data:image/svg+xml;base64,");
    expect(pages["05-completo-automatico"]).toContain("50 / 50 partecipanti confermati");
    expect(pages["07-annullato"]).toContain("30 / 50 partecipanti confermati");
  });
});
