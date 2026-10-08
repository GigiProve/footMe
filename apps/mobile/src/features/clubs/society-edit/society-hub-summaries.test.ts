/**
 * REV-PROF-18 — contatori dell'hub Società.
 *
 * Singolare e plurale, e la differenza fra "zero" e "non lo so": un contatore
 * che non si è caricato mostra "—", perché 0 è un'informazione e l'assenza di
 * informazione è un'altra cosa.
 */
import { describe, expect, it } from "vitest";

import {
  buildSocietySectionSummary,
  formatSocietyCount,
  SOCIETY_COUNT_PLACEHOLDER,
} from "./society-hub-summaries";
import type { SocietyProfileEditor } from "./society-edit-types";

const editor: SocietyProfileEditor = {
  club: {
    category: "Serie D",
    city: "Predappio",
    clubColors: "Giallo, Blu",
    clubEmail: "info@asdpredappio.it",
    clubPhone: "+39 0543 000000",
    clubStructure: "first_team_and_youth",
    country: "IT",
    coverUrl: null,
    description: null,
    facebook: null,
    fieldAddress: null,
    foundingYear: 1945,
    headquartersAddress: null,
    id: "club-1",
    instagram: "@asdpredappio",
    logoUrl: null,
    name: "ASD Predappio",
    province: "Forlì-Cesena",
    region: "Emilia-Romagna",
    showClubEmail: true,
    showClubPhone: true,
    showFacebook: false,
    showInstagram: false,
    showWebsite: true,
    stadium: null,
    updatedAt: "2026-10-08T10:00:00Z",
    venueAddressSameAsHeadquarters: false,
    verificationStatus: "verified",
    websiteUrl: "asdpredappio.it",
  },
  counts: { affiliates: 1, media: 9, positions: 2, teams: 8 },
  teams: {
    firstTeam: { category: "Serie D", id: "team-1", name: "Prima squadra" },
    hasFirstTeam: true,
    hasYouthTeams: true,
  },
};

describe("formatSocietyCount", () => {
  it("usa il singolare per uno", () => {
    expect(formatSocietyCount(1, "squadra", "squadre")).toBe("1 squadra");
  });

  it("usa il plurale per zero e per molti", () => {
    expect(formatSocietyCount(0, "squadra", "squadre")).toBe("0 squadre");
    expect(formatSocietyCount(8, "squadra", "squadre")).toBe("8 squadre");
  });

  it("mostra un segnaposto quando il contatore non è disponibile", () => {
    expect(formatSocietyCount(undefined, "squadra", "squadre")).toBe(
      SOCIETY_COUNT_PLACEHOLDER,
    );
    expect(formatSocietyCount(null, "squadra", "squadre")).toBe(
      SOCIETY_COUNT_PLACEHOLDER,
    );
  });
});

describe("buildSocietySectionSummary", () => {
  it("conta squadre, collegamenti, posizioni e contenuti", () => {
    expect(buildSocietySectionSummary("teams", editor)).toBe("8 squadre");
    expect(buildSocietySectionSummary("affiliates", editor)).toBe(
      "1 collegamento",
    );
    expect(buildSocietySectionSummary("positions", editor)).toBe(
      "2 posizioni aperte",
    );
    expect(buildSocietySectionSummary("media", editor)).toBe("9 contenuti");
  });

  it("conta i contatti visibili con la regola del payload pubblico", () => {
    // Email, telefono e sito sono accesi e validi; Instagram ha un valore ma
    // e' spento, quindi non e' un contatto visibile.
    expect(buildSocietySectionSummary("contacts", editor)).toBe(
      "3 contatti visibili",
    );
  });

  it("lascia il sottotitolo fisso alle voci che non contano niente", () => {
    expect(buildSocietySectionSummary("identity", editor)).toBeUndefined();
    expect(buildSocietySectionSummary("venue", editor)).toBeUndefined();
  });
});
