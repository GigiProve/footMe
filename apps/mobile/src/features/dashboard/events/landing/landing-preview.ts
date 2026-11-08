/**
 * Anteprima della landing per il confronto visuale con la tavola
 * DAS-REV-29 (schermate 03–07, 18–20; §6 «dati di esempio», §25).
 *
 * Solo fixture e chiamate pure: nessun effetto all'import. Le fixture
 * riproducono i dati di test della task (Open day Primavera, AC Como,
 * 30 settembre 2026 15:00–18:00 Europe/Rome) e servono anche ai test, così
 * test e anteprima leggono lo stesso payload.
 *
 * Gli URL sono segnaposto su domini riservati (`.example`): nessun dominio
 * o store reale è cablato qui.
 */
import {
  landingView,
  parsePublicEvent,
  type LandingContext,
  type LandingPlatform,
  type PublicState,
} from "./landing-model";
import { renderLanding, renderUnavailable } from "./landing-render";

export const FIXTURE_PUBLIC_ID = "Ab3dE5gH9kLm";

type Payload = Record<string, unknown>;

/** Payload della RPC per uno stato; `patch` sovrascrive le chiavi di primo livello. */
export function fixturePayload(
  state: PublicState = "open",
  patch: Payload = {},
  availabilityPatch: Payload = {},
): Payload {
  const lifecycle = state === "cancelled" || state === "completed" ? state : "published";
  const open = state === "open" || state === "open_full_manual";

  return {
    availability: {
      can_submit_request: open,
      confirmation_mode: "automatic",
      effective_deadline: "2026-09-28T21:59:00+00:00",
      has_explicit_deadline: true,
      is_full: state === "full" || state === "open_full_manual",
      lifecycle,
      max_participants: 50,
      next_transition_at: open ? "2026-09-28T21:59:00+00:00" : null,
      public_state: state,
      registration_open: open,
      started: state === "completed",
      ...availabilityPatch,
    },
    birth_year_from: 2008,
    birth_year_to: 2009,
    club: { is_verified: true, logo_url: null, name: "AC Como" },
    confirmation_mode: "automatic",
    confirmed_count: 32,
    description: "Una giornata per conoscere la nostra Primavera.",
    end_time: "18:00:00",
    event_id: "6f1c2a8e-0000-4000-8000-000000000029",
    event_type: "open_day",
    flyer: null,
    max_participants: 50,
    public_id: FIXTURE_PUBLIC_ID,
    registration_deadline_date: "2026-09-28",
    registration_deadline_time: "23:59:00",
    requirements_info: "Porta abbigliamento e scarpe da calcio.",
    server_now: "2026-09-20T10:00:00+00:00",
    start_date: "2026-09-30",
    start_time: "15:00:00",
    starts_at: "2026-09-30T13:00:00+00:00",
    state: "available",
    team_name: "Primavera",
    timezone: "Europe/Rome",
    title: "Open day Primavera",
    venue_address: "Via Roma 22, Como",
    venue_name: "Centro Sportivo Comunale",
    version: 3,
    ...patch,
  };
}

export function fixtureContext(patch: Partial<LandingContext> = {}): LandingContext {
  return {
    androidStoreUrl: "https://play.example/store/apps/prolink",
    appScheme: "footme",
    discoverUrl: undefined,
    iosStoreUrl: "https://apps.example/app/prolink",
    platform: "ios",
    webOrigin: "https://prolink.example",
    ...patch,
  };
}

/** Locandina segnaposto inline (4:5), solo per l'anteprima. */
function placeholderFlyer(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">' +
    '<rect width="1080" height="1350" fill="#2E7D32"/><rect y="900" width="1080" height="450" fill="#388E3C"/>' +
    '<text x="80" y="300" font-family="Arial,sans-serif" font-size="150" font-weight="900" fill="#FFFFFF">OPEN DAY</text>' +
    '<text x="80" y="460" font-family="Arial,sans-serif" font-size="150" font-weight="900" fill="#FFFFFF">PRIMAVERA</text>' +
    "</svg>";
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function page(payload: Payload, ctx: LandingContext): string {
  const event = parsePublicEvent(payload);

  if (event.state !== "available") {
    return renderUnavailable(ctx);
  }

  return renderLanding(landingView(event, ctx));
}

/** HTML delle schermate web della tavola, indicizzate con il numero della tavola. */
export function renderFixturePages(
  options: { platform?: LandingPlatform } = {},
): Record<string, string> {
  const ctx = fixtureContext({ platform: options.platform ?? "ios" });
  const flyer = { height: 1350, path: "club/asset.jpg", width: 1080 };

  return {
    "03-con-locandina": page(fixturePayload("open", { flyer }), { ...ctx, flyerUrl: placeholderFlyer() }),
    "04-senza-locandina": page(fixturePayload("open"), ctx),
    "05-completo-automatico": page(fixturePayload("full", { confirmed_count: 50 }), ctx),
    "06-completo-manuale": page(
      fixturePayload(
        "open_full_manual",
        { confirmation_mode: "manual", confirmed_count: 50 },
        { confirmation_mode: "manual" },
      ),
      ctx,
    ),
    "07-annullato": page(fixturePayload("cancelled", { confirmed_count: 30 }), ctx),
    "18-iscrizioni-chiuse": page(fixturePayload("closed"), ctx),
    "19-concluso": page(fixturePayload("completed"), ctx),
    "20-non-disponibile": page({ state: "unavailable" }, ctx),
  };
}
