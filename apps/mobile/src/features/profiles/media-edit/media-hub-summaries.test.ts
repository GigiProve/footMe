/**
 * Riepiloghi dell'hub Modifica profilo Media/Creator (REV-PROF-22, Screen 1).
 *
 * Controllano le due cose che un riepilogo può sbagliare in modo costoso:
 * mostrare un numero che non è stato ancora verificato, e mostrare un dato
 * che non appartiene alla realtà editoriale.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import {
  MEDIA_INCOMPLETE_SUMMARY,
  buildMediaAreasSummary,
  buildMediaChannelsSummary,
  buildMediaContentTypesSummary,
  buildMediaCoverageSummary,
  buildMediaSectionSummary,
} from "./media-hub-summaries";
import type { MediaChannelForm } from "./media-edit-rules";

const EMPTY_CHANNELS: MediaChannelForm = {
  facebook: "",
  instagram: "",
  tiktok: "",
  visibility: {
    facebook: false,
    instagram: false,
    tiktok: false,
    website: false,
    youtube: false,
  },
  website: "",
  youtube: "",
};

function buildProfile(
  mediaProfile: Record<string, unknown> | null,
): CompleteProfessionalProfile {
  return {
    mediaProfile,
    profile: {
      avatar_url: "https://example.com/owner.jpg",
      birth_date: "1992-06-12",
      city: "Milano",
      cover_url: null,
      full_name: "Marco Rossi",
      id: "media-1",
      region: "Lombardia",
      residence: "Milano",
      role: "media",
    },
    userContacts: {
      email: "",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
    },
  } as unknown as CompleteProfessionalProfile;
}

const BASE_MEDIA = {
  affiliation_type: null,
  content_types: [] as string[],
  coverage_scope: null as string | null,
  covered_provinces: [] as string[],
  covered_territories: [] as string[],
  creator_type: "news_outlet",
  creator_type_other: null,
  editorial_type: null,
  entity_name: "Redazione Nord",
  focus_areas: [] as string[],
  logo_url: null,
  profile_id: "media-1",
  short_description: null as string | null,
  updated_at: null,
  verification_status: "unverified",
};

describe("conteggi", () => {
  it("dichiara incompleto quello che non è stato ancora scelto", () => {
    expect(buildMediaCoverageSummary(0)).toBe(MEDIA_INCOMPLETE_SUMMARY);
    expect(buildMediaContentTypesSummary(0)).toBe(MEDIA_INCOMPLETE_SUMMARY);
    expect(buildMediaChannelsSummary(0)).toBe(MEDIA_INCOMPLETE_SUMMARY);
  });

  it("accorda singolare e plurale", () => {
    expect(buildMediaCoverageSummary(1)).toBe("1 ambito selezionato");
    expect(buildMediaCoverageSummary(3)).toBe("3 ambiti selezionati");
    expect(buildMediaContentTypesSummary(4)).toBe("4 selezionati");
    expect(buildMediaChannelsSummary(1)).toBe("1 visibile");
  });
});

describe("riepilogo delle aree", () => {
  it("elenca fino a tre aree per esteso", () => {
    expect(buildMediaAreasSummary(["Lombardia", "Piemonte", "Liguria"])).toBe(
      "Lombardia, Piemonte e Liguria",
    );
    expect(buildMediaAreasSummary(["Lombardia"])).toBe("Lombardia");
  });

  it("conta invece di elencare quando le aree sono molte", () => {
    expect(
      buildMediaAreasSummary(["Lombardia", "Piemonte", "Liguria", "Veneto"]),
    ).toBe("Lombardia, Piemonte e altre 2");
  });
});

describe("riepilogo di una riga", () => {
  it('mostra "Tutta Italia" come dichiarazione, non come elenco vuoto', () => {
    const summary = buildMediaSectionSummary("areas", {
      channels: EMPTY_CHANNELS,
      contentCount: null,
      profile: buildProfile({ ...BASE_MEDIA, coverage_scope: "ITALY" }),
    });

    expect(summary).toBe("Tutta Italia");
  });

  it("non usa la residenza del proprietario come area coperta", () => {
    const summary = buildMediaSectionSummary("areas", {
      channels: EMPTY_CHANNELS,
      contentCount: null,
      profile: buildProfile(BASE_MEDIA),
    });

    expect(summary).toBe(MEDIA_INCOMPLETE_SUMMARY);
  });

  it("legge le zone quando la modalità è per province", () => {
    const summary = buildMediaSectionSummary("areas", {
      channels: EMPTY_CHANNELS,
      contentCount: null,
      profile: buildProfile({
        ...BASE_MEDIA,
        coverage_scope: "PROVINCES",
        covered_provinces: ["Bergamo", "Brescia"],
        covered_territories: ["Lombardia"],
      }),
    });

    expect(summary).toBe("Bergamo e Brescia");
  });

  it("non mostra uno zero prima di aver verificato il conteggio", () => {
    const pending = buildMediaSectionSummary("media", {
      channels: EMPTY_CHANNELS,
      contentCount: null,
      profile: buildProfile(BASE_MEDIA),
    });
    const confirmed = buildMediaSectionSummary("media", {
      channels: EMPTY_CHANNELS,
      contentCount: 0,
      profile: buildProfile(BASE_MEDIA),
    });

    expect(pending).toBeUndefined();
    expect(confirmed).toBe("0 contenuti");
  });

  it("conta solo i canali davvero visibili", () => {
    const summary = buildMediaSectionSummary("channels", {
      channels: {
        ...EMPTY_CHANNELS,
        instagram: "@redazione",
        visibility: {
          ...EMPTY_CHANNELS.visibility,
          instagram: true,
          // Acceso ma senza valore: non è un canale visibile.
          website: true,
        },
      },
      contentCount: null,
      profile: buildProfile(BASE_MEDIA),
    });

    expect(summary).toBe("1 visibile");
  });

  it("dichiara incompleta una presentazione mai scritta", () => {
    expect(
      buildMediaSectionSummary("presentation", {
        channels: EMPTY_CHANNELS,
        contentCount: null,
        profile: buildProfile(BASE_MEDIA),
      }),
    ).toBe(MEDIA_INCOMPLETE_SUMMARY);

    expect(
      buildMediaSectionSummary("presentation", {
        channels: EMPTY_CHANNELS,
        contentCount: null,
        profile: buildProfile({
          ...BASE_MEDIA,
          short_description: "Notizie dal dilettantismo.",
        }),
      }),
    ).toBe("Descrizione pubblica");
  });
});
